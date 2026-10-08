import test from 'node:test';import assert from 'node:assert/strict';
import {monitorRange,sourcingMonitorRows} from '../src/sourcing-monitor';
import {performanceMetrics} from '../src/performance';
const data:any={sourcingSettings:{hoursPerDay:8},searches:[{id:'r',title:'Role',search_number:10,client:'Example'},{id:'other',title:'Other'}],staff:[{id:'s',name:'Person'},{id:'s2',name:'Other person'}],teams:[],assignments:[{id:'a',search_id:'r',team_id:'one',work_date:'2026-10-06',target:3},{id:'b',search_id:'other',team_id:'two',work_date:'2026-10-06',target:2},{id:'c',search_id:'r',team_id:'two',work_date:'2026-10-07',target:2}],entries:[{assignment_id:'a',staff_id:'s'},{assignment_id:'b',staff_id:'s'},{assignment_id:'c',staff_id:'s2'}],research:{records:[{id:'m1',kind:'mapping',role_id:'r',team_id:'one',staff_id:'s',status:'Approved',created_at:'2026-10-01T12:00:00Z',stage_at:'2026-10-07T04:00:00Z'},{id:'m2',kind:'mapping',role_id:'r',team_id:'two',staff_id:'s2',status:'Partner review',created_at:'2026-10-07T03:59:59Z'},{id:'m3',kind:'mapping',role_id:'r',team_id:'two',staff_id:'s2',status:'Draft',created_at:'2026-10-07T04:00:00Z'},{id:'m4',kind:'mapping',role_id:'r',team_id:'one',status:'Approved'}]}};
test('monitor defaults to yesterday across month boundaries and clamps custom dates',()=>{assert.deepEqual(monitorRange('yesterday','2026-03-01'),{from:'2026-02-28',to:'2026-02-28'});assert.deepEqual(monitorRange('old-week','2026-03-01'),monitorRange('yesterday','2026-03-01'));assert.deepEqual(monitorRange('custom','2026-10-08','2026-10-01','2026-10-20'),{from:'2026-10-01',to:'2026-10-08'});});
test('approval results follow the original mapping date, targets stop today and researcher totals reconcile',()=>{
 const d={...data,assignments:[...data.assignments,{id:'future',search_id:'r',work_date:'2026-10-20',target:100}]};
 const r=sourcingMonitorRows(d,['r'],'2026-10-07','2026-10-07','2026-10-08')[0];
 assert.equal(r.mapped,4);assert.equal(r.approved,2);assert.equal(r.periodMapped,1);assert.equal(r.periodApproved,0);assert.equal(r.unknownMappingDates,1);assert.equal(r.hours,12);assert.equal(r.periodHours,8);assert.equal(r.quality,.5);assert.equal(r.throughput,2/5);assert.equal(r.target,5);
 assert.equal(r.daily.find((d:any)=>d.date==='2026-10-01').approved,1);
 assert.equal(r.researchers.reduce((n:number,p:any)=>n+p.mapped,0),r.mapped);assert.equal(r.researchers.reduce((n:number,p:any)=>n+p.hours,0),r.hours);assert.equal(r.researchers.find((p:any)=>p.id==='').mapped,1);
 assert.ok(r.researchers.every((p:any)=>p.target===null));assert.equal(r.daily.some((d:any)=>d.date==='2026-10-20'),false);
});
test('effort splitting, PTO, team filtering and configurable hours remain intact',()=>{
 let r=sourcingMonitorRows(data,['r'],'2026-10-06','2026-10-06','2026-10-08','one')[0];assert.equal(r.hours,4);assert.equal(r.periodHours,4);
 const changed={...data,sourcingSettings:{hoursPerDay:6},timeOff:[{staff_id:'s2',work_date:'2026-10-07',pto:1}]};r=sourcingMonitorRows(changed,['r'],'2026-10-06','2026-10-07','2026-10-08')[0];assert.equal(r.hours,3);assert.equal(r.throughput,2/5);assert.equal(performanceMetrics(changed,{roles:['r'],team:'',from:'2026-10-01',to:'2026-10-08'}).hours,3);
});
test('review lag stays provisional; later approvals update the mapping day',()=>{
 const d={...data,assignments:[{id:'a',search_id:'r',team_id:'one',work_date:'2026-10-07',target:10}],entries:[],research:{records:[{id:'m',kind:'mapping',role_id:'r',staff_id:'s',status:'Partner review',created_at:'2026-10-07T12:00:00Z'}]}};
 let r=sourcingMonitorRows(d,['r'],'2026-10-07','2026-10-07','2026-10-08')[0];assert.equal(r.provisional,true);assert.equal(r.attention.length,0);assert.equal(r.target,10);assert.equal(r.periodApproved,0);
 d.research.records[0].status='Approved';r=sourcingMonitorRows(d,['r'],'2026-10-07','2026-10-07','2026-10-10')[0];assert.equal(r.periodApproved,1);assert.equal(r.daily[0].quality,1);assert.equal(r.daily[0].throughput,.1);assert.equal(r.researchers[0].approvalShare,1);
});
test('planned days without mappings are retained and missing dates are not fabricated',()=>{
 const r=sourcingMonitorRows(data,['r'],'','2026-10-08','2026-10-08')[0];assert.equal(r.daily.find((d:any)=>d.date==='2026-10-06').hours,4);assert.equal(r.daily.reduce((n:number,d:any)=>n+d.mapped,0),3);assert.equal(r.daily.at(-1).cumulativeTarget,5);
 assert.deepEqual(monitorRange('all','2026-10-08'),{from:'',to:'2026-10-08'});assert.deepEqual(sourcingMonitorRows(data,[],'','2026-10-08','2026-10-08'),[]);
});
test('low-quality warning requires mature decided evidence and pending review gets its own action',()=>{
 const maps=Array.from({length:5},(_,i)=>({id:String(i),kind:'mapping',role_id:'r',status:'Rejected',created_at:'2026-10-01T12:00:00Z'}));
 const d={...data,assignments:[],entries:[],research:{records:maps}};
 let r=sourcingMonitorRows(d,['r'],'','2026-10-08','2026-10-08')[0];assert.equal(r.throughput,null);assert.ok(r.attention.some((a:any)=>a.key==='quality'));
 maps[0].status='Partner review';r=sourcingMonitorRows(d,['r'],'','2026-10-08','2026-10-08')[0];assert.equal(r.attention.some((a:any)=>a.key==='quality'),false);assert.ok(r.attention.some((a:any)=>a.key==='review'));
});
