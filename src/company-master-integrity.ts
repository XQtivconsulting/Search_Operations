import {companyNames,normalizedCompany} from './company-match';
import {cleanCompany,mergeTags,tagFields,scalarFields} from './company-import';
import {hasPermission} from './access-policy';
import {requireThat} from './domain';
import {createHash} from 'node:crypto';
type R=Record<string,any>;
const records=(db:any):R[]=>db.rows("SELECT * FROM research_records WHERE kind IN ('company','candidate','mapping','target')").map((r:R)=>({...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version,record_key:r.record_key}));
function writer(db:any,a:any,action:string){return (old:R|null,data:R,kind=old?.kind||'company',role=old?.role_id||'',key=old?.record_key||normalizedCompany(data.name))=>{
 const id=old?.id||crypto.randomUUID(),next={...data};for(const k of ['id','kind','role_id','version','record_key'])delete next[k];
 db.rows('INSERT INTO research_records(id,kind,role_id,record_key,data,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET record_key=excluded.record_key,data=excluded.data,version=excluded.version',id,kind,role,key,JSON.stringify(next),(old?.version||0)+1);
 db.audit(a,action,id,old,next);db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,a.id,action,JSON.stringify({before:old,after:next}),new Date().toISOString());
 return {...next,id,kind,role_id:role,record_key:key,version:(old?.version||0)+1};
};}
export function reconcileCompanyMaster(db:any,a:any){
 const all=records(db),companies=all.filter(r=>r.kind==='company'),ids=new Set(companies.map(c=>c.id)),names=new Map<string,R[]>(),save=writer(db,a,'company-master-reconcile');
 const index=(c:R)=>{ids.add(c.id);for(const name of new Set(companyNames(c)))names.set(name,[...(names.get(name)||[]),c]);};companies.forEach(index);
 let created=0,linked=0;const ambiguous:string[]=[];
 for(const r of all.filter(r=>r.kind!=='company')){
  if(r.company_id&&ids.has(r.company_id))continue;
  const name=String(r.kind==='target'?r.name||r.company||'':r.company||'').trim();if(!name)continue;
  const matches=names.get(normalizedCompany(name))||[];if(matches.length>1){ambiguous.push(name);continue;}
  let c=matches[0];if(!c){c=save(null,cleanCompany({name}),'company','',name.toLowerCase().replace(/\s+/g,' '));index(c);created++;}
  // A preexisting target for this role/company needs an explicit merge, not a key collision.
  if(r.kind==='target'&&all.some(t=>t.kind==='target'&&t.id!==r.id&&t.role_id===r.role_id&&t.company_id===c.id)){ambiguous.push(name);continue;}
  save(r,{...r,company_id:c.id},r.kind,r.role_id,r.kind==='target'?r.role_id+':'+c.id:r.record_key);r.company_id=c.id;linked++;
 }
 return {created,linked,ambiguous:[...new Set(ambiguous)]};
}
export function mergeCompanyMaster(db:any,a:any,b:R){
 requireThat(hasPermission(a,'companies.edit'),'Company editing permission required.',403);
 const all=records(db),keep=all.find(r=>r.kind==='company'&&r.id===b.keep_id),source=all.find(r=>r.kind==='company'&&r.id===b.source_id);
 requireThat(keep&&source&&keep.id!==source.id,'Select two different company records.');
 const refs=all.filter(r=>r.kind!=='company'&&r.company_id===source.id),targets=refs.filter(r=>r.kind==='target'),collisions=targets.map(t=>({source:t,keep:all.find(r=>r.kind==='target'&&r.role_id===t.role_id&&r.company_id===keep.id)})).filter(t=>t.keep);
 const conflicts=scalarFields.filter(k=>keep[k]&&source[k]&&keep[k]!==source[k]).map(k=>({field:k,keep:keep[k],source:source[k]}));
 const signature=createHash('sha256').update(JSON.stringify([keep.id,source.id,all.map(r=>[r.id,r.version]).sort()])).digest('hex');
 const preview={signature,keep:keep.name,source:source.name,candidates:refs.filter(r=>r.kind==='candidate').length,mappings:refs.filter(r=>r.kind==='mapping').length,targets:targets.length,targetConflicts:collisions.map(t=>({search_id:t.source.role_id,keep:t.keep,source:t.source})),conflicts};
 if(b.preview)return preview;
 requireThat(b.signature===signature,'Companies or linked records changed. Preview the merge again.',409);
 const next:R={...keep,aliases:mergeTags(keep.aliases,source.name,source.aliases),merged_profiles:[...(keep.merged_profiles||[]),source]},save=writer(db,a,'company-merge');
 for(const field of tagFields)next[field]=mergeTags(keep[field],source[field]);for(const field of scalarFields)if(!next[field]&&source[field])next[field]=source[field];
 requireThat(!all.some(c=>c.kind==='company'&&![keep.id,source.id].includes(c.id)&&companyNames(c).some(n=>companyNames(next).includes(n))),'A third company shares an alias. Resolve it before merging.',409);
 const targetIds=new Map(collisions.map(t=>[t.source.id,t.keep!.id]));
 for(const r of refs){
  if(r.kind==='target'&&targetIds.has(r.id)){const dest=collisions.find(t=>t.source.id===r.id)!.keep!;save(dest,{...dest,merged_targets:[...(dest.merged_targets||[]),r]});db.audit(a,'company-merge-target',r.id,r,{merged_into:dest.id});db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),r.id,a.id,'company-merge-target',JSON.stringify({before:r,merged_into:dest.id}),new Date().toISOString());db.rows('DELETE FROM research_records WHERE id=?',r.id);continue;}
  save(r,{...r,company_id:keep.id,...(r.kind==='candidate'?{company:keep.name}:r.kind==='target'?{name:keep.name}:{}),...(targetIds.has(r.target_id)?{target_id:targetIds.get(r.target_id)}:{})},r.kind,r.role_id,r.kind==='target'?r.role_id+':'+keep.id:r.record_key);
 }
 for(const r of all.filter(r=>r.kind==='mapping'&&r.company_id!==source.id&&targetIds.has(r.target_id)))save(r,{...r,target_id:targetIds.get(r.target_id)});
 save(keep,next);db.audit(a,'company-merge-source',source.id,source,{merged_into:keep.id});db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),source.id,a.id,'company-merge-source',JSON.stringify({before:source,merged_into:keep.id}),new Date().toISOString());db.rows('DELETE FROM research_records WHERE id=?',source.id);
 return {merged:true,...preview};
}
