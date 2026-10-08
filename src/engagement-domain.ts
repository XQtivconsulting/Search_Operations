import {canReceiveEngagementAssignment} from './engagement-assignment';
import {hasPermission} from './access-policy';
import {authorizeResearch} from './operation-permissions';
import {cleanTagValues,normTag} from './candidate-tags';
import {summarizeTranscript} from './transcript-summary';
import {interviewStatuses,interviewOutcomes} from './interviews';
import {defaultPipeline,normalizeStages,pipelineStages,resolvedStage,stageId,stageDays,funnelGroups} from './engagement-pipeline';
import {Actor,hasRole,canPlan,requireThat,text,day,safeLink} from './domain';
import type {Member} from './research';
type R=Record<string,any>;
type DB={rows:(q:string,...p:any[])=>any[];audit:(a:Actor,k:string,id:string,old:any,next:any)=>void};
export const interactionTypes=['Note','Phone call','Phone message','LinkedIn message','Email','Screening call','Interview','Transcript','Assessment link'];
export const engagementSearchClosed=(status:unknown)=>['closed','abandoned','cancelled','canceled','filled','placed'].includes(String(status||'').trim().toLowerCase());
export const engagementAssignees=(records:R[],role:string,group?:string):string[]=>{
 const assignment=records.find(r=>r.kind==='engagement-assignment'&&r.role_id===role);
 if(!assignment)return [];
 if(assignment.group_member_ids)return [...new Set<string>([...(assignment.member_ids||[]),...Object.values(assignment.group_member_ids).flat() as string[]])];
 return assignment.member_ids||[];
};
export const engagementReady=(m:R)=>m.status==='Approved'||m.status==='Imported'&&['RecruitCRM','SharePoint'].includes(m.source);
export const engagementRows=(records:R[],searches:R[]=[]):R[]=>{
 const stages=pipelineStages(records),searchById=new Map(searches.map(s=>[s.id,s])),byMapping=new Map<string,R>();
 for(const r of records)if(r.kind==='engagement'&&!byMapping.has(r.mapping_id))byMapping.set(r.mapping_id,r);
 return records.filter(m=>m.kind==='mapping'&&(engagementReady(m)||byMapping.has(m.id))).map(m=>{
  const e=byMapping.get(m.id),stage=resolvedStage(e||{stage:'Assigned',stage_id:'assigned'},stages);
  return {...e,mapping_id:m.id,candidate_id:m.candidate_id,role_id:m.role_id,mapping_version:m.version,search_closed:engagementSearchClosed(searchById.get(m.role_id)?.status),approved:engagementReady(m),stage:stage.label,stage_id:stage.id};
 });
};
const read=(db:DB,id:string)=>{const r=db.rows('SELECT * FROM research_records WHERE id=?',id)[0];return r?{...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version}:null;};
const byKey=(db:DB,kind:string,key:string)=>{const r=db.rows('SELECT id FROM research_records WHERE kind=? AND record_key=?',kind,key)[0];return r?read(db,r.id):null;};
function save(db:DB,a:Actor,kind:string,role:string,key:string,next:R,old:R|null,action:string){const id=old?.id||crypto.randomUUID();const clean={...next};for(const k of ['id','kind','role_id','version'])delete clean[k];db.rows('INSERT INTO research_records(id,kind,role_id,record_key,data,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version',id,kind,role,key,JSON.stringify(clean),(old?.version||0)+1);db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,a.id,action,JSON.stringify({before:old,after:clean}),new Date().toISOString());db.audit(a,action,id,old,clean);return{id};}
export function handoffEngagement(db:DB,a:Actor,m:R){if(m.status!=='Approved'||byKey(db,'engagement',m.id))return;const stages=normalizeStages(byKey(db,'engagement-pipeline','global')?.stages||defaultPipeline),id='assigned',stage=stages.find((s:R)=>s.id===id)!;return save(db,a,'engagement',m.role_id,m.id,{mapping_id:m.id,candidate_id:m.candidate_id,stage:stage.label,stage_id:id,handoff_at:new Date().toISOString(),stage_at:new Date().toISOString()},null,'engagement-handoff');}
export function engagementMutation(db:DB,a:Actor,b:R,members:Member[]){
 a=authorizeResearch(db,a,b);

 if(b.action==='engagement-pipeline-save'){
  requireThat(hasRole(a,'admin'),'Administrator permission required.',403);
  const existing=byKey(db,'engagement-pipeline','global');requireThat(existing?.id===b.id&&(!existing||existing.version===Number(b.version)),'Pipeline changed. Reload before saving.',409);
  requireThat(Array.isArray(b.stages)&&b.stages.length>=2&&b.stages.length<=80,'Configure 2–80 stages.');
  const stages=b.stages.map((s:R)=>{const id=text(s.id,80),label=text(s.label,120),threshold=Number(s.threshold);requireThat(/^[a-z0-9-]+$/.test(id)&&label&&funnelGroups.includes(s.group)&&Number.isInteger(threshold)&&threshold>=0&&threshold<=365,'Each stage needs a unique ID, label, funnel group and threshold of 0–365 days.');requireThat(id!=='ready','Ready for outreach has been replaced by Assigned.');return{id,label,group:s.group,threshold:['Placed','Exited'].includes(s.group)?0:threshold,action_label:text(s.action_label,160)};});
  requireThat(new Set(stages.map((s:R)=>s.id)).size===stages.length&&new Set(stages.map((s:R)=>s.label.toLowerCase())).size===stages.length,'Stage IDs and names must be unique.');
  requireThat(stages.some((s:R)=>s.id==='assigned'&&s.group==='Top Funnel'),'Keep Assigned in Top Funnel.');
  requireThat(stages[0].id==='assigned','Assigned must be the first stage.');
  const occupied=db.rows("SELECT data FROM research_records WHERE kind='engagement'").map(r=>JSON.parse(r.data));
  const prior=existing?.stages||defaultPipeline;
  requireThat(occupied.every(r=>!prior.some((s:R)=>s.id===stageId(r))||stages.some((s:R)=>s.id===stageId(r))),'Move candidates out of a stage before removing it.');
  return save(db,a,'engagement-pipeline','','global',{stages},existing,b.action);
 }
 const active=members.filter(m=>m.status==='active'),old=b.id?read(db,text(b.id)):null;
 if(b.id)requireThat(old,'Record not found.',404);
 if(old)requireThat(old.version===Number(b.version),'This record changed. Reload before saving.',409);
 const eligible=(id:string)=>active.some(m=>m.id===id&&canReceiveEngagementAssignment(m));
 if(b.action==='engagement-team-save')requireThat(false,'Engagement teams are retired. Assign people directly to a search.',410);

 const role=text(old?.role_id||b.role_id),search=role?db.rows('SELECT * FROM searches WHERE id=?',role)[0]:null;
 if(role)requireThat(search,'Search not found.',404);
 const closed=engagementSearchClosed(search?.status);
 const manager=Array.isArray(a.permissions)?hasPermission(a,'engagement.assign'):canPlan(a)||hasRole(a,'partner')&&search?.partner_id===a.id;
 if(b.action==='engagement-search-assign'){
  requireThat(search&&manager,'Only the planner or search partner can assign engagement work for this search.',403);
  requireThat(!closed,'This search is closed, abandoned or cancelled. Further engagement assignments are stopped.',409);
  requireThat(!old||old.kind==='engagement-assignment','Choose a search assignment.');const existing=byKey(db,'engagement-assignment',role);requireThat(existing?.id===old?.id,'Search assignment changed. Reload.',409);
  requireThat(b.group_member_ids===undefined,'Funnel assignment is retired. Reload and assign people to the search.',409);
  requireThat(Array.isArray(b.member_ids),'Choose engagement members.');
  const ids=[...new Set<string>(b.member_ids)];requireThat(ids.every(id=>typeof id==='string'&&eligible(id)),'Choose active Engagement members.');
  const result=save(db,a,'engagement-assignment',role,role,{member_ids:ids},existing,b.action);
  if(ids.length)for(const row of db.rows("SELECT id FROM research_records WHERE kind='mapping' AND role_id=? AND json_extract(data,'$.status')='Approved'",role))handoffEngagement(db,a,read(db,row.id));
  return result;
 }
 if(['candidate-note','candidate-tags','candidate-compensation','candidate-attributes'].includes(b.action)){
  const c=read(db,text(b.candidate_id));requireThat(c?.kind==='candidate','Candidate not found.',404);requireThat(canPlan(a)||hasRole(a,'data_quality')||hasRole(a,'researcher')||hasRole(a,'partner')||hasRole(a,'engagement'),'Candidate editing permission required.',403);
  if(role)requireThat(byKey(db,'mapping',role+':'+c.id),'Candidate is not mapped to this search.');
  if(b.action==='candidate-attributes'){
   requireThat(c.version===Number(b.candidate_version),'Candidate changed. Reload.',409);
   const age=b.age===''||b.age===null?null:Number(b.age);
   requireThat(age===null||Number.isInteger(age)&&age>=0&&age<=120,'Age must be a whole number from 0 to 120.');
   requireThat(['','Female','Male','Non-binary','Self-described','Prefer not to say'].includes(b.gender),'Choose a gender.');
   return save(db,a,'candidate','',c.url||'recruitcrm:'+c.crm_ids?.[0],{...c,age,gender:b.gender,attributes_updated_by:a.id,attributes_updated_at:new Date().toISOString()},c,b.action);
  }
  if(b.action==='candidate-compensation'){
   requireThat(c.version===Number(b.candidate_version),'Candidate changed. Reload.',409);
   requireThat(typeof b.compensation_details==='string'&&b.compensation_details.length<=10000,'Compensation details must be up to 10,000 characters.');
   return save(db,a,'candidate','',c.url||'recruitcrm:'+c.crm_ids?.[0],{...c,compensation_details:b.compensation_details.trim(),compensation_details_by:a.id,compensation_details_at:new Date().toISOString()},c,b.action);
  }
  if(b.action==='candidate-tags'){
   requireThat(c.version===Number(b.candidate_version),'Candidate changed. Reload.',409);
   const records=db.rows('SELECT * FROM research_records').map((r:any)=>({...JSON.parse(r.data),kind:r.kind})),tag_values=cleanTagValues(b.tag_values,records,b.verified_geographies||[]);
   for(const [category,values] of Object.entries(tag_values))for(const label of values){const key=category+':'+normTag(label);if(!byKey(db,'candidate-tag-value',key))save(db,a,'candidate-tag-value','',key,{category,label},null,'candidate-tag-value-add');}
   return save(db,a,'candidate','',c.url||'recruitcrm:'+c.crm_ids?.[0],{...c,tag_values},c,b.action);
  }
  requireThat(interactionTypes.includes(b.type),'Choose an interaction type.');const notes=text(b.notes,50000);requireThat(notes,'Enter notes or transcript.');const occurred=day(b.occurred_on||new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date())),url=b.url?safeLink(b.url):'';requireThat(b.type!=='Assessment link'||url,'Add the assessment link.');
  requireThat(b.note_group===undefined||['Interview notes','General notes'].includes(b.note_group),'Choose Interview notes or General notes. Stage updates are recorded by the pipeline.');
  const note_group=['Interview','Screening call'].includes(b.type)?'Interview notes':b.note_group||'General notes';
  return save(db,a,'candidate-activity',role,crypto.randomUUID(),{candidate_id:c.id,type:b.type,note_group,notes,...(b.type==='Transcript'?{transcript_summary:summarizeTranscript(notes),summary_method:'source-excerpts-v1'}:{}),occurred_on:occurred,url,actor_id:a.id,created_at:new Date().toISOString()},null,b.action);
 }
 requireThat(['engagement-update','engagement-interview-save'].includes(b.action),'Unknown engagement action.');
 const m=read(db,text(b.mapping_id));requireThat(m?.kind==='mapping','Mapping not found.',404);requireThat(engagementReady(m),'Sourcing approval is required. Engagement is paused while this mapping is reopened.',409);
 requireThat(m.version===Number(b.mapping_version),'Sourcing mapping changed. Reload.',409);requireThat(m.role_id===role,'Search does not match mapping.');
 const existing=byKey(db,'engagement',m.id);requireThat(existing?.id===old?.id&&(!old||old.kind==='engagement'),'Engagement record changed. Reload.',409);
 const current=existing||{mapping_id:m.id,candidate_id:m.candidate_id,stage:'Assigned',stage_id:'assigned',handoff_at:null,stage_at:null};
 const assignment=byKey(db,'engagement-assignment',role);

 const config=byKey(db,'engagement-pipeline','global'),stages=normalizeStages(config?.stages||defaultPipeline);
 requireThat(Number(b.pipeline_version||0)===Number(config?.version||0),'Pipeline configuration changed. Reload before moving this candidate.',409);
 const from=resolvedStage(current,stages),requested=b.action==='engagement-interview-save'?from.id:(b.stage_id==='ready'?'assigned':b.stage_id)||stageId(b)||from.id,target=stages.find((s:R)=>s.id===requested)||(requested===from.id?from:null);
 requireThat(manager||eligible(a.id)&&engagementAssignees(assignment?[assignment]:[],role,from.group).includes(a.id),'This search is not assigned to you for engagement.',403);
 requireThat(target,'Choose a configured pipeline stage.');const changed=target.id!==from.id;
 requireThat(!closed||!changed||['Exited','Placed'].includes(target.group),'This search is closed. Further outreach is stopped; record an outcome instead.',409);
 requireThat(b.action==='engagement-interview-save'||text(b.notes),'Add a note describing what happened and why you are moving the candidate.');
 const recommended=b.action==='engagement-interview-save'||b.recommended_on===undefined?current.recommended_on||'':b.recommended_on?day(b.recommended_on):'';
 requireThat(!(changed&&target.id==='recommended')||recommended,'Enter the actual date recommended to the client.');
 const rounds:R[]=[...(current.interviews||[])];let round:R|null=null;
 if(b.action==='engagement-interview-save'){
  const input=b.interview||{},number=Number(input.number),status=text(input.status),outcome=text(input.outcome);
  requireThat(Number.isInteger(number)&&number>=1&&number<=50,'Choose an interview round from 1 to 50.');
  requireThat(interviewStatuses.includes(status)&&interviewOutcomes.includes(outcome),'Choose a valid interview status and outcome.');
  requireThat(outcome==='Pending'||status==='Completed','Record the interview as completed before recording its outcome.');
  const previous=rounds.find(r=>r.number===number),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
  const date=input.date?day(input.date):'',decision_on=outcome==='Pending'?'':input.decision_on?day(input.decision_on):previous?.outcome===outcome&&previous?.decision_on?previous.decision_on:today,cancelled_on=status==='Cancelled'&&input.cancelled_on?day(input.cancelled_on):'';
  requireThat(status!=='Cancelled'||cancelled_on,'Enter the cancellation date.');
  requireThat(!['Scheduled','Rescheduled','Completed'].includes(status)||date,'Enter the interview date.');
  requireThat(outcome==='Pending'||decision_on,'Enter the outcome date.');
  requireThat(!decision_on||!date||decision_on>=date,'Outcome date cannot precede the interview.');
  requireThat(!closed||!['Scheduled','Rescheduled','To be scheduled'].includes(status),'This search is closed. New interviews cannot be scheduled.',409);
  round={...previous,number,status,outcome,date,decision_on,cancelled_on,interviewer:input.interviewer===undefined?previous?.interviewer||'':text(input.interviewer,300),feedback:text(b.notes,10000)||previous?.feedback||'',updated_at:new Date().toISOString(),actor_id:a.id};
  const i=rounds.findIndex(r=>r.number===number);if(i<0)rounds.push(round);else rounds[i]=round;rounds.sort((a,b)=>a.number-b.number);
 }
 const now=new Date().toISOString();
 const next={...current,stage:target.label,stage_id:target.id,stage_at:changed?now:current.stage_at,next_action:'',due_date:'',recommended_on:recommended,interviews:rounds};
 save(db,a,'candidate-activity',role,crypto.randomUUID(),{candidate_id:m.candidate_id,mapping_id:m.id,type:round?`Interview · R${round.number}`:changed?'Stage update':'Note',interview:round,recommended_on:recommended,notes:text(b.notes,10000),from_stage:from.label,to_stage:target.label,from_stage_id:from.id,to_stage_id:target.id,stage_entered_at:current.stage_at||current.handoff_at||null,stage_left_at:changed?now:null,days_in_previous_stage:changed?stageDays(current):null,occurred_on:round?new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date()):day(b.occurred_on),actor_id:a.id,created_at:now},null,'engagement-feedback');
 return save(db,a,'engagement',role,m.id,next,existing,b.action);
}

