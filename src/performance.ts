import {effectiveEffort} from './planned-effort';
import {addDays,weekStart} from './planning';
type R=Record<string,any>;
export type PerformanceFilter={from:string;to:string;roles:string[]|null;team:string;staff?:string};
export const mappingDate=(r:R)=>r.work_date||r.created_at?.slice(0,10)||r.submitted_at?.slice(0,10)||'';
const key=(r:R)=>JSON.stringify([r.staff_id,r.work_date,r.role_id||r.search_id,r.team_id]);
export function performanceMetrics(data:R,f:PerformanceFilter){
 const match=(r:R)=> (!f.from||r.work_date>=f.from)&&(!f.to||r.work_date<=f.to)&&(f.roles===null||f.roles.includes(r.role_id||r.search_id))&&(!f.team||r.team_id===f.team)&&(!f.staff||r.staff_id===f.staff);
 const maps=(data.research?.records||[]).filter((r:R)=>r.kind==='mapping'&&match({...r,work_date:mappingDate(r)}));
 const effort=effectiveEffort(data).filter(match),days=effort.reduce((n:number,r:R)=>n+r.days,0);
 const final=maps.filter(partnerDecided),approved=maps.filter((r:R)=>r.status==='Approved').length;
 const pending=maps.filter((r:R)=>['Peer review','Partner review'].includes(r.status)).length,returned=maps.filter((r:R)=>['Needs information','Hold'].includes(r.status)).length;
 const positive=new Set(effort.filter((r:R)=>r.days>0).map(key));
 const expected=new Set<string>(maps.filter((r:R)=>r.submitted_at&&!positive.has(key(r))).map(key));
 const activeDates=new Set<string>([...effort.filter((r:R)=>r.days>0),...maps].map((r:R)=>r.work_date));
 const complete=expected.size===0;
 return {mapped:maps.length,approved,reviewed:final.length,quality:final.length?approved/final.length:null,pending,returned,peerApproved:maps.filter((r:R)=>r.peer_decision==='Approve').length,days,plannedDays:effort.filter((r:R)=>r.source==='plan').reduce((n:number,r:R)=>n+r.days,0),exceptionDays:effort.filter((r:R)=>r.source==='exception').reduce((n:number,r:R)=>n+r.days,0),hours:days*8,hoursPerApproved:days>0&&approved>0?days*8/approved:null,draft:maps.filter((r:R)=>r.status==='Draft').length,missing:expected.size,throughput:complete&&days>0?maps.length/days:null,yield:complete&&days>0?approved/days:null,approvalRatio:maps.length?approved/maps.length:null,activeDays:activeDates.size,perActiveDay:activeDates.size?maps.length/activeDates.size:null};
}
export function searchAge(role:R,records:R[],today:string){
 const elapsed=(date?:string)=>{if(!date)return null;const n=(Date.parse(today+'T00:00:00Z')-Date.parse(date.slice(0,10)+'T00:00:00Z'))/86400000;return Number.isFinite(n)?Math.max(0,Math.floor(n)):null;};
 const first=records.filter(r=>r.kind==='mapping'&&r.role_id===role.id&&r.submitted_at&&r.work_date).map(r=>r.work_date).sort()[0];
 return {age:elapsed(role.start_date),sinceFirst:elapsed(first),first};
}
export function recentWeeks(today:string){const current=weekStart(today);return {current:{from:current,to:today},previous:{from:addDays(current,-7),to:addDays(current,-1)}};}

export function performancePeriod(preset:string,today:string,first:string,from='',to=''){
 const weeks=recentWeeks(today);
 const end=to&&to<today?to:today;
 if(preset==='week')return weeks.current;
 if(preset==='previous')return weeks.previous;
 if(preset==='month')return {from:today.slice(0,7)+'-01',to:today};
 if(preset==='all')return {from:first&&first<today?first:today,to:today};
 if(preset==='custom')return {from:from&&from<=end?from:end,to:end};
 return {from:addDays(today,-29),to:today};
}

/** Exact researcher/date/search/team groups excluded from effort-based rates. */
export function performanceAllocationGaps(data:R,f:PerformanceFilter){
 const effort=effectiveEffort(data),positive=new Set(effort.filter(r=>r.days>0).map(key)),groups=new Map<string,R>();
 for(const r of data.research?.records||[]){
  if(r.kind!=='mapping'||!r.submitted_at||(f.from&&r.work_date<f.from)||(f.to&&r.work_date>f.to)||(f.roles!==null&&!f.roles.includes(r.role_id))||(f.team&&r.team_id!==f.team)||(f.staff&&r.staff_id!==f.staff)||positive.has(key(r)))continue;
  const id=key(r);if(!groups.has(id)){
   const pto=(data.timeOff||[]).some((p:R)=>p.staff_id===r.staff_id&&p.work_date===r.work_date&&p.pto);
   const zero=effort.some(e=>key(e)===id&&e.days===0);
   groups.set(id,{id,staff_id:r.staff_id,role_id:r.role_id,team_id:r.team_id,work_date:r.work_date,mapped:0,reason:pto?'PTO recorded':zero?'Recorded effort is zero':'No matching allocation'});
  }
  groups.get(id)!.mapped++;
 }
 return [...groups.values()].sort((a,b)=>(b.work_date||'').localeCompare(a.work_date||''));
}

