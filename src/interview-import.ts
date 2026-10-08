import {pipelineStages} from './engagement-pipeline';
import {createHash} from 'node:crypto';
import {hasPermission} from './access-policy';
import {requireThat} from './domain';
import {linkedinKey} from './candidate-identity';
import {importKey,interviewDate} from './interview-import-file';
import {str} from './mapping-import-file';
type R=Record<string,any>;
const norm=(v:unknown)=>str(v).toLowerCase().replace(/\s+/g,' ');
const hash=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fields=['number','status','date','outcome','feedback','interviewer','cancelled_on','next_step','next_step_date','partner_contact'];
const snapshot=(r:R)=>Object.fromEntries(fields.map(k=>[k,r[k]??'']));
export function planInterviewImport(rows:R[],resolutions:R,searches:R[],records:R[]):R[]{
 requireThat(Array.isArray(rows)&&rows.length>0&&rows.length<=5000,'Import 1–5,000 interview rows.');
 const groups=new Map<string,R[]>();for(const r of rows){requireThat(r&&typeof r==='object'&&Object.values(r).every(v=>str(v).length<=20000),'Invalid or oversized cell.');const k=importKey(r);groups.set(k,[...(groups.get(k)||[]),r]);}
 const candidates=records.filter(r=>r.kind==='candidate'),mapped=new Map(records.filter(r=>r.kind==='mapping').map(r=>[r.role_id+':'+r.candidate_id,r])),engaged=new Map(records.filter(r=>r.kind==='engagement').map(r=>[r.mapping_id,r])),links=new Map(records.filter(r=>r.kind==='interview-import-link').map(r=>[r.source_key,r]));
 const targets=new Set<string>();
 return [...groups].map(([key,items]):R=>{const raw=items[0],resolution=resolutions[key]||{},link=links.get(key),out:R={key,name:raw['Candidate Name'],job:raw['Job Name'],client:raw['Company Name'],rows:items.map(r=>r.row),warnings:[],conflicts:[],search_options:[],candidate_options:[],rounds:[],skipped_rounds:0};try{
  if(resolution.action==='skip')return {...out,result:'Skip'};
  const matches=searches.filter(s=>raw['Search ID']?Number(raw['Search ID'])===s.search_number:norm(s.title)===norm(raw['Job Name'])&&norm(s.client)===norm(raw['Company Name']));
  out.search_options=(matches.length?matches:searches).map(s=>({id:s.id,label:`${s.search_number} · ${s.client} · ${s.title}`}));
  const search=searches.find(s=>s.id===(resolution.role_id||link?.role_id))||(matches.length===1?matches[0]:null);
  if(resolution.role_id&&!searches.some(s=>s.id===resolution.role_id))throw Error('Selected search is not in this workspace.');if(!search)throw Error('Select the matching search.');out.role_id=search.id;out.search_number=search.search_number;
  const urls=[...new Set(items.map(r=>str(r['LinkedIn URL'])).filter(Boolean))];if(urls.length>1)throw Error('Conflicting LinkedIn URLs in this group.');const url=urls[0]?linkedinKey(urls[0]):'';if(urls[0]&&!url)throw Error('Invalid LinkedIn URL.');
  const suggestions=candidates.filter(c=>url?linkedinKey(c.url)===url:norm(c.name)===norm(raw['Candidate Name']));out.candidate_options=suggestions.map(c=>({id:c.id,label:[c.name,c.company,c.title,c.url].filter(Boolean).join(' · ')}));
  const candidate=candidates.find(c=>c.id===(resolution.candidate_id||link?.candidate_id))||(url&&suggestions.length===1?suggestions[0]:null);
  if(!candidate||!(link?.candidate_id===candidate.id||suggestions.some(c=>c.id===candidate.id)))throw Error(suggestions.length?'Confirm the candidate match.':'Import this candidate first, then refresh preview.');
  if(url&&linkedinKey(candidate.url)!==url)throw Error('LinkedIn identity conflicts with the selected candidate.');
  out.candidate_id=candidate.id;const target=search.id+':'+candidate.id;if(targets.has(target))throw Error('Two source groups resolve to the same candidate and search. Consolidate the source rows.');targets.add(target);
  const mapping=mapped.get(target),existing=mapping?engaged.get(mapping.id):null;out.mapping_id=mapping?.id;out.engagement_id=existing?.id;
  const recommendations=[...new Set(items.map(r=>interviewDate(r['Date Recommendation Submitted'])).filter(Boolean))];if(recommendations.length>1)throw Error('Conflicting recommendation dates in this file.');out.recommended_on=recommendations[0]||'';
  const roundMap=new Map<number,R>();
  for(const r of items){const number=Number(str(r['Interview Round']).replace(/^r/i,''));if(!Number.isInteger(number)||number<1||number>50)throw Error('Interview round must be R1–R50.');
   const statusMap:R={'':'Not started','not started':'Not started','to be scheduled':'To be scheduled',scheduled:'Scheduled',completed:'Completed',cancelled:'Cancelled',canceled:'Cancelled',rescheduled:'Rescheduled','feedback pending':'Completed'};
   const outcomeMap:R={'':'Pending',pending:'Pending','no feedback yet':'Pending',positive:'Positive',negative:'Negative',mixed:'Mixed',hold:'Hold',progressing:'Progressing',rejected:'Rejected'};
   const status=statusMap[norm(r['Interview Status'])],outcome=outcomeMap[norm(r['Feedback Outcome'])];if(!status||!outcome)throw Error('Unrecognized interview status or outcome.');
   const round={number,status,outcome,date:interviewDate(r['Interview Date']),cancelled_on:interviewDate(r['Date Cancelled']),feedback:str(r['Feedback Notes']),interviewer:str(r['Interviewer Name']),next_step:str(r['Next Step']),next_step_date:interviewDate(r['Next Step Date']),partner_contact:str(r['Partner Point of Contact'])};
   if(status==='Not started'&&outcome==='Pending'&&!Object.entries(round).some(([k,v])=>!['number','status','outcome','partner_contact'].includes(k)&&v)){out.skipped_rounds++;continue;}
   if(status!=='Completed'&&outcome!=='Pending')out.warnings.push(`R${number}: outcome recorded without Completed status; source values retained.`);
   if(['Completed','Scheduled','Rescheduled'].includes(status)&&!round.date)out.warnings.push(`R${number}: interview date missing.`);if(status==='Cancelled'&&!round.cancelled_on)out.warnings.push(`R${number}: cancellation date unknown.`);
   const duplicate=roundMap.get(number);if(duplicate&&hash(duplicate)!==hash(round))throw Error(`Conflicting duplicate R${number} rows. Correct the file or skip this candidate.`);if(duplicate)out.warnings.push(`Repeated R${number} row skipped.`);roundMap.set(number,round);
  }
  out.rounds=[...roundMap.values()];out.changes=[];
  for(const round of out.rounds){const current=existing?.interviews?.find((i:R)=>i.number===round.number),baseline=link?.rounds?.find((i:R)=>i.number===round.number);
   if(!current){out.changes.push(round);continue;}if(hash(snapshot(current))===hash(snapshot(round)))continue;
   if(baseline&&hash(snapshot(baseline))===hash(snapshot(round)))continue; // Source unchanged; preserve app edits.
   if(!baseline||hash(snapshot(current))!==hash(snapshot(baseline)))out.conflicts.push({field:`Round ${round.number}`,current:snapshot(current),incoming:round});
   out.changes.push({...current,...round,decision_on:current.outcome===round.outcome?current.decision_on||'':''});
  }
  const currentDate=existing?.recommended_on||'',baselineDate=link?.recommended_on||'';
  out.change_date=!!out.recommended_on&&out.recommended_on!==currentDate&&(!link||out.recommended_on!==baselineDate);
  if(out.change_date&&(link?currentDate!==baselineDate:!!currentDate))out.conflicts.push({field:'Recommendation date',current:currentDate,incoming:out.recommended_on});
  if(out.conflicts.length&&resolution.action!=='file')out.needs_choice=true;
  out.result=out.changes.length||out.change_date?'Import':'Unchanged';
  if(!existing&&out.result==='Import'){
   const stages=pipelineStages(records),labels=[...new Set(items.map(r=>str(r['Engagement Stage']||r.CurrentRecruitCRMStage)).filter(Boolean))];
   const initial=stages.find(s=>s.id===resolution.stage_id)||(labels.length===1?stages.find(s=>norm(s.label)===norm(labels[0])):null);
   out.stage_options=stages.map(s=>({id:s.id,label:s.label}));out.initial_stage=initial?.id||'';out.initial_stage_label=initial?.label||'';
   if(!initial){out.needs_choice=true;out.warnings.push('Choose the initial engagement stage for this new interview record.');}
  }
  if(out.result==='Import'&&!mapping)out.warnings.push('Creates a historical search link without inventing sourcing reviews or researcher credit.');
  out.source_context=items.map(r=>({row:r.row,job_status:str(r.Job_Status),crm_stage:str(r.CurrentRecruitCRMStage)}));
  return out;
 }catch(e:any){return {...out,result:'Error',error:e.message};}});
}
export function importInterviews(db:any,a:any,b:R){
 requireThat(hasPermission(a,'integrations.manage'),'Manage integrations permission required.',403);
 const records=db.rows('SELECT * FROM research_records').map((r:R)=>({...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version})),searches=db.rows('SELECT * FROM searches');
 const settings=records.find((r:R)=>r.kind==='interview-import-settings');
 if(b.action==='interview-import-settings'){
  if(b.preview)return {closed:!!settings?.closed,version:settings?.version||0};
  requireThat(Number(b.version)===(settings?.version||0),'Import settings changed. Refresh.',409);
  requireThat(typeof b.closed==='boolean','Choose import status.');save('interview-import-settings','','global',{closed:b.closed},settings);return {closed:b.closed,version:(settings?.version||0)+1};
 }
 requireThat(!settings?.closed,'SharePoint transition is complete. Reopen imports to import another file.',409);
 const plan=planInterviewImport(b.rows,b.resolutions||{},searches,records),signature=hash({plan,versions:records.map((r:R)=>[r.id,r.version]),searches});
 if(b.preview)return {plan,signature};requireThat(signature===b.signature,'Data changed. Refresh preview before importing.',409);requireThat(!plan.some(p=>p.error||p.needs_choice),'Resolve matches and conflicts before importing.');
 const run=crypto.randomUUID(),now=new Date().toISOString();let imported=0,rounds=0;
 function save(kind:string,role:string,key:string,data:R,old?:R){const id=old?.id||crypto.randomUUID(),clean={...data};for(const k of ['id','kind','role_id','version'])delete clean[k];db.rows('INSERT INTO research_records(id,kind,role_id,record_key,data,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version',id,kind,role,key,JSON.stringify(clean),(old?.version||0)+1);db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,a.id,b.action,JSON.stringify({before:old||null,after:clean}),new Date().toISOString());db.audit(a,b.action,id,old||null,clean);return {...clean,id,kind,role_id:role,version:(old?.version||0)+1};}
 for(const p of plan){if(p.result!=='Import')continue;const mapping=records.find((r:R)=>r.id===p.mapping_id)||save('mapping',p.role_id,p.role_id+':'+p.candidate_id,{...Object.fromEntries(['name','url','title','company','location'].map(k=>[k,records.find((r:R)=>r.id===p.candidate_id)?.[k]||''])),candidate_id:p.candidate_id,status:'Imported',source:'SharePoint',imported_at:now,imported_by:a.id,import_run:run});
  const old=records.find((r:R)=>r.id===p.engagement_id),nextRounds:R[]=[...(old?.interviews||[])];for(const r of p.changes){const i=nextRounds.findIndex(v=>v.number===r.number),next={...r,imported_at:now,imported_by:a.id};if(i<0)nextRounds.push(next);else nextRounds[i]=next;rounds++;}
  const next=save('engagement',p.role_id,mapping.id,{...old,mapping_id:mapping.id,candidate_id:p.candidate_id,stage:old?.stage||p.initial_stage_label,stage_id:old?.stage_id||p.initial_stage,stage_at:old?.stage_at||null,recommended_on:p.change_date?p.recommended_on:old?.recommended_on||'',interviews:nextRounds.sort((x,y)=>x.number-y.number)},old);
  const link=records.find((r:R)=>r.kind==='interview-import-link'&&r.source_key===p.key);
  save('interview-import-link',p.role_id,hash(p.key),{source_key:p.key,candidate_id:p.candidate_id,rounds:p.rounds,recommended_on:p.recommended_on,source_context:p.source_context,import_run:run,imported_at:now},link);
  save('candidate-activity',p.role_id,crypto.randomUUID(),{candidate_id:p.candidate_id,mapping_id:mapping.id,type:'Historical interview import',notes:`${p.changes.length} rounds imported. Original dates retained; unknown dates left blank.`,occurred_on:now.slice(0,10),created_at:now,actor_id:a.id,import_run:run},undefined);imported++;
 }
 return {imported,rounds,skipped:plan.length-imported,import_run:run};
}
