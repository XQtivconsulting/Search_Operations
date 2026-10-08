import {actionLabel,isActiveStage,pipelineStages,resolvedStage,stageDays,PipelineStage} from './engagement-pipeline';
import {engagementRows,engagementAssignees} from './engagement-domain';
type R=Record<string,any>;
export const easternDay=(time:number|string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date(time));
export function nextActivity(stage:PipelineStage,stages:PipelineStage[]){
 const index=stages.findIndex(s=>s.id===stage.id),later=index<0?[]:stages.slice(index+1);
 if(stage.group==='Placed')return {label:'Placement completed',target:''};
 if(stage.group==='Exited')return {label:'No active follow-up',target:''};
 if(stage.group==='Top Funnel'||stage.group==='Outreach'){
  const next=(stage.group==='Top Funnel'?stages:later).find(s=>s.group==='Outreach');
  return next?{label:actionLabel(next),target:next.id}:{label:'Review response / decide outreach outcome',target:''};
 }
 if(stage.group==='Engaged'){const screening=stages.find(s=>s.id==='screening'&&s.group==='Screening')||stages.find(s=>s.group==='Screening');return {label:'Arrange initial screening call',target:screening?.id||''};}
 if(stage.group==='Screening')return {label:'Review screening outcome / decide shortlist',target:''};
 if(stage.group==='Shortlist'){const next=later.find(s=>s.group==='Shortlist');return {label:next?actionLabel(next):'Follow up with client on recommendation',target:next?.id||''};}
 return {label:actionLabel(stage),target:''};
}
export function dailyEngagementRows(records:R[],searches:R[],now=Date.now()):R[]{
 const stages=pipelineStages(records);
 return engagementRows(records,searches).filter(r=>r.approved).map((r):R=>{
  const stage=resolvedStage(r,stages),days=stageDays(r,now),active=isActiveStage(stage)&&!r.search_closed,due=active&&stage.threshold>0&&days!==null&&days===stage.threshold;
  const start=Date.parse(r.stage_at||r.handoff_at||'');
  return {...r,group:stage.group,days,threshold:stage.threshold,active,due,overdue:active&&stage.threshold>0&&days!==null&&days>stage.threshold,due_at:active&&stage.threshold>0&&Number.isFinite(start)?new Date(start+stage.threshold*86400000).toISOString():null,newToday:Number.isFinite(Date.parse(r.handoff_at||''))&&easternDay(r.handoff_at)===easternDay(now),members:engagementAssignees(records,r.role_id,stage.group),...nextActivity(stage,stages)};
 }).filter(r=>!r.search_closed||r.group==='Placed').sort((a,b)=>Number(b.overdue)-Number(a.overdue)||Number(b.due)-Number(a.due)||Number(b.newToday)-Number(a.newToday)||(b.days??-1)-(a.days??-1));
}

export const queueLabels:Record<string,string>={all:'All candidates',active:'Active candidates',overdue:'Overdue',due:'Due today',new:'New handoffs today',coming:'Awaiting sourcing partner approval',unscheduled:'Threshold off / age unknown',placed:'Placed'};
export function matchesQueue(row:R|undefined,bucket:string){if(!row)return false;return bucket==='all'?true:bucket==='due'?row.due:bucket==='overdue'?row.overdue:bucket==='new'?row.newToday&&row.active:bucket==='placed'?row.group==='Placed':bucket==='unscheduled'?row.active&&(!row.threshold||row.days===null):row.active;}
