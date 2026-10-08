import test from 'node:test';
import assert from 'node:assert/strict';
import {workloadIndex} from '../src/plan-workload';
const date='2026-09-30';
const fixture=()=>({assignments:[{id:'a',team_id:'blue',work_date:date}],entries:[{assignment_id:'a',staff_id:'s'},{assignment_id:'a',staff_id:'s',source:'candidates'}],people:[{id:'p',staff_id:'s'}],staff:[{id:'s',name:'Test researcher'}],research:{records:[{id:'t',kind:'task',team_id:'red',owner_id:'p',work_date:date,status:'Planned'}]},timeOff:[] as any[]});
test('workload catches cross-team task/assignment overlaps without double-counting candidate output',()=>{const d=fixture();assert.equal(workloadIndex(d)(date,'blue')[0].count,2);assert.equal(workloadIndex(d)(date,'red')[0].count,2);assert.deepEqual(workloadIndex(d)('2026-10-01','blue'),[]);});
test('completed/cancelled tasks do not warn, while a single allocation on PTO does',()=>{const d=fixture();for(const status of ['Completed','Cancelled']){d.research.records[0].status=status;assert.deepEqual(workloadIndex(d)(date,'blue'),[]);}d.timeOff=[{staff_id:'s',work_date:date,pto:1}];assert.equal(workloadIndex(d)(date,'blue')[0].pto,true);});
