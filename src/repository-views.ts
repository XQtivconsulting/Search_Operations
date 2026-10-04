import {hasRole} from './domain';
type R=Record<string,any>;
export function assignedSearchIds(data:R){
 const actor=data.actor,records:R[]=data.research?.records||[],ids=new Set<string>();
 for(const r of records)if((r.kind==='target'||r.kind==='task')&&r.owner_id===actor.id&&r.status!=='Cancelled')ids.add(r.role_id);
 for(const a of data.assignments||[])if((data.entries||[]).some((e:R)=>e.assignment_id===a.id&&e.staff_id===actor.staffId))ids.add(a.search_id);
 for(const s of data.searches||[])if(s.partner_id===actor.id&&hasRole(actor,'partner'))ids.add(s.id);
 return ids;
}
export const researchStatus=(status:string)=>status==='Blocked'?'Need help':status==='No relevant talent'?'Completed':status==='Partially mapped'||status==='Revisit required'?'In progress':status;
