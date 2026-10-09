import test from 'node:test';
import assert from 'node:assert/strict';
import {actualCoverage} from '../src/actual-coverage';
test('actual coverage includes unplanned, imported, unknown and current-profile fallback without rewriting historical employer',()=>{
 const records=[{kind:'company',id:'a',name:'Alpha',aliases:['Alpha Inc']},{kind:'target',role_id:'r',company_id:'a'},
 {kind:'candidate',id:'c1',name:'One',company:'New employer'},
 {kind:'candidate',id:'c2',name:'Two',company:'Unplanned'},
 {kind:'mapping',id:'m1',role_id:'r',candidate_id:'c1',company:'Alpha Inc',status:'Approved'},
 {kind:'mapping',id:'m2',role_id:'r',candidate_id:'c2',status:'Imported'},
 {kind:'mapping',id:'m3',role_id:'r',candidate_id:'c3',status:'Partner review'},
 {kind:'mapping',id:'m4',role_id:'other',candidate_id:'c4',company:'Excluded',status:'Rejected'}];
 const c=actualCoverage(records,'r');assert.equal(c.total,3);assert.equal(c.companies,2);assert.equal(c.unknown,1);assert.equal(c.fallback,1);
 const a=c.groups.find(g=>g.name==='Alpha')!;assert.equal(a.onTarget,true);assert.equal(a.approved,1);assert.equal(a.candidates[0].usedCurrent,false);
 const b=c.groups.find(g=>g.name==='Unplanned')!;assert.equal(b.onTarget,false);assert.equal(b.other,1);
 assert.equal(c.groups.reduce((s,g)=>s+g.approved+g.pending+g.rejected+g.other,0),c.total);
});
test('one candidate counts once and ambiguous company aliases are not merged into a target',()=>{
 const c=actualCoverage([{kind:'company',id:'a',name:'A',aliases:['Shared']},{kind:'company',id:'b',name:'B',aliases:['Shared']},{kind:'target',role_id:'r',company_id:'a'},...['old','new'].map((id,i)=>({kind:'mapping',id,version:i+1,role_id:'r',candidate_id:'c',company:'Shared',status:i?'Rejected':'Approved'}))],'r');assert.equal(c.total,1);assert.equal(c.groups[0].name,'Shared');assert.equal(c.groups[0].onTarget,false);assert.equal(c.groups[0].rejected,1);
});
