type R=Record<string,any>;
// Allocate before filtering: one researcher/date is never multiplied across searches.
export function effectiveEffort(data:R,today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date())):R[]{
 const dayKey=(r:R)=>JSON.stringify([r.staff_id,r.work_date]);
 const pto=new Set((data.timeOff||[]).filter((r:R)=>r.pto).map(dayKey));
 const overrides:R[]=(data.effort||[]).filter((r:R)=>r.work_date<=today&&!pto.has(dayKey(r)));
 const overridden=new Set([...overrides,...(data.effortDays||[])].map(dayKey));
 const people=new Map<string,Set<string>>();
 for(const e of data.entries||[]){if(e.source==='candidates')continue;if(!people.has(e.assignment_id))people.set(e.assignment_id,new Set());people.get(e.assignment_id)!.add(e.staff_id);}
 const days=new Map<string,Map<string,R>>();
 const taskPlans=(data.research?.records||[]).filter((r:R)=>r.kind==='task'&&r.status!=='Cancelled').map((r:R)=>{people.set(r.id,new Set([r.staff_id]));return {id:r.id,search_id:r.role_id,team_id:r.team_id,work_date:r.work_date};});
 for(const a of [...(data.assignments||[]),...taskPlans]){if(a.work_date>today)continue;for(const staff_id of people.get(a.id)||[]){const r={staff_id,work_date:a.work_date,search_id:a.search_id,team_id:a.team_id},d=dayKey(r);if(overridden.has(d)||pto.has(d))continue;if(!days.has(d))days.set(d,new Map());days.get(d)!.set(JSON.stringify([a.search_id,a.team_id]),r);}}
 return [...overrides.map(r=>({...r,source:'exception'})),...[...days.values()].flatMap(pairs=>[...pairs.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,r],i)=>({...r,days:(Math.floor(100/pairs.size)+(i<100%pairs.size?1:0))/100,source:'plan'})))];
}
