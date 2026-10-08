import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryRange,deliveryRows,reviewPipeline,sourcingProgressRows} from '../src/delivery-monitor';
const data={actor:{role:'planner'},searches:[{id:'r',client:'Client',title:'Role'}],teams:[{id:'t',name:'Team'}],staff:[{id:'s',name:'Person'}],assignments:[{id:'a',search_id:'r',team_id:'t',work_date:'2026-09-28',target:5}],entries:[{assignment_id:'a',search_id:'r',team_id:'t',staff_id:'s',work_date:'2026-09-28',mapped:2,peer:0,partner:0}],research:{records:[{id:'m',kind:'mapping',role_id:'r',team_id:'t',staff_id:'s',work_date:'2026-09-28',status:'Peer review'},{id:'old',kind:'mapping',role_id:'r',work_date:'2026-08-01',status:'Hold'},{id:'done',kind:'mapping',role_id:'r',status:'Approved'}]}};
test('delivery period handles Monday and month boundaries',()=>{
 assert.deepEqual(deliveryRange('yesterday','','2026-03-01'),{from:'2026-02-28',to:'2026-02-28'});
 assert.deepEqual(deliveryRange('week','','2026-09-29'),{from:'2026-09-28',to:'2026-10-04'});
 assert.deepEqual(deliveryRange('date','2026-08-20','2026-09-29'),{from:'2026-08-20',to:'2026-08-20'});
});
test('review pipeline retains prior-period work and respects all vs no roles',()=>{
 assert.deepEqual(reviewPipeline(data,null).map((m:any)=>m.id),['m','old']);
 assert.deepEqual(reviewPipeline(data,[]),[]);
 assert.deepEqual(reviewPipeline(data,['other']),[]);
});
test('daily delivery reconciles approvals and reviews without treating waiting as approved',()=>{
 const r=deliveryRows(data,null,'2026-09-28','2026-09-28','2026-09-29')[0];
 assert.equal(r.waiting,1);assert.equal(r.mapped,2);assert.equal(r.partner,0);assert.equal(r.target,5);
 assert.deepEqual(r.attention,['1 awaiting review','Below approval target']);
 assert.equal(deliveryRows(data,null,'2026-09-29','2026-09-29','2026-09-29').length,0);
 assert.equal(deliveryRows(data,[],'2026-09-28','2026-09-28','2026-09-29').length,0);
});
test('future plans are not overdue and today is not below target before day ends',()=>{
 const d={...data,entries:[]};
 assert.deepEqual(deliveryRows(d,null,'2026-09-28','2026-09-28','2026-09-27')[0].attention,[]);
 assert.deepEqual(deliveryRows(d,null,'2026-09-28','2026-09-28','2026-09-28')[0].attention,['No mappings yet']);
});
test('tactical monitor replaces duplicate views with yesterday and per-search metrics',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{DeliveryMonitor}=await import('../src/DeliveryMonitor');
 const html=renderToStaticMarkup(React.createElement(DeliveryMonitor,{data,initialView:'pipeline',onOpen:()=>{},onCandidate:()=>{},onAllocate:()=>{}}));
 for(const text of ['Sourcing progress','Yesterday','Custom date range','Approval target','Effort hours','Cumulative','Throughput','Quality','Researchers for Role'])assert.ok(html.includes(text),text);
 for(const text of ['Candidate reviews','All outstanding','Adjust allocation','delivery-summary','This week'])assert.ok(!html.includes(text),text);
});
test('unplanned work from multiple researchers is one search/team/day row',()=>{
 const d={...data,assignments:[],staff:[...data.staff,{id:'s2',name:'Other'}],entries:[data.entries[0],{...data.entries[0],assignment_id:'other',staff_id:'s2'}]};
 const rows=deliveryRows(d,null,'2026-09-28','2026-09-28','2026-09-29');
 assert.equal(rows.length,1);assert.equal(rows[0].mapped,4);assert.equal(rows[0].target,null);assert.equal(rows[0].researchers,'Person, Other');
});


