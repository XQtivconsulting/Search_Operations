import {addDays,weekStart} from './planning';
type R=Record<string,any>;
export const sourcingDecisions=['Start','Continue','Recalibrate','Pause','Stop'];
export function effectiveDecision(priorities:R[],role:string,week:string):R|undefined {
 const start=weekStart(week);
 return priorities.filter(p=>p.search_id===role&&p.week<=start).sort((a,b)=>b.week.localeCompare(a.week))[0];
}
export const isWorkingDecision=(decision?:R)=>!!decision&&['Start','Continue','Recalibrate'].includes(decision.disposition);
const easternFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'});
const easternDate=(value:string)=>value?easternFormatter.format(new Date(value)):'';
export type EvidenceGroup='mapped'|'approved'|'pending'|'lastWeek';
export function evidenceMappings(records:R[],roleId:string,week:string,group:EvidenceGroup){
 const previous=addDays(weekStart(week),-7),end=weekStart(week);
 return records.filter(m=>m.kind==='mapping'&&m.role_id===roleId&&(group==='mapped'||group==='approved'&&m.status==='Approved'||group==='pending'&&['Peer review','Partner review'].includes(m.status)||group==='lastWeek'&&(()=>{const date=easternDate(m.created_at);return date>=previous&&date<end;})()));
}
export function sourcingEvidence(records:R[],role:R,week:string,today:string){
 const started=records.find(r=>r.kind==='strategy'&&r.role_id===role.id)?.cutover||role.start_date||'';
 return {mapped:evidenceMappings(records,role.id,week,'mapped').length,approved:evidenceMappings(records,role.id,week,'approved').length,pending:evidenceMappings(records,role.id,week,'pending').length,
 lastWeek:evidenceMappings(records,role.id,week,'lastWeek').length,
 started,weeks:started?Math.max(0,Math.floor((Date.parse(today+'T12:00:00Z')-Date.parse(started+'T12:00:00Z'))/(7*86400000))):null};
}

