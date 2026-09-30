import test from 'node:test';import assert from 'node:assert/strict';import {cleanCriteria,cleanEvidence} from '../src/strategy-criteria';import {displayDate} from '../src/dates';
test('criteria have stable unique IDs and require explained evidence including not applicable',()=>{assert.throws(()=>cleanCriteria([{id:'x',label:'Location'},{id:'x',label:'Experience'}]));const c=cleanCriteria([{id:'q',label:'Qualification'}]);assert.throws(()=>cleanEvidence({q:{not_applicable:true}},c,true));assert.equal(cleanEvidence({q:{not_applicable:true,text:'Not required for this remit'}},c,true).q.not_applicable,true);});
test('calendar dates have an unambiguous month-name format',()=>{assert.equal(displayDate('2026-09-29'),'29 Sept 2026');});
test('criteria lists are not limited to thirty entries',()=>{assert.equal(cleanCriteria(Array.from({length:40},(_,i)=>({id:String(i),label:'Qualification '+i}))).length,40);});
test('custom weights require valid numbers totalling 100 and equal distribution stays exact',async()=>{
 const {equalWeights}=await import('../src/fit-score');
 const c=[{id:'a',label:'Scope',requirement:''},{id:'b',label:'Qualification',requirement:''},{id:'c',label:'Location',requirement:''}];
 assert.equal(cleanCriteria(equalWeights(c)).reduce((n,c)=>n+(c.weight||0),0),100);
 assert.throws(()=>cleanCriteria(c.map(v=>({...v,weight:20}))),/100/);
 assert.throws(()=>cleanCriteria([{...c[0],weight:-10},{...c[1],weight:110}]),/between/);
 assert.throws(()=>cleanCriteria([{...c[0],weight:100},c[1]]),/Each criterion/);
 assert.equal(cleanCriteria(c)[0].weight,undefined);
});
