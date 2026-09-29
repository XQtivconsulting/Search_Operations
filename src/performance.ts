import {effectiveEffort} from './planned-effort';
import {addDays,weekStart} from './planning';
type R=Record<string,any>;
export type PerformanceFilter={from:string;to:string;roles:string[]|null;team:string;staff?:string};
const key=(r:R)=>JSON.stringify([r.staff_id,r.work_date,r.role_id||r.search_id,r.team_id]);
export function performanceMetrics(data:R,f:PerformanceFilter){
 const match=(r:R)=> (!f.from||r.work_date>=f.from)&&(!f.to||r.work_date<=f.to)&&(f.roles===null||f.roles.includes(r.role_id||r.search_id))&&(!f.team||r.team_id===f.team)&&(!f.staff||r.staff_id===f.staff);
 const maps=(data.research?.records||[]).filter((r:R)=>r.kind==='mapping'&&r.submitted_at&&match(r));
 const effort=effectiveEffort(data).filter(match),days=effort.reduce((n:number,r:R)=>n+r.days,0);
 const final=maps.filter((r:R)=>['Approved','Rejected'].includes(r.status)),approved=maps.filter((r:R)=>r.status==='Approved').length;
 const pending=maps.filter((r:R)=>['Peer review','Partner review'].includes(r.status)).length,returned=maps.filter((r:R)=>['Needs information','Hold'].includes(r.status)).length;
 const positive=new Set(effort.filter((r:R)=>r.days>0).map(key));
 const expected=new Set<string>(maps.filter((r:R)=>!positive.has(key(r))).map(key));
 const activeDates=new Set<string>([...effort.filter((r:R)=>r.days>0),...maps].map((r:R)=>r.work_date));
 const complete=expected.size===0;
 return {mapped:maps.length,approved,reviewed:final.length,quality:final.length?approved/final.length:null,pending,returned,peerApproved:maps.filter((r:R)=>r.peer_decision==='Approve').length,days,plannedDays:effort.filter((r:R)=>r.source==='plan').reduce((n:number,r:R)=>n+r.days,0),exceptionDays:effort.filter((r:R)=>r.source==='exception').reduce((n:number,r:R)=>n+r.days,0),hours:days*8,missing:expected.size,throughput:complete&&days>0?maps.length/days:null,yield:complete&&days>0?approved/days:null,approvalRatio:maps.length?approved/maps.length:null,activeDays:activeDates.size,perActiveDay:activeDates.size?maps.length/activeDates.size:null};
}
export function searchAge(role:R,records:R[],today:string){
 const elapsed=(date?:string)=>{if(!date)return null;const n=(Date.parse(today+'T00:00:00Z')-Date.parse(date.slice(0,10)+'T00:00:00Z'))/86400000;return Number.isFinite(n)?Math.max(0,Math.floor(n)):null;};
 const first=records.filter(r=>r.kind==='mapping'&&r.role_id===role.id&&r.submitted_at&&r.work_date).map(r=>r.work_date).sort()[0];
 return {age:elapsed(role.start_date),sinceFirst:elapsed(first),first};
}
export function recentWeeks(today:string){const current=weekStart(today);return {current:{from:current,to:today},previous:{from:addDays(current,-7),to:addDays(current,-1)}};}
