import test from 'node:test';import assert from 'node:assert/strict';
import {fitSummary,mappingFit} from '../src/fit-score';
import {cleanEvidence} from '../src/strategy-criteria';
const criteria=[{id:'a',label:'Scope',requirement:'Multi-site'},{id:'b',label:'Qualifications',requirement:'Certification'}];
test('fit is the equal-weight average, incomplete scores are not ranked, N/A is explicit',()=>{
 assert.equal(fitSummary(criteria,{a:{rating:5},b:{rating:3}}).score,4);
 assert.equal(fitSummary(criteria,{a:{rating:5}}).score,null);
 assert.equal(fitSummary(criteria,{a:{rating:5},b:{not_applicable:true}}).score,5);
 assert.equal(fitSummary(criteria,{a:{rating:5},b:{not_applicable:true}}).allMeet,false);
 assert.equal(fitSummary(criteria,{a:{rating:4},b:{rating:5}}).allMeet,true);
 assert.equal(fitSummary(criteria,{a:{not_applicable:true},b:{not_applicable:true}}).score,null);
});
test('changed requirements cannot rank against the current strategy',()=>{
 const m={criteria_snapshot:criteria,evidence:{a:{rating:5},b:{rating:5}}};
 assert.equal(mappingFit(m,criteria).comparable,true);
 assert.equal(mappingFit(m,[{...criteria[0],requirement:'Global scope'},criteria[1]]).comparable,false);
});
test('submitted justification needs a valid human rating or explained N/A',()=>{
 assert.throws(()=>cleanEvidence({a:{text:'Evidence'}},[criteria[0]],true),/Rate/);
 for(const rating of [0,6,2.5,'invalid'])assert.throws(()=>cleanEvidence({a:{text:'Evidence',rating}},[criteria[0]],true),/1 to 5/);
 assert.equal(cleanEvidence({a:{text:'Evidence',rating:4}},[criteria[0]],true).a.rating,4);
 assert.equal(cleanEvidence({a:{text:'Not required',not_applicable:true,rating:5}},[criteria[0]],true).a.rating,null);
});

test('custom weights calculate a weighted score and weight-only changes recalculate existing ratings',()=>{
 const weighted=[{...criteria[0],weight:60},{...criteria[1],weight:40}],evidence={a:{rating:4},b:{rating:3}};
 assert.equal(fitSummary(weighted,evidence).score,3.6);
 assert.equal(mappingFit({criteria_snapshot:criteria,evidence},weighted).score,3.6);
 assert.equal(fitSummary(weighted,{a:{rating:4},b:{not_applicable:true}}).score,4);
 assert.equal(fitSummary(weighted,{a:{rating:4}}).score,null);
});
test('criterion filters support different thresholds and all/any combinations',async()=>{
 const {matchesCriterionFilters}=await import('../src/fit-score');
 const e={a:{rating:5},b:{rating:3}};
 assert.equal(matchesCriterionFilters(e,{a:5,b:3}),true);
 assert.equal(matchesCriterionFilters(e,{a:5,b:4}),false);
 assert.equal(matchesCriterionFilters(e,{a:5,b:4},'any'),true);
 assert.equal(matchesCriterionFilters({a:{not_applicable:true,rating:5}},{a:4}),false);
});