/** Period output and current action queues deliberately have different date scopes. */
export function performanceCandidates(data:R,f:PerformanceFilter,statuses:string[]|null=null,current=false):R[]{
 return (data.research?.records||[]).filter((r:R)=>r.kind==='mapping'&&
  (current||((!f.from||mappingDate(r)>=f.from)&&(!f.to||mappingDate(r)<=f.to)))&&
  (f.roles===null||f.roles.includes(r.role_id))&&(!f.team||r.team_id===f.team)&&(!f.staff||r.staff_id===f.staff)&&
  (!statuses||statuses.includes(r.status)));
}

/** Only the current partner decision counts; peer rejection is not a partner decision. */
export function partnerDecided(r:R){return r.status==='Approved'||(r.status==='Rejected'&&r.partner_decision==='Reject');}

/** Compare within each search/team. Keep historical contributors even after roster changes. */
export function researcherComparisons(data:R,f:PerformanceFilter){
 const all=performanceCandidates(data,{...f,staff:undefined});
 const effort=effectiveEffort(data).filter(r=>(!f.from||r.work_date>=f.from)&&(!f.to||r.work_date<=f.to)&&(f.roles===null||f.roles.includes(r.search_id))&&(!f.team||r.team_id===f.team));
 const groups=new Map<string,{role:string;team:string}>();
 const add=(role:string,team:string)=>{if(role&&(f.roles===null||f.roles.includes(role))&&(!f.team||team===f.team))groups.set(JSON.stringify([role,team]),{role,team});};
 all.forEach(r=>add(r.role_id,r.team_id||''));effort.forEach(r=>add(r.search_id,r.team_id||''));
 (data.assignments||[]).filter((r:R)=>(!f.from||r.work_date>=f.from)&&(!f.to||r.work_date<=f.to)).forEach((r:R)=>add(r.search_id,r.team_id||''));
 return [...groups.entries()].map(([id,g])=>{
  // Empty team is an explicit unassigned cohort, never an all-team denominator.
  const scoped={...data,research:{...data.research,records:(data.research?.records||[]).filter((r:R)=>r.kind!=='mapping'||(r.team_id||'')===g.team)}};
  const filter={...f,roles:[g.role],team:g.team,staff:undefined};
  const total=performanceMetrics(scoped,filter);
  const people=new Set<string>([
   ...all.filter(r=>r.role_id===g.role&&(r.team_id||'')===g.team).map(r=>r.staff_id||''),
   ...effort.filter(r=>r.search_id===g.role&&(r.team_id||'')===g.team).map(r=>r.staff_id),
   ...(data.team_members||[]).filter((r:R)=>r.team_id===g.team).map((r:R)=>r.staff_id)
  ]);
  const rows=[...people].filter(staff=>!f.staff||staff===f.staff).map(staff=>{
   const personData=staff?scoped:{...scoped,research:{records:scoped.research.records.filter((r:R)=>!r.staff_id)}};
   const m=performanceMetrics(personData,{...filter,staff:staff||undefined});
   return {id:JSON.stringify([g.role,g.team,staff]),staff,role:g.role,team:g.team,name:(data.staff||[]).find((s:R)=>s.id===staff)?.name||'Unassigned researcher',...m,share:total.mapped?m.mapped/total.mapped:null,approvalShare:total.approved?m.approved/total.approved:null};
  }).sort((a,b)=>b.mapped-a.mapped||a.name.localeCompare(b.name));
  return {id,...g,total,rows};
 }).sort((a,b)=>b.total.mapped-a.total.mapped||a.role.localeCompare(b.role));
}

/** Visual bands only; never change counts, rates, or create a performance target. */
export function percentageTone(value:number|null){return value===null?'neutral':value>=.75?'green':value>=.4?'yellow':'red';}
export function contributionTone(value:number|null,peers:(number|null)[]){
 const max=Math.max(0,...peers.filter((n):n is number=>n!==null));
 return value===null||max===0?'neutral':percentageTone(value/max);
}
export function efficiencyTone(value:number|null,peers:(number|null)[]){
 const valid=peers.filter((n):n is number=>n!==null&&n>0);
 if(value===null||valid.length<2)return 'neutral';
 const lo=Math.min(...valid),hi=Math.max(...valid);
 return hi===lo?'neutral':percentageTone((hi-value)/(hi-lo));
}
