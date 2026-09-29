import test from 'node:test';import assert from 'node:assert/strict';
import {effectiveEffort} from '../src/planned-effort';
import {performanceMetrics} from '../src/performance';
const data={assignments:[{id:'a',search_id:'r',team_id:'t',work_date:'2026-09-27'},{id:'b',search_id:'r2',team_id:'t2',work_date:'2026-09-27'}],entries:[{assignment_id:'a',staff_id:'s'},{assignment_id:'b',staff_id:'s'},{assignment_id:'a',staff_id:'s',source:'candidates'},{assignment_id:'a',staff_id:'unplanned',source:'candidates'}]};
test('planned splits deduplicate entries and allocate across teams before role filters',()=>{
 const rows=effectiveEffort(data,'2026-09-29');assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.days),[.5,.5]);
 assert.equal(performanceMetrics(data,{roles:['r'],team:'',from:'',to:''}).days,.5);
 assert.equal(performanceMetrics(data,{roles:null,team:'t2',from:'',to:''}).days,.5);
});
test('PTO removes a full day across searches; clearing PTO restores plan defaults',()=>{
 assert.equal(effectiveEffort({...data,timeOff:[{staff_id:'s',work_date:'2026-09-27',pto:1}]},'2026-09-29').length,0);
 assert.equal(effectiveEffort({...data,timeOff:[{staff_id:'s',work_date:'2026-09-27',pto:0}]},'2026-09-29').reduce((n,r)=>n+r.days,0),1);
});
test('future plans are not spent effort and legacy corrections are preserved without mixing defaults',()=>{
 assert.equal(effectiveEffort(data,'2026-09-26').length,0);
 const corrected={...data,effort:[{staff_id:'s',work_date:'2026-09-27',search_id:'r',team_id:'t',days:.25}]};
 assert.equal(effectiveEffort(corrected,'2026-09-29').reduce((n,r)=>n+r.days,0),.25);
 assert.equal(effectiveEffort({...corrected,timeOff:[{staff_id:'s',work_date:'2026-09-27',pto:1}]},'2026-09-29').length,0);
});
test('three allocations sum to exactly one day and no roster-based effort is invented',()=>{
 const d={...data,assignments:[...data.assignments,{id:'c',search_id:'r3',team_id:'t',work_date:'2026-09-27'}],entries:[...data.entries,{assignment_id:'c',staff_id:'s'}],team_members:[{staff_id:'not-assigned',team_id:'t'}]};
 assert.equal(effectiveEffort(d,'2026-09-29').reduce((n,r)=>n+r.days,0),1);
 assert.ok(effectiveEffort(d,'2026-09-29').every(r=>r.staff_id==='s'));
});
