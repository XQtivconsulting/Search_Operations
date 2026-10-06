type Row=Record<string,any>;
type Warning={staff:string;name:string;count:number;pto:boolean};
/** Build once for a workspace snapshot, then look up each date/team in constant time. */
export function workloadIndex(data:Row){
 const assignments=new Map<string,Row>((data.assignments||[]).map((a:Row)=>[a.id,a]));
 const people=new Map<string,string>((data.people||[]).map((p:Row)=>[p.id,p.staff_id]));
 const names=new Map<string,string>((data.staff||[]).map((s:Row)=>[s.id,s.name]));
 const work=new Map<string,Map<string,Set<string>>>(),teams=new Map<string,Map<string,Set<string>>>();
 const add=(date:string,staff:string,item:string,team:string)=>{
  if(!staff)return;
  if(!work.has(date))work.set(date,new Map());const byStaff=work.get(date)!;
  if(!byStaff.has(staff))byStaff.set(staff,new Set());byStaff.get(staff)!.add(item);
  if(!teams.has(date))teams.set(date,new Map());const byTeam=teams.get(date)!;
  if(!byTeam.has(team))byTeam.set(team,new Set());byTeam.get(team)!.add(staff);
 };
 for(const e of data.entries||[]){const a=assignments.get(e.assignment_id);if(a&&e.source!=='candidates')add(a.work_date,e.staff_id,'assignment:'+a.id,a.team_id);}
 for(const t of data.research?.records||[])if(t.kind==='task'&&!['Cancelled','Completed'].includes(t.status))add(t.work_date,people.get(t.owner_id)||'','task:'+t.id,t.team_id);
 const pto=new Set((data.timeOff||[]).filter((p:Row)=>p.pto).map((p:Row)=>JSON.stringify([p.work_date,p.staff_id])));
 const warnings=new Map<string,Map<string,Warning[]>>();
 for(const [date,byTeam] of teams){const indexed=new Map<string,Warning[]>();warnings.set(date,indexed);
  for(const [team,staffs] of byTeam)indexed.set(team,[...staffs].flatMap(staff=>{const count=work.get(date)!.get(staff)!.size,onPTO=pto.has(JSON.stringify([date,staff]));return count>1||onPTO?[{staff,name:names.get(staff)||'Team member',count,pto:onPTO}]:[];}));
 }
 return (date:string,team:string):Warning[]=>warnings.get(date)?.get(team)||[];
}
export function planWorkload(data:Row,date:string,teamId:string){return workloadIndex(data)(date,teamId);}

