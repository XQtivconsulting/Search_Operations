type Row=Record<string,any>;
/** Potential overlaps, not capacity estimates: tasks have no duration. */
export function planWorkload(data:Row,date:string,teamId:string){
 const assignments=(data.assignments||[]).filter((a:Row)=>a.work_date===date);
 const tasks=(data.research?.records||[]).filter((t:Row)=>t.kind==='task'&&t.work_date===date&& !['Cancelled','Completed'].includes(t.status));
 const work=new Map<string,Set<string>>(),teamStaff=new Set<string>();
 const add=(staff:string,item:string,team:string)=>{if(!staff)return;const items=work.get(staff)||new Set<string>();items.add(item);work.set(staff,items);if(team===teamId)teamStaff.add(staff);};
 for(const a of assignments)for(const e of data.entries||[])if(e.assignment_id===a.id&&e.source!=='candidates')add(e.staff_id,'assignment:'+a.id,a.team_id);
 for(const t of tasks)add(data.people.find((p:Row)=>p.id===t.owner_id)?.staff_id,'task:'+t.id,t.team_id);
 return [...teamStaff].flatMap(staff=>{const count=work.get(staff)!.size,pto=(data.timeOff||[]).some((p:Row)=>p.staff_id===staff&&p.work_date===date&&p.pto);return count>1||pto?[{staff,name:data.staff.find((s:Row)=>s.id===staff)?.name||'Team member',count,pto}]:[];});
}
