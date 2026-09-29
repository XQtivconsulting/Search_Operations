import {dailyRows} from './daily-view';
import {addDays,weekStart} from './planning';
type R=Record<string,any>;
export const reviewStages=['Peer review','Partner review','Needs information','Hold'];
export function deliveryRange(period:string,date:string,today:string){
 const start=period==='week'?weekStart(today):period==='yesterday'?addDays(today,-1):period==='date'?date:today;
 return {from:start,to:period==='week'?addDays(start,6):start};
}
export function reviewPipeline(data:R,roles:string[]|null){
 return (data.research?.records||[]).filter((m:R)=>m.kind==='mapping'&&reviewStages.includes(m.status)&&(roles===null||roles.includes(m.role_id)));
}
export function deliveryRows(data:R,roles:string[]|null,from:string,to:string,today:string):R[]{
 const include=(r:R)=>r.work_date>=from&&r.work_date<=to&&(roles===null||roles.includes(r.search_id));
 const assignments=data.assignments.filter(include);
 const entries=data.entries.filter(include).map((e:R)=>({...e,assignment_id:assignments.some((a:R)=>a.id===e.assignment_id)?e.assignment_id:'delivery:'+JSON.stringify([e.search_id,e.team_id,e.work_date])}));
 return dailyRows(data,assignments,entries).map(r=>{
  const waiting=reviewPipeline(data,[r.search_id]).filter((m:R)=>m.team_id===r.team_id&&m.work_date===r.date&&r.entries.some((e:R)=>e.staff_id===m.staff_id)&&['Peer review','Partner review'].includes(m.status)).length;
  const attention:string[]=[];
  if(r.date<=today&&!r.mapped)attention.push('No mappings yet');
  if(waiting)attention.push(`${waiting} awaiting review`);
  if(r.date<today&&r.target>r.partner)attention.push('Below approval target');
  return {...r,waiting,attention};
 });
}
