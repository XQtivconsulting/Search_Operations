import {effectiveEffort} from './planned-effort';
import {hoursPerPersonDay} from './sourcing-settings';
import {addDays} from './planning';
type R=Record<string,any>;
export const monitorPeriods=[['all','Since search began'],['yesterday','Yesterday'],['today','Today'],['custom','Custom date range']];
export function monitorRange(period:string,today:string,from='',to=''){if(period==='all')return {from:'',to:today};if(period==='custom'){const end=to&&to<today?to:today;return {from:from&&from<=end?from:end,to:end};}const date=period==='today'?today:addDays(today,-1);return {from:date,to:date};}
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'});
export const monitorDate=(value:string)=>{if(!value)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const d=new Date(value);return Number.isFinite(d.getTime())?dayFormatter.format(d):'';};
const mappedDate=(m:R)=>monitorDate(m.created_at)||monitorDate(m.work_date);
const age=(date:string,today:string)=>Math.max(0,Math.floor((Date.parse(today)-Date.parse(date))/86400000));
export function sourcingMonitorRows(data:R,roles:string[]|null,from:string,to:string,today:string,team=''):R[]{
 const factor=hoursPerPersonDay(data),staff=new Map((data.staff||[]).map((p:R)=>[p.id,p.name])),accounts=new Map((data.people||[]).map((p:R)=>[p.id,p.staff_id||p.staffId||'']));
 const owner=(m:R)=>m.staff_id||accounts.get(m.mapper_id)||'';
 const groups=new Map<string,R>();for(const s of data.searches||[])if(roles===null||roles.includes(s.id))groups.set(s.id,{id:s.id,search_number:s.search_number,role:s.title,client:s.client,status:s.status,mappings:[],allocations:[],effort:[]});
 for(const a of data.assignments||[])if(a.work_date<=today&&(!team||a.team_id===team))groups.get(a.search_id)?.allocations.push(a);
 for(const m of data.research?.records||[])if(m.kind==='mapping'&&(!mappedDate(m)||mappedDate(m)<=today)&&(!team||m.team_id===team))groups.get(m.role_id)?.mappings.push(m);
 for(const e of effectiveEffort(data,today))if(!team||e.team_id===team)groups.get(e.search_id)?.effort.push(e);
 const metrics=(maps:R[],effort:R[],allocations:R[],individual=false):R=>{
  const approved=maps.filter(m=>m.status==='Approved'),pending=maps.filter(m=>!['Approved','Rejected'].includes(m.status)),known=allocations.filter(a=>a.target!==null&&a.target!==undefined),target=individual?null:known.length?known.reduce((n,a)=>n+Number(a.target),0):null;
  const hours=effort.reduce((n,e)=>n+e.days*factor,0),dates=maps.map(mappedDate).filter(Boolean).sort(),personDays=new Set([...effort.filter(e=>e.days>0).map(e=>JSON.stringify([e.staff_id,e.work_date])),...maps.filter(m=>mappedDate(m)&&owner(m)).map(m=>JSON.stringify([owner(m),mappedDate(m)]))]).size;
  const matured=maps.filter(m=>mappedDate(m)&&mappedDate(m)<=addDays(today,-3)),unresolvedMatured=matured.filter(m=>!['Approved','Rejected'].includes(m.status));
  return {mappings:maps,approvedMappings:approved,waitingMappings:pending,mapped:maps.length,approved:approved.length,waiting:pending.length,rejected:maps.filter(m=>m.status==='Rejected').length,hours,target,targetIncomplete:known.length<allocations.length,throughput:target!==null&&target>0?approved.length/target:null,quality:maps.length?approved.length/maps.length:null,provisional:pending.length>0,mappingsPerPersonDay:personDays?maps.filter(m=>mappedDate(m)&&owner(m)).length/personDays:null,personDays,firstMap:dates[0]||'',daysSinceFirstMap:dates.length?age(dates[0],today):null,lastMap:dates.at(-1)||'',idleDays:dates.length?age(dates.at(-1)!,today):null,oldestPending:pending.map(mappedDate).filter(Boolean).reduce((n,d)=>Math.max(n,age(d,today)),0),unknownMappingDates:maps.filter(m=>!mappedDate(m)).length,matured,unresolvedMatured,effort};
 };
 return [...groups.values()].filter(g=>!team||g.mappings.length||g.effort.length||g.allocations.length).map(g=>{
  const all=metrics(g.mappings,g.effort,g.allocations),inPeriod=(d:string)=>!!d&&(!from||d>=from)&&d<=to;
  const researchers=(maps:R[],effort:R[],total:R)=>{const people=new Map<string,{maps:R[];effort:R[]}>();const person=(id:string)=>{if(!people.has(id))people.set(id,{maps:[],effort:[]});return people.get(id)!;};for(const m of maps)person(owner(m)).maps.push(m);for(const e of effort)person(e.staff_id||'').effort.push(e);return [...people].map(([id,p])=>({id,name:staff.get(id)||'Unattributed',...metrics(p.maps,p.effort,[],true),mappingShare:total.mapped?p.maps.length/total.mapped:null,approvalShare:total.approved?p.maps.filter(m=>m.status==='Approved').length/total.approved:null})).sort((a:R,b:R)=>b.mapped-a.mapped||String(a.name).localeCompare(String(b.name)));};
  const dates=[...new Set([...g.mappings.map(mappedDate),...g.effort.map((e:R)=>e.work_date),...g.allocations.map((a:R)=>a.work_date)].filter(Boolean))].sort() as string[];
  let cumulativeMapped=0,cumulativeApproved=0,cumulativeTarget=0,cumulativeHours=0;
  const byDay=(items:R[],dateOf:(r:R)=>string)=>{const result=new Map<string,R[]>();for(const item of items){const date=dateOf(item);if(!result.has(date))result.set(date,[]);result.get(date)!.push(item);}return result;};
  const mapDays=byDay(g.mappings,mappedDate),effortDays=byDay(g.effort,e=>e.work_date),allocationDays=byDay(g.allocations,a=>a.work_date);
  const daily=dates.map(date=>{const maps=mapDays.get(date)||[],effort=effortDays.get(date)||[],allocations=allocationDays.get(date)||[],m=metrics(maps,effort,allocations);cumulativeMapped+=m.mapped;cumulativeApproved+=m.approved;cumulativeTarget+=m.target||0;cumulativeHours+=m.hours;return {date,...m,cumulativeMapped,cumulativeApproved,cumulativeTarget,cumulativeHours,researchers:researchers(maps,effort,m)};});
  const periodMappings=g.mappings.filter((m:R)=>inPeriod(mappedDate(m))),periodEffort=g.effort.filter((e:R)=>inPeriod(e.work_date)),period=metrics(periodMappings,periodEffort,g.allocations.filter((a:R)=>inPeriod(a.work_date)));
  const matureApproved=all.matured.filter((m:R)=>m.status==='Approved').length,matureTarget=g.allocations.filter((a:R)=>a.work_date<=addDays(today,-3)&&a.target!=null).reduce((n:number,a:R)=>n+Number(a.target),0);
  const attention:R[]=[];
  if(all.oldestPending>3)attention.push({key:'review',tone:'red',cause:`Review pending ${all.oldestPending} days`,action:'Review candidates',items:all.waitingMappings});
  if(all.matured.length>=5&&!all.unresolvedMatured.length&&matureApproved/all.matured.length<.4)attention.push({key:'quality',tone:'red',cause:'Approval ratio below 40%',action:'Inspect rejected profiles',items:g.mappings.filter((m:R)=>m.status==='Rejected')});
  if(all.hours>=200)attention.push({key:'effort',tone:all.throughput!==null&&all.throughput>=1?'amber':'red',cause:'200+ effort hours',action:'Review daily effort'});
  if(all.personDays>=3&&all.mappingsPerPersonDay!==null&&all.mappingsPerPersonDay<10)attention.push({key:'mapping',tone:'amber',cause:'Below 10 maps / person-day',action:'Compare researcher activity'});
  if(matureTarget>matureApproved&&!all.unresolvedMatured.length)attention.push({key:'target',tone:'red',cause:`${matureTarget-matureApproved} approvals below matured target`,action:'Review daily delivery'});
  if(all.daysSinceFirstMap!==null&&all.daysSinceFirstMap>100)attention.push({key:'age',tone:'amber',cause:'Over 100 days since first map',action:'Review search progress'});
  if(all.targetIncomplete)attention.push({key:'missing',tone:'amber',cause:'Some planned days have no target',action:'Review daily targets'});
  if(all.hours>0&&!all.mapped)attention.push({key:'empty',tone:'red',cause:'Effort recorded; no mappings',action:'Review researcher activity'});
  return {...g,...all,daily,period,periodMappings,periodApprovals:period.approvedMappings,periodMapped:period.mapped,periodApproved:period.approved,periodHours:period.hours,periodResearchers:researchers(periodMappings,periodEffort,period),researchers:researchers(g.mappings,g.effort,all),attention};
 });
}
