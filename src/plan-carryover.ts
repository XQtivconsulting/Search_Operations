import {addDays,weekStart} from './planning';
import {effectiveDecision,isWorkingDecision} from './search-decisions';
import {searchStatus} from './planning-filters';
type R=Record<string,any>;
export function carryoverAssignments(data:R,week:string,today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date())){
 const start=weekStart(week),previous=addDays(start,-7);
 return data.assignments.filter((a:R)=>a.work_date>=previous&&a.work_date<start).flatMap((a:R)=>{
  const date=addDays(a.work_date,7),search=data.searches.find((s:R)=>s.id===a.search_id),decision=effectiveDecision(data.priorities,a.search_id,start);
  if(date<today||!search||searchStatus(search.status)!=='Open'||!isWorkingDecision(decision)||data.assignments.some((d:R)=>d.search_id===a.search_id&&d.team_id===a.team_id&&d.work_date===date))return [];
  const staff_ids=[...new Set<string>(data.entries.filter((e:R)=>e.assignment_id===a.id&&e.source!=='candidates'&&data.team_members.some((m:R)=>m.team_id===a.team_id&&m.staff_id===e.staff_id)&&!(data.timeOff||[]).some((p:R)=>p.staff_id===e.staff_id&&p.work_date===date&&p.pto)).map((e:R)=>e.staff_id))].sort();
  if(!staff_ids.length)return [];
  return [{source_id:a.id,source_version:a.version,search_id:a.search_id,team_id:a.team_id,work_date:date,target:a.target,notes:a.notes||'',staff_ids,roster_version:data.teams.find((t:R)=>t.id===a.team_id)?.roster_version||0,decision_week:decision!.week,decision_version:decision!.version}];
 }).sort((a:R,b:R)=>a.source_id.localeCompare(b.source_id));
}
