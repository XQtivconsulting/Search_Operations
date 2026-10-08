import {hasPermission} from './access-policy';
import {summarizeTranscript} from './transcript-summary';
import {tagCategories,tagOptions,normTag,cleanTagValues} from './candidate-tags';
import {canPlan,hasRole,requireThat,text,Actor} from './domain';
type R=Record<string,any>;
export type ProfileSource={name:string;file_id?:string;activity_id?:string;text:string};
export const canSummarize=(a:Actor)=>hasPermission(a,'candidates.edit');
const aliases:Record<string,string[]>={
 'Banking & Financial Services':['banking','financial services'], 'Healthcare':['healthcare'], 'Life Sciences':['life sciences'], 'Retail & CPG':['consumer packaged goods','retail'], 'Energy & Utilities':['energy and utilities'], 'Sales / Hunting':['sales hunting','new logo sales'], 'Account Management':['account management'], 'AI & Data':['artificial intelligence','data science'], 'HR / Talent':['human resources','talent acquisition'], 'C-suite':['chief executive officer','chief financial officer','chief technology officer','chief operating officer'], 'VP':['vice president'], 'SVP':['senior vice president'], 'EVP':['executive vice president']
};
const phrase=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function profileSuggestions(sources:ProfileSource[],records:R[]){
 const evidence=sources.flatMap(s=>s.text.split(/\n+|(?<=[.!?])\s+/).map(line=>({source:s.name,text:line.trim()})).filter(r=>r.text.length>15));
 const tags:R[]=[];
 for(const c of tagCategories){if(c.key==='compensation'||c.key==='geography')continue;
  for(const value of tagOptions(records,c.key)){const terms=[value,...(aliases[value]||[])].map(phrase).filter(t=>t.length>2);const hit=evidence.find(e=>{const hay=' '+phrase(e.text)+' ';return !/\b(no|not|never|without|seeking|looking for|interviewer|recruiter)\b/i.test(e.text)&&terms.some(t=>hay.includes(' '+t+' '));});if(hit)tags.push({category:c.key,value,source:hit.source,evidence:hit.text.slice(0,700)});}
 }
 // Quoted source excerpts, never invented biographical claims or inferred demographics.
 const excerpts=sources.flatMap(s=>summarizeTranscript(s.text).slice(0,3).map(value=>({source:s.name,text:value}))).slice(0,6);
 return {summary:excerpts.map(e=>e.text).join('\n\n'),suggestions:tags.slice(0,60),excerpts,method:'source-excerpts-and-explicit-tags-v1'};
}
export function candidateSummaryMutation(db:any,a:Actor,b:R,generated?:R){
 requireThat(canSummarize(a),'Candidate editing permission required.',403);
 const all=db.rows('SELECT * FROM research_records').map((r:R)=>({...JSON.parse(r.data),id:r.id,kind:r.kind,version:r.version}));
 const candidate=all.find((r:R)=>r.kind==='candidate'&&r.id===b.candidate_id);requireThat(candidate,'Candidate not found.',404);
 requireThat(candidate.version===Number(b.candidate_version),'Candidate changed. Reload and review the current profile before continuing.',409);
 const write=(id:string,kind:string,data:R,old:R|null)=>{if(old)db.rows('UPDATE research_records SET data=?,version=version+1 WHERE id=?',JSON.stringify(data),id);else db.rows('INSERT INTO research_records(id,kind,record_key,data) VALUES(?,?,?,?)',id,kind,id,JSON.stringify(data));db.audit(a,b.action,id,old,data);return {id};};
 if(b.action==='candidate-summary-draft'){
  requireThat(Array.isArray(b.sources)&&b.sources.length>0&&b.sources.length<=100,'Choose up to 100 source documents or notes.');
  requireThat(b.sources.every((s:R)=>typeof s.text==='string'&&s.text.trim().length>=1)&&b.sources.reduce((n:number,s:R)=>n+s.text.length,0)<=800000,'Provide up to 800,000 characters of source text.');
  const sources:ProfileSource[]=b.sources.map((s:R)=>({name:text(s.name,200)||'Pasted transcript',file_id:s.file_id,activity_id:s.activity_id,text:s.text}));
  for(const s of sources)if(s.file_id)requireThat(db.rows('SELECT id FROM candidate_files WHERE id=? AND candidate_id=?',s.file_id,candidate.id).length,'Source file does not belong to this candidate.',403);
  requireThat(generated?.method==='ai-synthesis-v1','AI synthesis is required. Regenerate this draft.',503);
  const draft=generated!,id=crypto.randomUUID(),created_at=new Date().toISOString();
  // Keep complete pasted sources in the existing document store, outside the workspace state payload.
  for(const s of sources)if(!s.file_id&&!s.activity_id){const fid=crypto.randomUUID(),bytes=new TextEncoder().encode(s.text);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);const base64=btoa(binary);db.rows('INSERT INTO candidate_files VALUES(?,?,?,?,?,?,?)',fid,candidate.id,s.name.replace(/\.[^.]+$/,'')+'.txt','text/plain','Transcript',a.id,created_at);for(let i=0;i<base64.length;i+=131072)db.rows('INSERT INTO candidate_file_chunks VALUES(?,?,?)',fid,i,base64.slice(i,i+131072));s.file_id=fid;db.audit(a,'candidate-file-save',fid,null,{candidate_id:candidate.id,name:s.name,category:'Transcript'});}
  const payload={candidate_id:candidate.id,candidate_version:candidate.version,status:'Draft',...draft,sources:sources.map(({name,file_id,activity_id})=>({name,file_id,activity_id})),created_by:a.id,created_at};write(id,'candidate-summary-draft',payload,null);return {id,draft:{...payload,id,version:1}};
 }
 requireThat(['candidate-summary-save','candidate-summary-publish'].includes(b.action),'Unknown summary action.');
 const existing=b.draft_id?all.find((r:R)=>r.id===b.draft_id&&r.kind==='candidate-summary-draft'&&r.candidate_id===candidate.id):null;
 const draft=b.draft_id?existing:{id:crypto.randomUUID(),candidate_id:candidate.id,status:'Draft',version:0,summary:candidate.executive_summary||'',sources:candidate.executive_summary_sources||[],suggestions:[],excerpts:[],method:'manual-edit',created_at:new Date().toISOString(),created_by:a.id};
 requireThat(draft&&draft.status==='Draft'&&(!b.draft_id||draft.version===Number(b.draft_version)),'Draft changed or was already published. Reload.',409);
 requireThat(typeof b.summary==='string'&&b.summary.trim().length>0&&b.summary.length<=6000,'Enter an executive summary up to 6,000 characters.');
 const tag_values=cleanTagValues(b.tag_values,all,b.verified_geographies||[]),published_at=new Date().toISOString();
 if(b.action==='candidate-summary-save'){const payload={...draft,summary:b.summary.trim(),tag_values,updated_at:published_at,updated_by:a.id};write(draft.id,'candidate-summary-draft',payload,existing);return {id:draft.id,draft:{...payload,version:draft.version+1}};}
 const next={...candidate,executive_summary:b.summary.trim(),executive_summary_by:a.id,executive_summary_at:published_at,executive_summary_sources:draft.sources,tag_values};
 write(candidate.id,'candidate',next,candidate);write(draft.id,'candidate-summary-draft',{...draft,status:'Published',published_by:a.id,published_at,published_summary:b.summary.trim(),published_tags:tag_values},existing);return {id:candidate.id};
}

