type R=Record<string,any>;
export const allocationKey=(search:unknown,team:unknown,date:unknown)=>JSON.stringify([search,team,date]);
/** One pass over each input; same preservation rules as assignmentHasWork. */
export function assignmentWorkIds(assignments:R[],entries:R[],records:R[],effort:R[],reviewedIds:R[]){
 const protectedIds=new Set<string>(reviewedIds.map(r=>r.assignment_id));
 const protectedDays=new Set<string>();
 for(const e of effort)if(e.days>0)protectedDays.add(allocationKey(e.search_id,e.team_id,e.work_date));
 for(const r of records)if(r.kind==='mapping')protectedDays.add(allocationKey(r.role_id,r.team_id,r.work_date));
 for(const e of entries)if(e.mapped!==null&&e.mapped!==undefined||e.peer!==null&&e.peer!==undefined||e.partner!==null&&e.partner!==undefined||!!e.notes||e.flag!==null&&e.flag!==undefined||e.source!=='manual')protectedIds.add(e.assignment_id);
 for(const a of assignments)if(protectedDays.has(allocationKey(a.search_id,a.team_id,a.work_date)))protectedIds.add(a.id);
 return protectedIds;
}
export function groupBy<T extends R>(rows:T[],key:(r:T)=>string):Map<string,T[]>{
 const groups=new Map<string,T[]>();for(const r of rows){const k=key(r),group=groups.get(k);if(group)group.push(r);else groups.set(k,[r]);}return groups;
}

