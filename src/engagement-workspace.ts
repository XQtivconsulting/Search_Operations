import {engagementRows,engagementAssignees,engagementSearchClosed} from './engagement-domain';
import {pipelineStages,resolvedStage,isActiveStage,stageOverdue} from './engagement-pipeline';
import {nextActivity} from './engagement-daily';
type R=Record<string,any>;
/** All mappings remain visible; sourcing approval still controls every engagement mutation. */
export function searchEngagementRows(records:R[],searches:R[],now=Date.now()):R[]{
 const stages=pipelineStages(records),engagement=new Map(engagementRows(records,searches).map(r=>[r.mapping_id,r]));
 return records.filter(r=>r.kind==='mapping').map(m=>{
  const existing=engagement.get(m.id),pending=!existing;
  const row=existing||{mapping_id:m.id,candidate_id:m.candidate_id,role_id:m.role_id,approved:false,search_closed:engagementSearchClosed(searches.find(s=>s.id===m.role_id)?.status)};
  const stage=pending?null:resolvedStage(row,stages),active=!!stage&&row.approved&&!row.search_closed&&isActiveStage(stage);
  return {...row,pending,sourcing_status:m.status,stage_id:stage?.id||'pending-sourcing',stage:stage?.label||'Awaiting sourcing approval',group:stage?.group||'Sourcing',active,attention:active&&stageOverdue(row,stage!,now),members:stage?engagementAssignees(records,m.role_id,stage.group):[],next_action:pending?'Complete sourcing approval':!row.approved?'Resolve reopened sourcing review':row.search_closed?'Search closed · review outcome':nextActivity(stage!,stages).label};
 });
}
/** Never mix a candidate's notes from other searches into this search's timeline. */
export function searchEngagementActivity(records:R[],role:string,candidate?:string):R[]{
 return records.filter(r=>r.kind==='candidate-activity'&&r.role_id===role&&(!candidate||r.candidate_id===candidate)).sort((a,b)=>String(b.occurred_on||b.created_at||'').localeCompare(String(a.occurred_on||a.created_at||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
}
