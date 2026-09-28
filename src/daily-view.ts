import {aggregate} from './domain';
import {weekStart} from './planning';
type R=Record<string,any>;
export function dailyRows(data:R,assignments:R[],entries:R[]):R[] {
 const by=(rows:R[])=>Object.fromEntries(rows.map(r=>[r.id,r]));
 const searches=by(data.searches),teams=by(data.teams),staff=by(data.staff);
 const map=new Map<string,R>(assignments.map(a=>[a.id,{...a,entries:[] as R[]}]));
 for(const e of entries){if(!map.has(e.assignment_id))map.set(e.assignment_id,{id:e.assignment_id,search_id:e.search_id,team_id:e.team_id,work_date:e.work_date,target:null,entries:[]});map.get(e.assignment_id)!.entries.push(e);}
 return [...map.values()].map(a=>{const s=searches[a.search_id]||{},m=aggregate(a.entries as any),has=a.entries.some((e:R)=>e.mapped!==null);return {...a,date:a.work_date,week:weekStart(a.work_date),team:teams[a.team_id]?.name||'Unassigned',role:s.title||'Unknown role',client:s.client||'Unknown client',partnerName:s.partner||'Unassigned',researchers:[...new Set(a.entries.map((e:R)=>staff[e.staff_id]?.name||'Unassigned'))].join(', '),...m,hasOutput:has};});
}
export function dailyGroups(rows:R[],group:string,sort:string,descending:boolean){const map=new Map<string,R[]>();for(const r of rows){const key=group==='none'?'All work':String(r[group]);map.set(key,[...(map.get(key)||[]),r]);}const compare=(a:any,b:any)=>String(a??'').localeCompare(String(b??''),undefined,{numeric:true,sensitivity:'base'});return [...map.entries()].sort(([a],[b])=>compare(a,b)*(group===sort&&descending?-1:1)).map(([label,items])=>({label,rows:items.sort((a,b)=>(typeof a[sort]==='number'&&typeof b[sort]==='number'?a[sort]-b[sort]:compare(a[sort],b[sort]))*(descending?-1:1)||compare(a.role,b.role)||compare(a.id,b.id)),totals:aggregate(items.flatMap(r=>r.entries) as any)}));}
