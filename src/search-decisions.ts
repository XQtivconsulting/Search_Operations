import {addDays,weekStart} from './planning';
type R=Record<string,any>;
export const sourcingDecisions=['Start','Continue','Recalibrate','Pause','Stop'];
export function effectiveDecision(priorities:R[],role:string,week:string):R|undefined {
 const start=weekStart(week);
 return priorities.filter(p=>p.search_id===role&&p.week<=start).sort((a,b)=>b.week.localeCompare(a.week))[0];
}
export const isWorkingDecision=(decision?:R)=>!!decision&&['Start','Continue','Recalibrate'].includes(decision.disposition);
const easternDate=(value:string)=>value?new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date(value)):'';
export function sourcingEvidence(records:R[],role:R,week:string,today:string){
 const mappings=records.filter(r=>r.kind==='mapping'&&r.role_id===role.id);
 const previous=addDays(weekStart(week),-7),end=weekStart(week);
 const started=records.find(r=>r.kind==='strategy'&&r.role_id===role.id)?.cutover||role.start_date||'';
 return {mapped:mappings.length,approved:mappings.filter(m=>m.status==='Approved').length,pending:mappings.filter(m=>['Peer review','Partner review'].includes(m.status)).length,
 lastWeek:mappings.filter(m=>{const date=easternDate(m.created_at);return date>=previous&&date<end;}).length,
 started,weeks:started?Math.max(0,Math.floor((Date.parse(today+'T12:00:00Z')-Date.parse(started+'T12:00:00Z'))/(7*86400000))):null};
}
