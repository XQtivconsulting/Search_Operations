import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentWorkIds,allocationKey,groupBy} from '../src/performance-index';
import {workloadIndex} from '../src/plan-workload';

test('bulk protection preserves zero counts, notes, flags, reviews, mappings and effort',()=>{
 const assignments=['clean','zero','notes','flag','derived','review','mapping','effort','no-effort'].map(id=>({id,search_id:id,team_id:'t',work_date:'2026-10-05'}));
 const entries=assignments.map(a=>({assignment_id:a.id,source:'manual',mapped:null,peer:null,partner:null,notes:'',flag:null} as any));
 entries[1].mapped=0;entries[2].notes='Recorded';entries[3].flag='';entries[4].source='import';
 const records=[{kind:'mapping',role_id:'mapping',team_id:'t',work_date:'2026-10-05'}];
 const effort=[{search_id:'effort',team_id:'t',work_date:'2026-10-05',days:0.5},{search_id:'no-effort',team_id:'t',work_date:'2026-10-05',days:0}];
 assert.deepEqual([...assignmentWorkIds(assignments,entries,records,effort,[{assignment_id:'review'}])].sort(),['derived','effort','flag','mapping','notes','review','zero']);
 assert.notEqual(allocationKey('a:b','c','d'),allocationKey('a','b:c','d'));
});

test('20,000-record protection and grouping read each record a bounded number of times',()=>{
 let reads=0;
 const records=Array.from({length:20000},(_,i)=>({get kind(){reads++;return 'mapping';},role_id:'r'+i,team_id:'t',work_date:'2026-10-05'}));
 const assignments=records.map((r,i)=>({id:'a'+i,search_id:r.role_id,team_id:r.team_id,work_date:r.work_date}));
 assert.equal(assignmentWorkIds(assignments,[],records,[],[]).size,20000);
 assert.equal(reads,20000);
 const groups=groupBy(records,r=>r.role_id);assert.equal(groups.size,20000);assert.equal(groups.get('r99')?.[0],records[99]);
});

test('workload lookups reuse the snapshot and keep cross-team and PTO semantics at scale',()=>{
 let sourceReads=0;
 const assignments=Array.from({length:10000},(_,i)=>({id:'a'+i,team_id:'t'+i%20,work_date:'2026-10-05'}));
 const entries=assignments.flatMap((a,i)=>[{assignment_id:a.id,staff_id:'s'+i%100,source:'manual'},{assignment_id:a.id,staff_id:'s'+i%100,source:'candidates'}]);
 const d={assignments,get entries(){sourceReads++;return entries;},people:[{id:'p',staff_id:'s0'}],staff:[{id:'s0',name:'Synthetic researcher'}],timeOff:[{staff_id:'s0',work_date:'2026-10-05',pto:1}],research:{records:[{id:'task',kind:'task',work_date:'2026-10-05',team_id:'other',owner_id:'p',status:'Planned'}]}};
 const lookup=workloadIndex(d),readsAfterBuild=sourceReads;
 for(let i=0;i<1000;i++)assert.equal(lookup('2026-10-05','other')[0].count,101);
 assert.equal(sourceReads,readsAfterBuild);
 assert.equal(lookup('2026-10-05','t0').find(w=>w.staff==='s0')?.pto,true);
 assert.deepEqual(lookup('2026-10-06','t0'),[]);
});
