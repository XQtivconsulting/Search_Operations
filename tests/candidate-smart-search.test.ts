import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCandidateQuery,matchesCandidateQuery} from '../src/candidate-smart-search';
import {directoryRows} from '../src/candidate-directory';
const c={id:'a',tag_values:{industry:['Energy & Utilities'],geography:['North Caldwell, New Jersey, United States'],compensation:['USD OTE 300–500k']}};
test('sentence combines geography hierarchy and numeric compensation without changing units',()=>{
 const q=parseCandidateQuery('Find me all candidates in the United States with a compensation of less than $500 million.');
 assert.equal(q.compensation?.limit,500000000);assert.equal(q.terms,'');
 assert.equal(matchesCandidateQuery(c,'',q),true);
 assert.equal(matchesCandidateQuery({...c,tag_values:{...c.tag_values,geography:['India']}},'',q),false);
 const smaller=parseCandidateQuery('Show me candidates in the US with compensation below USD 500k');
 assert.equal(smaller.compensation?.limit,500000);
 assert.equal(matchesCandidateQuery(c,'',smaller),true);
 assert.equal(matchesCandidateQuery({...c,tag_values:{...c.tag_values,compensation:['USD OTE 500–750k']}},'',smaller),false);
 assert.equal(matchesCandidateQuery({...c,tag_values:{...c.tag_values,compensation:[]}},'',smaller),false);
 assert.equal(matchesCandidateQuery({...c,tag_values:{...c.tag_values,compensation:['GBP OTE <150k']}},'',smaller),false);
 assert.equal(matchesCandidateQuery(c,'',parseCandidateQuery('compensation below $400k')),false);
});
test('keyword searches include actual candidate tags even without a prebuilt index',()=>{
 const rows=directoryRows([c,{id:'b',tag_values:{industry:['Technology']}}],'utilities',{},'name',false,new Map());
 assert.deepEqual(rows.map(x=>x.id),['a']);
 assert.equal(parseCandidateQuery('Find me all candidates in India with compensation below 500k').warning,'Specify USD, GBP or INR for the compensation limit.');
});
test('currency bands handle mixed units, text remains an additional constraint',()=>{
 assert.equal(matchesCandidateQuery({tag_values:{compensation:['USD OTE 750k–1m']}},'',parseCandidateQuery('compensation below $1 million')),true);
 assert.equal(matchesCandidateQuery({tag_values:{compensation:['INR OTE 50 lakh–1 crore']}},'',parseCandidateQuery('compensation below INR 1 crore')),true);
 const q=parseCandidateQuery('Find me all candidates in the United States with compensation below $500k utilities');
 assert.equal(matchesCandidateQuery(c,'energy utilities',q),true);
 assert.equal(matchesCandidateQuery(c,'technology',q),false);
});
