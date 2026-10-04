import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesFilter,toggleFilterValue} from '../src/filter-values';
import {directoryRows} from '../src/candidate-directory';

test('first filter choice includes only that value, with explicit multi-selection and clearing',()=>{
 const first=toggleFilterValue(null,'Energy & Utilities',true);
 assert.deepEqual(first,['Energy & Utilities']);
 const two=toggleFilterValue(first,'Technology',true);
 assert.deepEqual(two,['Energy & Utilities','Technology']);
 assert.deepEqual(toggleFilterValue(two,'Technology',false),first);
 assert.deepEqual(toggleFilterValue(first,'Energy & Utilities',false),[]);
});
test('typed options match conjunctions, case, punctuation and spacing without fuzzy guesses',()=>{
 assert.equal(matchesFilter('Energy & Utilities','energy and utilities'),true);
 assert.equal(matchesFilter('Birlasoft','birla soft'),true);
 assert.equal(matchesFilter('Birlasoft','builder soft'),false);
 assert.equal(matchesFilter('Energy & Utilities','healthcare'),false);
});
test('candidate filters use exact chosen tags and current, historical and alias company names',()=>{
 const cs=[{id:'a',company:'Birlasoft',company_id:'co',tag_values:{industry:['Energy & Utilities']}},{id:'b',company:'Other',tag_values:{industry:['Technology']}},{id:'c',company:'Other'}];
 const records=[{id:'co',kind:'company',name:'Birlasoft',aliases:['Birla Soft Limited']},{kind:'mapping',candidate_id:'b',company:'Old Company'}];
 const rows=(filters:Record<string,string>)=>directoryRows(cs,'',filters,'company',false,new Map(),new Map(),records).map(c=>c.id);
 assert.deepEqual(rows({'tag:industry':'["Energy & Utilities"]'}),['a']);
 assert.deepEqual(rows({'tag:industry':'["Healthcare"]'}),[]);
 assert.deepEqual(rows({'tag:industry':'[]'}),[]);
 assert.deepEqual(rows({company:'birla soft'}),['a']);
 assert.deepEqual(rows({company:'birla soft limited'}),['a']);
 assert.deepEqual(rows({company:'old company'}),['b']);
 assert.deepEqual(rows({company:'birla soft','tag:industry':'["Technology"]'}),[]);
});
