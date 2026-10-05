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

/** Current search/team totals; only periodMappings is limited by mapping creation date. */
export function sourcingProgressRows(data:R,roles:string[]|null,from:string,to:string,today:string):R[]{
 const groups=new Map<string,R>();
 const selected=(id:string)=>roles===null||roles.includes(id);
 const ensure=(search_id:string,team_id='')=>{const id=JSON.stringify([search_id,team_id]);if(!groups.has(id)){const s=data.searches.find((r:R)=>r.id===search_id);if(!s)return null;groups.set(id,{id,search_id,team_id,client:s.client,role:s.title,team:data.teams.find((t:R)=>t.id===team_id)?.name||'Unassigned',allocations:[],mappings:[]});}return groups.get(id)!;};
 for(const a of data.assignments||[])if(selected(a.search_id))ensure(a.search_id,a.team_id||'')?.allocations.push(a);
 for(const m of data.research?.records||[])if(m.kind==='mapping'&&selected(m.role_id))ensure(m.role_id,m.team_id||'')?.mappings.push(m);
 for(const s of data.searches)if(selected(s.id)&&![...groups.values()].some(r=>r.search_id===s.id))ensure(s.id);
 const eastern=(m:R)=>{const value=Date.parse(m.created_at);return Number.isFinite(value)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date(value)):m.work_date||'';};
 return [...groups.values()].map(r=>{const known=r.allocations.filter((a:R)=>a.target!==null&&a.target!==undefined),periodMappings=r.mappings.filter((m:R)=>{const d=eastern(m);return d&&d>=from&&d<=to;}),waitingMappings=r.mappings.filter((m:R)=>['Peer review','Partner review'].includes(m.status)),approvedMappings=r.mappings.filter((m:R)=>m.status==='Approved');
 const attention=[];if(waitingMappings.length)attention.push(`${waitingMappings.length} awaiting review`);
 const dueTarget=known.filter((a:R)=>a.work_date<today).reduce((n:number,a:R)=>n+a.target,0);if(dueTarget>approvedMappings.length)attention.push('Below target due to date');
 return {...r,target:known.length?known.reduce((n:number,a:R)=>n+a.target,0):null,targetIncomplete:known.length<r.allocations.length,mapped:r.mappings.length,periodMapped:periodMappings.length,waiting:waitingMappings.length,partner:approvedMappings.length,periodMappings,waitingMappings,approvedMappings,attention};});
}
