import {effectiveEffort} from './planned-effort';
import {hoursPerPersonDay} from './sourcing-settings';
import {addDays} from './planning';
type R=Record<string,any>;
export const monitorPeriods=[['yesterday','Yesterday'],['today','Today'],['custom','Custom date range']];
export function monitorRange(period:string,today:string,from='',to=''){if(period==='custom'){const end=to&&to<today?to:today;return {from:from&&from<=end?from:end,to:end};}const date=period==='today'?today:addDays(today,-1);return {from:date,to:date};}
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'});
const eastern=(value:string)=>{if(!value)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const d=new Date(value);return Number.isFinite(d.getTime())?dayFormatter.format(d):'';};
export function sourcingMonitorRows(data:R,roles:string[]|null,from:string,to:string,today:string,team=''):R[]{
 const factor=hoursPerPersonDay(data),staff=new Map((data.staff||[]).map((p:R)=>[p.id,p.name])),accounts=new Map((data.people||[]).map((p:R)=>[p.id,p.staff_id||p.staffId||'']));
 const groups=new Map<string,R>();for(const s of data.searches||[])if(roles===null||roles.includes(s.id))groups.set(s.id,{id:s.id,search_number:s.search_number,role:s.title,client:s.client,mappings:[],allocations:[],effort:[]});
 for(const a of data.assignments||[])if(!team||a.team_id===team)groups.get(a.search_id)?.allocations.push(a);
 for(const m of data.research?.records||[])if(m.kind==='mapping'&&(!team||m.team_id===team))groups.get(m.role_id)?.mappings.push(m);
 // Split effort across all searches before applying filters.
 for(const e of effectiveEffort(data,today))if(!team||e.team_id===team)groups.get(e.search_id)?.effort.push(e);
 const inPeriod=(d:string)=>!!d&&d>=from&&d<=to;
 const metrics=(maps:R[],effort:R[])=>{
  const approved=maps.filter(m=>m.status==='Approved'),waiting=maps.filter(m=>['Peer review','Partner review'].includes(m.status)),periodMappings=maps.filter(m=>inPeriod(eastern(m.created_at)||m.work_date||''));
  // stage_at is the current partner-approval transition, never the mapping date.
  const periodApprovals=approved.filter(m=>inPeriod(eastern(m.partner_reviewed_at||m.stage_at||'')));
  const periodEffort=effort.filter(e=>inPeriod(e.work_date)),hours=effort.reduce((n,e)=>n+e.days*factor,0),periodHours=periodEffort.reduce((n,e)=>n+e.days*factor,0);
  return {mappings:maps,approvedMappings:approved,waitingMappings:waiting,periodMappings,periodApprovals,effort,periodEffort,hours,periodHours,mapped:maps.length,approved:approved.length,waiting:waiting.length,periodMapped:periodMappings.length,periodApproved:periodApprovals.length,throughput:hours>0?approved.length/hours:null,quality:maps.length?approved.length/maps.length:null,rejected:maps.filter(m=>m.status==='Rejected').length,unknownApprovalDates:approved.filter(m=>!eastern(m.partner_reviewed_at||m.stage_at||'')).length};
 };
 return [...groups.values()].filter(g=>!team||g.mappings.length||g.effort.length||g.allocations.length).map(g=>{
  const m=metrics(g.mappings,g.effort),known=g.allocations.filter((a:R)=>a.target!==null&&a.target!==undefined),target=known.length?known.reduce((n:number,a:R)=>n+Number(a.target),0):null,dueTarget=known.filter((a:R)=>a.work_date<today).reduce((n:number,a:R)=>n+Number(a.target),0);
  const pending=g.mappings.filter((r:R)=>['Draft','Peer review','Partner review','Needs information','Hold'].includes(r.status)).length;
  const alerts=[{key:'quality',label:'Quality',active:m.rejected>0,cause:'Rejected profiles warrant criteria review',detail:`${m.rejected} rejected; quality is approved divided by all mapped profiles.`},{key:'throughput',label:'Throughput',active:m.hours>0&&!m.approved||m.mapped>0&&!m.hours,cause:m.hours?'No approvals despite recorded effort':'Mapped profiles have unrecorded effort',detail:`${m.hours.toFixed(1)} estimated hours; ${m.approved} approved profiles.`},{key:'backlog',label:'Backlog',active:m.waiting>0,cause:'Profiles await team or partner',detail:`${m.waiting} profiles awaiting review; this is pending work, not automatically overdue.`},{key:'pipeline',label:'Pipeline',active:dueTarget>m.approved+pending||g.allocations.some((a:R)=>a.work_date<today&&a.target==null),cause:dueTarget>m.approved+pending?'Approval target exceeds available pipeline':'Past allocations need approval targets',detail:`${dueTarget} approvals due before today; ${m.approved} approved and ${pending} in the sourcing pipeline.`}];
  const people=new Map<string,{maps:R[];effort:R[]}>();const person=(id:string)=>{if(!people.has(id))people.set(id,{maps:[],effort:[]});return people.get(id)!;};
  for(const map of g.mappings)person(map.staff_id||accounts.get(map.mapper_id)||'').maps.push(map);
  for(const e of g.effort)person(e.staff_id||'').effort.push(e);
  return {...g,...m,target,dueTarget,alerts,attention:alerts.filter(a=>a.active),researchers:[...people].map(([id,p])=>({id,name:staff.get(id)||'Unattributed',...metrics(p.maps,p.effort)})).sort((a,b)=>b.periodMapped-a.periodMapped||String(a.name).localeCompare(String(b.name)))};
 });
}
