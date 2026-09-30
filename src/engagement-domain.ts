import {Actor,hasRole,canPlan,requireThat,text,day,safeLink} from './domain';
import type {Member} from './research';
type R=Record<string,any>;
type DB={rows:(q:string,...p:any[])=>any[];audit:(a:Actor,k:string,id:string,old:any,next:any)=>void};
export const engagementStages=['Ready for outreach','Contacting','Engaged','Screening scheduled','Screened','Recommended to client','Interviewing','Offered','Placed','Candidate declined','Client rejected','Unresponsive','Keep warm'];
export const interactionTypes=['Note','Phone call','Phone message','LinkedIn message','Email','Screening call','Interview','Transcript','Assessment link'];
export const defaultSequence=[{label:'LinkedIn message',channel:'LinkedIn message',delay:0},{label:'Phone follow-up',channel:'Phone call',delay:3},{label:'Email follow-up',channel:'Email',delay:3}];
export const engagementSearchClosed=(status:unknown)=>['closed','abandoned','cancelled','canceled','filled'].includes(String(status||'').trim().toLowerCase());
export const engagementRows=(records:R[],searches:R[]=[]):R[]=>records.filter(m=>m.kind==='mapping'&&(m.status==='Approved'||records.some(e=>e.kind==='engagement'&&e.mapping_id===m.id))).map(m=>({...records.find(e=>e.kind==='engagement'&&e.mapping_id===m.id),mapping_id:m.id,candidate_id:m.candidate_id,role_id:m.role_id,mapping_version:m.version,search_closed:engagementSearchClosed(searches.find(s=>s.id===m.role_id)?.status),approved:m.status==='Approved',stage:records.find(e=>e.kind==='engagement'&&e.mapping_id===m.id)?.stage||'Ready for outreach'}));
const read=(db:DB,id:string)=>{const r=db.rows('SELECT * FROM research_records WHERE id=?',id)[0];return r?{...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version}:null;};
const byKey=(db:DB,kind:string,key:string)=>{const r=db.rows('SELECT id FROM research_records WHERE kind=? AND record_key=?',kind,key)[0];return r?read(db,r.id):null;};
function save(db:DB,a:Actor,kind:string,role:string,key:string,next:R,old:R|null,action:string){const id=old?.id||crypto.randomUUID();const clean={...next};for(const k of ['id','kind','role_id','version'])delete clean[k];db.rows('INSERT INTO research_records(id,kind,role_id,record_key,data,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version',id,kind,role,key,JSON.stringify(clean),(old?.version||0)+1);db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,a.id,action,JSON.stringify({before:old,after:clean}),new Date().toISOString());db.audit(a,action,id,old,clean);return{id};}
export function handoffEngagement(db:DB,a:Actor,m:R){if(m.status!=='Approved'||byKey(db,'engagement',m.id))return;return save(db,a,'engagement',m.role_id,m.id,{mapping_id:m.id,candidate_id:m.candidate_id,stage:'Ready for outreach',team_id:'',owner_id:'',next_action:'',due_date:'',handoff_at:new Date().toISOString(),stage_at:new Date().toISOString(),sequence:[],step_index:0},null,'engagement-handoff');}
export function engagementMutation(db:DB,a:Actor,b:R,members:Member[]){
 const active=members.filter(m=>m.status==='active'),old=b.id?read(db,text(b.id)):null;
 if(b.id)requireThat(old,'Record not found.',404);
 if(old)requireThat(old.version===Number(b.version),'This record changed. Reload before saving.',409);
 const eligible=(id:string)=>active.some(m=>m.id===id&&hasRole(m,'engagement'));
 const team=(id:string)=>{const t=read(db,id);requireThat(t?.kind==='engagement-team','Choose an engagement team.');return t;};
 if(b.action==='engagement-team-save'){
  requireThat(canPlan(a),'Planning permission required.',403);requireThat(!old||old.kind==='engagement-team','Choose an engagement team.');
  const name=text(b.name,100),ids=Array.isArray(b.member_ids)?[...new Set<string>(b.member_ids)]:[];requireThat(name&&ids.length,'Name the team and choose members.');requireThat(ids.every(eligible),'Choose active Engagement members.');requireThat(ids.includes(b.lead_id),'The lead must belong to this engagement team.');
  requireThat(!db.rows("SELECT id FROM research_records WHERE kind='engagement-team' AND lower(json_extract(data,'$.name'))=lower(?) AND id<>?",name,old?.id||'').length,'An engagement team already has this name.');
  return save(db,a,'engagement-team','',old?.id||crypto.randomUUID(),{name,member_ids:ids,lead_id:b.lead_id},old,b.action);
 }
 const role=text(old?.role_id||b.role_id),search=role?db.rows('SELECT * FROM searches WHERE id=?',role)[0]:null;
 if(role)requireThat(search,'Search not found.',404);
 const closed=engagementSearchClosed(search?.status);
 const manager=canPlan(a)||hasRole(a,'partner')&&search?.partner_id===a.id;
 if(b.action==='engagement-sequence-save'){
  requireThat(search&&manager,'Search management permission required.',403);requireThat(!old||old.kind==='engagement-sequence','Choose a sequence.');const existing=byKey(db,'engagement-sequence',role);requireThat(existing?.id===old?.id,'Sequence changed. Reload.',409);
  requireThat(Array.isArray(b.steps)&&b.steps.length>0&&b.steps.length<=30,'Add 1–30 steps.');const steps=b.steps.map((s:R)=>{const label=text(s.label,150),delay=Number(s.delay);requireThat(label&&interactionTypes.includes(s.channel)&&!['Transcript','Assessment link','Note'].includes(s.channel)&&Number.isInteger(delay)&&delay>=0&&delay<=365,'Each step needs a label, outreach channel and delay from 0 to 365 days.');return{label,channel:s.channel,delay};});
  return save(db,a,'engagement-sequence',role,role,{steps},old,b.action);
 }
 if(['candidate-note','candidate-tags'].includes(b.action)){
  const c=read(db,text(b.candidate_id));requireThat(c?.kind==='candidate','Candidate not found.',404);requireThat(canPlan(a)||hasRole(a,'researcher')||hasRole(a,'partner')||hasRole(a,'engagement'),'Candidate editing permission required.',403);
  if(role)requireThat(byKey(db,'mapping',role+':'+c.id),'Candidate is not mapped to this search.');
  if(b.action==='candidate-tags'){requireThat(c.version===Number(b.candidate_version),'Candidate changed. Reload.',409);return save(db,a,'candidate','',c.url,{...c,tags:[...new Set(text(b.tags,2000).split(',').map(t=>t.trim()).filter(Boolean))].slice(0,40)},c,b.action);}
  requireThat(interactionTypes.includes(b.type),'Choose an interaction type.');const notes=text(b.notes,50000);requireThat(notes,'Enter notes or transcript.');const occurred=day(b.occurred_on),url=b.url?safeLink(b.url):'';requireThat(b.type!=='Assessment link'||url,'Add the assessment link.');
  return save(db,a,'candidate-activity',role,crypto.randomUUID(),{candidate_id:c.id,type:b.type,notes,occurred_on:occurred,url,actor_id:a.id,created_at:new Date().toISOString()},null,b.action);
 }
 requireThat(['engagement-assign','engagement-update','engagement-start-sequence','engagement-complete-step'].includes(b.action),'Unknown engagement action.');
 const m=read(db,text(b.mapping_id));requireThat(m?.kind==='mapping','Mapping not found.',404);requireThat(m.status==='Approved','Sourcing approval is required. Engagement is paused while this mapping is reopened.',409);
 requireThat(m.version===Number(b.mapping_version),'Sourcing mapping changed. Reload.',409);requireThat(m.role_id===role,'Search does not match mapping.');
 const existing=byKey(db,'engagement',m.id);requireThat(existing?.id===old?.id&&(!old||old.kind==='engagement'),'Engagement record changed. Reload.',409);
 const current=existing||{mapping_id:m.id,candidate_id:m.candidate_id,stage:'Ready for outreach',team_id:'',owner_id:'',sequence:[],step_index:0,handoff_at:new Date().toISOString(),stage_at:new Date().toISOString()};
 const t=current.team_id?read(db,current.team_id):null;
 const lead=eligible(a.id)&&t?.member_ids?.includes(a.id)&&t.lead_id===a.id;
 const owner=eligible(a.id)&&t?.member_ids?.includes(a.id)&&current.owner_id===a.id;
 if(b.action==='engagement-assign'){
  requireThat(!closed,'This search is closed, abandoned or cancelled. Further engagement assignments are stopped.',409);
  requireThat(manager||lead,'Only the planner, search partner or current engagement lead can assign this candidate.',403);
  const dest=team(text(b.team_id));requireThat(manager||dest.id===t?.id,'Only the planner or search partner can move candidates between teams.',403);requireThat(eligible(b.owner_id)&&dest.member_ids.includes(b.owner_id),'Choose an active member of this engagement team.');
  return save(db,a,'engagement',role,m.id,{...current,team_id:dest.id,owner_id:b.owner_id},existing,b.action);
 }
 requireThat(manager||lead||owner,'This engagement is assigned to another person.',403);
 if(b.action==='engagement-update'){
  requireThat(engagementStages.includes(b.stage),'Choose a hiring stage.');const changed=b.stage!==current.stage;requireThat(!changed||text(b.notes),'Add feedback for this stage change.');
  const next={...current,stage:b.stage,stage_at:changed?new Date().toISOString():current.stage_at,next_action:text(b.next_action,300),due_date:b.due_date?day(b.due_date):''};if(closed||['Placed','Candidate declined','Client rejected'].includes(b.stage)){next.next_action='';next.due_date='';}requireThat(!next.next_action||next.due_date,'Choose a due date for the next action.');
  if(text(b.notes))save(db,a,'candidate-activity',role,crypto.randomUUID(),{candidate_id:m.candidate_id,mapping_id:m.id,type:'Stage update',notes:text(b.notes,10000),from_stage:current.stage,to_stage:b.stage,occurred_on:day(b.occurred_on),actor_id:a.id,created_at:new Date().toISOString()},null,'engagement-feedback');
  return save(db,a,'engagement',role,m.id,next,existing,b.action);
 }
 requireThat(!closed,'This search is closed, abandoned or cancelled. Further outreach is stopped.',409);
 if(b.action==='engagement-start-sequence'){
  requireThat(['Ready for outreach','Contacting','Unresponsive','Keep warm'].includes(current.stage),'Use outreach sequences before screening or client submission.');requireThat(!current.sequence?.length||current.step_index>=current.sequence.length,'Finish the current sequence before starting another.');const sequence=byKey(db,'engagement-sequence',role)?.steps||defaultSequence;const start=day(b.start_date);const due=new Date(start+'T12:00:00Z');due.setUTCDate(due.getUTCDate()+sequence[0].delay);
  return save(db,a,'engagement',role,m.id,{...current,sequence,step_index:0,stage:'Contacting',next_action:sequence[0].label,due_date:due.toISOString().slice(0,10)},existing,b.action);
 }
 requireThat(current.stage==='Contacting','The outreach sequence is paused outside Contacting.');
 const step=current.sequence?.[current.step_index];requireThat(step,'No active sequence step.');const occurred=day(b.occurred_on);requireThat(text(b.notes),'Record the outcome of this outreach.');
 save(db,a,'candidate-activity',role,crypto.randomUUID(),{candidate_id:m.candidate_id,mapping_id:m.id,type:step.channel,notes:text(b.notes,10000),step:step.label,occurred_on:occurred,actor_id:a.id,created_at:new Date().toISOString()},null,'engagement-step-completed');
 const index=current.step_index+1,nextStep=current.sequence[index],due=new Date(occurred+'T12:00:00Z');if(nextStep)due.setUTCDate(due.getUTCDate()+nextStep.delay);
 return save(db,a,'engagement',role,m.id,{...current,step_index:index,next_action:nextStep?.label||'',due_date:nextStep?due.toISOString().slice(0,10):''},existing,b.action);
}
