import {createHash} from 'node:crypto';
import {Actor,hasRole,requireThat} from './domain';
import {pipelineStages} from './engagement-pipeline';
import {linkedin} from './research';
type R=Record<string,any>;
type DB={rows:(q:string,...p:any[])=>R[];audit:(a:Actor,k:string,id:string,old:any,next:any)=>void};
export const conversionSchema=`CREATE TABLE IF NOT EXISTS crm_candidate_batches(id TEXT PRIMARY KEY,search_id TEXT NOT NULL,job_slug TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS crm_candidate_items(batch_id TEXT NOT NULL,slug TEXT NOT NULL,source TEXT NOT NULL,details TEXT,result TEXT,PRIMARY KEY(batch_id,slug));`;
const hash=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const now=()=>new Date().toISOString();
const admin=(a:Actor)=>requireThat(hasRole(a,'admin'),'Administrator permission required.',403);
const records=(db:DB,kind:string)=>db.rows('SELECT * FROM research_records WHERE kind=?',kind).map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version,record_key:r.record_key}));
const date=(v:any)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const label=(v:any)=>String(v||'').trim();
export function crmProfile(c:R){
 let url='';try{if(c.linkedin)url=linkedin(String(c.linkedin).replace(/^http:/,'https:').split('?')[0]);}catch{}
 return {first_name:label(c.first_name),last_name:label(c.last_name),name:[c.first_name,c.last_name].filter(Boolean).join(' ').trim(),url,email:label(c.email).toLowerCase(),phone:label(c.contact_number),company:label(c.current_organization),title:label(c.position)};
}
export function candidateMatch(c:R,existing:R[]){
 const p=crmProfile(c),slug=String(c.slug),ids=existing.filter(r=>(r.crm_ids||[]).includes(slug));
 const urls=p.url?existing.filter(r=>r.url===p.url):[],emails=p.email?existing.filter(r=>String(r.email||'').toLowerCase()===p.email):[];
 const hits=[...new Map([...ids,...urls,...emails].map(r=>[r.id,r])).values()];
 const conflict=hits.length>1||hits.length===1&&(!!p.url&&!!hits[0].url&&p.url!==hits[0].url||!ids.length&&!urls.length&&!!emails.length&&label(hits[0].name).toLowerCase()!==p.name.toLowerCase());
 return {profile:p,candidate:conflict?null:hits[0]||null,conflict:conflict?'CRM ID, LinkedIn or email match different profiles. Resolve the identity conflict before importing.':!p.name?'Candidate has no name in RecruitCRM. Correct it there and start a new preview.':''};
}
export function conversionBatch(db:DB,a:Actor,id:string){admin(a);const b=db.rows('SELECT * FROM crm_candidate_batches WHERE id=?',id)[0];requireThat(b,'Candidate import not found.',404);return {...b,...JSON.parse(b.data)};}
export function startConversion(db:DB,a:Actor,searchId:string,job:string,assignments:R[],authors:Record<string,string>={},authorWarning=''){
 admin(a);requireThat(assignments.every(r=>r.candidate?.slug&&r.status?.status_id!=null&&r.status?.label),'RecruitCRM assignment is missing a candidate identity or hiring stage.',502);
 requireThat(new Set(assignments.map(r=>r.candidate.slug)).size===assignments.length,'RecruitCRM returned duplicate candidate assignments.',502);
 const id=crypto.randomUUID();db.rows('INSERT INTO crm_candidate_batches VALUES(?,?,?,?,?,?)',id,searchId,job,'Fetching',now(),JSON.stringify({actor:a.id,stage_map:null,pipeline:null,authors,authorWarning}));
 for(const row of assignments){const raw=JSON.stringify(row);requireThat(raw.length<1000000,'Candidate profile is too large.',413);db.rows('INSERT INTO crm_candidate_items VALUES(?,?,?,NULL,NULL)',id,row.candidate.slug,raw);}
 if(!assignments.length)db.rows("UPDATE crm_candidate_batches SET status='Ready' WHERE id=?",id);
 db.audit(a,'crm-candidate-preview',id,null,{search_id:searchId,count:assignments.length});return id;
}
export function nextConversionItem(db:DB,a:Actor,id:string){const b=conversionBatch(db,a,id);requireThat(['Fetching','Ready'].includes(b.status),'This preview is already being imported.',409);const r=db.rows('SELECT * FROM crm_candidate_items WHERE batch_id=? AND details IS NULL ORDER BY slug LIMIT 1',id)[0];return {batch:b,item:r?{...r,slug:String(r.slug),source:JSON.parse(r.source)}:null};}
export function saveConversionDetails(db:DB,a:Actor,id:string,slug:string,details:R){
 const b=conversionBatch(db,a,id);requireThat(b.status==='Fetching','Preview changed. Reload.',409);const raw=JSON.stringify(details);requireThat(raw.length<1000000,'Candidate notes and history exceed the supported size. Nothing for this candidate was staged.',413);
 db.rows('UPDATE crm_candidate_items SET details=? WHERE batch_id=? AND slug=? AND details IS NULL',raw,id,slug);
 if(!db.rows('SELECT 1 FROM crm_candidate_items WHERE batch_id=? AND details IS NULL LIMIT 1',id).length)db.rows("UPDATE crm_candidate_batches SET status='Ready' WHERE id=?",id);
}
export function conversionPreview(db:DB,a:Actor,id:string){
 const b=conversionBatch(db,a,id),existing=records(db,'candidate'),mappings=records(db,'mapping'),pipeline=pipelineStages(records(db,'engagement-pipeline'));
 const items=db.rows('SELECT * FROM crm_candidate_items WHERE batch_id=? ORDER BY slug',id).map(r=>{const s=JSON.parse(r.source),d=r.details?JSON.parse(r.details):null,m=candidateMatch(s.candidate,existing),mapping=m.candidate?mappings.find(x=>x.candidate_id===m.candidate!.id&&x.role_id===b.search_id):null;return {slug:r.slug,name:m.profile.name,stage_id:String(s.status.status_id),stage:s.status.label,ready:!!d,notes:d?.notes.length||0,history:d?.history.length||0,match:m.candidate?'Existing candidate':'New candidate',retained:!!mapping,conflict:m.conflict,result:r.result?JSON.parse(r.result):null};});
 const stages=[...new Map(items.map(i=>[i.stage_id,{id:i.stage_id,label:i.stage}])).values()].map(s=>({...s,target:pipeline.filter(p=>p.label.trim().toLowerCase()===s.label.trim().toLowerCase()).length===1?pipeline.find(p=>p.label.trim().toLowerCase()===s.label.trim().toLowerCase())!.id:''}));
 return {id:b.id,search_id:b.search_id,status:b.status,created_at:b.created_at,total:items.length,loaded:items.filter(i=>i.ready).length,applied:items.filter(i=>i.result).length,items,stages,pipeline,stage_map:b.stage_map,authorWarning:b.authorWarning};
}
function put(db:DB,a:Actor,kind:string,role:string,key:string,data:R,old:R|null=null){
 const id=old?.id||crypto.randomUUID(),clean={...data};for(const k of ['id','kind','role_id','version','record_key'])delete clean[k];
 db.rows('INSERT INTO research_records VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version',id,kind,role,key,JSON.stringify(clean),(old?.version||0)+1);
 db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,a.id,'crm-candidate-import',JSON.stringify({before:old,after:clean}),now());db.audit(a,'crm-candidate-import',id,old,clean);return {...clean,id,version:(old?.version||0)+1};
}
const plain=(v:any)=>String(v||'').replace(/<\s*(br|\/p|\/div)\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export function applyConversionItem(db:DB,a:Actor,id:string,stageMap:R){
 const b=conversionBatch(db,a,id);requireThat(db.rows('SELECT 1 FROM searches WHERE id=?',b.search_id).length,'The selected search no longer exists.',409);if(b.status==='Completed')return conversionPreview(db,a,id);
 requireThat(['Ready','Importing'].includes(b.status),'Finish fetching all candidates before importing.',409);
 const pipeline=pipelineStages(records(db,'engagement-pipeline')),signature=hash(pipeline);
 if(b.status==='Ready'){
  const p=conversionPreview(db,a,id);requireThat(p.items.every(i=>!i.conflict),'Resolve candidate identity conflicts before import.',409);
  requireThat(p.stages.every(s=>typeof stageMap?.[s.id]==='string'&&pipeline.some(t=>t.id===stageMap[s.id])),'Map every RecruitCRM hiring stage before importing.');
  db.rows("UPDATE crm_candidate_batches SET status='Importing',data=? WHERE id=?",JSON.stringify({actor:b.actor,stage_map:stageMap,pipeline:signature,authors:b.authors,authorWarning:b.authorWarning}),id);
 }else requireThat(b.pipeline===signature,'Engagement pipeline configuration changed during import. Restore the reviewed configuration or start a new preview.',409);
 const map=b.stage_map||stageMap,row=db.rows('SELECT * FROM crm_candidate_items WHERE batch_id=? AND result IS NULL ORDER BY slug LIMIT 1',id)[0];
 if(row){
  const source=JSON.parse(row.source),details=JSON.parse(row.details),match=candidateMatch(source.candidate,records(db,'candidate'));requireThat(!match.conflict,match.conflict,409);
  const old=match.candidate,profile=match.profile,provenance={source:'RecruitCRM',import_batch:id,imported_at:now(),crm_ids:[...new Set([...(old?.crm_ids||[]),row.slug])]};
  let candidate=old;
  if(!old)candidate=put(db,a,'candidate','',profile.url||'recruitcrm:'+row.slug,{...profile,...provenance,source_created_at:date(source.candidate.created_on)});
  else if(!(old.crm_ids||[]).includes(row.slug)||Object.entries(profile).some(([k,v])=>v&&!old[k])){const next:R={...old,crm_ids:provenance.crm_ids};for(const [k,v] of Object.entries(profile))if(!next[k]&&v)next[k]=v;candidate=put(db,a,'candidate','',old.record_key,next,old);}
  const cid=candidate!.id,existing=records(db,'mapping').find(m=>m.role_id===b.search_id&&m.candidate_id===cid);
  let mapping=existing;
  if(!mapping){mapping=put(db,a,'mapping',b.search_id,b.search_id+':'+cid,{...profile,candidate_id:cid,status:'Imported',source:'RecruitCRM',crm_candidate_slug:row.slug,crm_job_slug:b.job_slug,import_batch:id,created_at:date(source.candidate.created_on),mapper_id:'',staff_id:'',team_id:'',rationale:'Historical RecruitCRM assignment',evidence:{},criteria_snapshot:[]});
   const target=pipeline.find(s=>s.id===map[String(source.status.status_id)])!;requireThat(target,'Mapped engagement stage is missing.',409);
   put(db,a,'engagement',b.search_id,mapping.id,{mapping_id:mapping.id,candidate_id:cid,source:'RecruitCRM',import_batch:id,stage:target.label,stage_id:target.id,crm_stage_id:source.status.status_id,crm_stage_label:source.status.label,stage_at:date(source.stage_date),handoff_at:null});
  }
  let addedNotes=0,addedHistory=0;
  const activity=(key:string,data:R)=>{if(db.rows("SELECT 1 FROM research_records WHERE kind='candidate-activity' AND record_key=?",key).length)return false;put(db,a,'candidate-activity',data.role_id||'',key,{...data,candidate_id:cid,source:'RecruitCRM',import_batch:id});return true;};
  for(const n of details.notes){requireThat(n.id!=null,'RecruitCRM note is missing an ID.',502);const roles=Array.isArray(n.associated_jobs)?n.associated_jobs.map(String):[];const belongs=roles.includes(b.job_slug),foreign=roles.length>0&&!belongs;
   // Preserve source associations; only the selected job is linked to a local search.

   const key='crm-note:'+n.id+':'+hash([n.description,n.updated_on,n.created_by,[...roles].sort()]);
   if(activity(key,{role_id:belongs?b.search_id:'',mapping_id:belongs?mapping.id:undefined,type:'Note',note_group:Array.isArray(n.note_type)&&n.note_type.some((t:R)=>/interview|screening/i.test(String(t.label)))?'Interview notes':'General notes',notes:plain(n.description),source_job_slugs:roles,actor_name:b.authors?.[String(n.created_by)]||'RecruitCRM user '+String(n.created_by||'unknown'),source_id:String(n.id),source_author_id:String(n.created_by||''),source_created_at:date(n.created_on),source_updated_at:date(n.updated_on),occurred_on:date(n.created_on)?.slice(0,10)||'',created_at:date(n.created_on)||''}))addedNotes++;
  }
  const history=[...details.history].sort((x:R,y:R)=>String(x.stage_date||x.updated_on||'').localeCompare(String(y.stage_date||y.updated_on||'')));
  let previous='';for(const h of history){const key='crm-stage:'+b.job_slug+':'+row.slug+':'+hash(h),to=label(h.status?.label);requireThat(to,'RecruitCRM history is missing a stage label.',502);
   if(activity(key,{role_id:b.search_id,mapping_id:mapping.id,type:'Stage update',notes:plain(h.remark),from_stage:previous||'Not recorded',to_stage:to,source_stage_id:h.status.status_id,actor_name:b.authors?.[String(h.updated_by)]||'RecruitCRM user '+String(h.updated_by||'unknown'),source_author_id:String(h.updated_by||''),occurred_on:date(h.stage_date||h.updated_on)?.slice(0,10)||'',created_at:date(h.stage_date||h.updated_on)||''}))addedHistory++;previous=to;
  }
  db.rows('UPDATE crm_candidate_items SET result=? WHERE batch_id=? AND slug=?',JSON.stringify({candidate_id:cid,mapping_id:mapping.id,retained:!!existing,notes:addedNotes,history:addedHistory}),id,row.slug);
 }
 if(!db.rows('SELECT 1 FROM crm_candidate_items WHERE batch_id=? AND result IS NULL LIMIT 1',id).length)db.rows("UPDATE crm_candidate_batches SET status='Completed' WHERE id=?",id);
 return conversionPreview(db,a,id);
}