test('sourcing progress totals include drafts and historical mappings independently of the chosen period',()=>{
 const d={...data,assignments:[...data.assignments,{id:'future',search_id:'r',team_id:'t',work_date:'2026-10-12',target:7}],research:{records:[
 {id:'draft',kind:'mapping',role_id:'r',team_id:'t',status:'Draft',created_at:'2026-10-05T04:00:00Z'},
 {id:'old',kind:'mapping',role_id:'r',team_id:'t',status:'Approved',created_at:'2026-09-01T12:00:00Z'},
 {id:'pending',kind:'mapping',role_id:'r',team_id:'t',status:'Partner review',created_at:'2026-10-05T03:59:59Z'},
 {id:'rejected',kind:'mapping',role_id:'r',team_id:'t',status:'Rejected',created_at:'2026-10-05T12:00:00Z'},
 {id:'legacy',kind:'mapping',role_id:'r',team_id:'t',status:'Imported',work_date:'2026-10-05'},
 {id:'elsewhere',kind:'mapping',role_id:'r',team_id:'t2',status:'Approved',created_at:'2026-10-05T12:00:00Z'}]}};
 const rows=sourcingProgressRows(d,null,'2026-10-05','2026-10-05','2026-10-05'),r=rows.find(r=>r.team_id==='t')!;
 assert.equal(rows.length,2);assert.equal(r.target,12);assert.equal(r.mapped,5);assert.equal(r.periodMapped,3);assert.equal(r.waiting,1);assert.equal(r.partner,1);
 assert.deepEqual(r.periodMappings.map((m:any)=>m.id),['draft','rejected','legacy']);
 assert.equal(rows.reduce((n,r)=>n+r.mapped,0),6);
 const earlier=sourcingProgressRows(d,['r'],'2026-09-01','2026-09-01','2026-10-05').find(r=>r.team_id==='t')!;
 assert.equal(earlier.mapped,r.mapped);assert.equal(earlier.partner,r.partner);assert.equal(earlier.waiting,r.waiting);assert.equal(earlier.target,r.target);assert.equal(earlier.periodMapped,1);
 assert.deepEqual(sourcingProgressRows(d,[],'2026-10-05','2026-10-05','2026-10-05'),[]);
});
test('sourcing progress retains unassigned drafts and empty searches without inventing a target',()=>{
 const d={...data,assignments:[],research:{records:[{id:'draft',kind:'mapping',role_id:'r',status:'Draft',created_at:'2026-10-05T12:00:00Z'}]}};
 const r=sourcingProgressRows(d,null,'2026-10-05','2026-10-05','2026-10-05')[0];assert.equal(r.team,'Unassigned');assert.equal(r.target,null);assert.equal(r.mapped,1);
 const empty=sourcingProgressRows({...d,research:{records:[]}},null,'2026-10-05','2026-10-05','2026-10-05');assert.equal(empty.length,1);assert.equal(empty[0].mapped,0);
});

test('progress attention compares approvals with elapsed plan, not today, future effort or review queue alone',()=>{
 const d={...data,assignments:[data.assignments[0],{...data.assignments[0],id:'future',work_date:'2026-09-30',target:20}]};
 const row=(today:string,source=d)=>sourcingProgressRows(source,null,'2026-09-28','2026-09-28',today).find(r=>r.team_id==='t')!;
 const scheduled=row('2026-09-27');assert.equal(scheduled.planStatus,'Scheduled');assert.deepEqual(scheduled.attention,[]);assert.equal(scheduled.days,0);
 const active=row('2026-09-28');assert.equal(active.planStatus,'In progress');assert.deepEqual(active.attention,[]);assert.equal(active.waiting,1);assert.equal(active.days,1);assert.equal(active.dueTarget,0);
 const late=row('2026-09-29');assert.equal(late.planStatus,'Behind plan');assert.equal(late.dueTarget,5);assert.equal(late.shortfall,5);assert.equal(late.target,25);
 const caughtUp=row('2026-09-29',{...d,research:{records:[...d.research.records,...Array.from({length:5},(_,i)=>({id:'ok'+i,kind:'mapping',role_id:'r',team_id:'t',status:'Approved'}))]}} as typeof d);
 assert.equal(caughtUp.planStatus,'On track');assert.equal(caughtUp.waiting,1);assert.deepEqual(caughtUp.attention,[]);
 const noTarget=row('2026-09-29',{...d,assignments:[{...d.assignments[0],target:null}]} as any);assert.equal(noTarget.planStatus,'Target not set');assert.equal(noTarget.shortfall,0);
});
test('progress person-days split before filters and respect PTO, corrections and future dates',()=>{
 const assignments=[{id:'a',search_id:'r',team_id:'t',work_date:'2026-09-28',target:1},{id:'b',search_id:'r2',team_id:'t',work_date:'2026-09-28',target:1},{id:'pto',search_id:'r',team_id:'t',work_date:'2026-09-29',target:1},{id:'future',search_id:'r',team_id:'t',work_date:'2026-09-30',target:1}];
 const d={...data,searches:[...data.searches,{id:'r2',client:'Other',title:'Other role'}],assignments,entries:assignments.map(a=>({...a,assignment_id:a.id,staff_id:'s'})),timeOff:[{staff_id:'s',work_date:'2026-09-29',pto:true}]};
 const result=sourcingProgressRows(d,['r'],'2026-09-29','2026-09-29','2026-09-29').find(r=>r.team_id==='t')!;
 assert.equal(result.days,.5);assert.equal(result.periodDays,0);assert.equal(result.effort.length,1);
 const earlier=sourcingProgressRows(d,['r'],'2026-09-28','2026-09-28','2026-09-29').find(r=>r.team_id==='t')!;assert.equal(earlier.periodDays,.5);
 const corrected=sourcingProgressRows({...d,effort:[{search_id:'r',team_id:'t',staff_id:'s',work_date:'2026-09-28',days:.25}]},['r'],'2026-09-28','2026-09-28','2026-09-29').find(r=>r.team_id==='t')!;assert.equal(corrected.days,.25);assert.equal(corrected.effort[0].source,'exception');
});
