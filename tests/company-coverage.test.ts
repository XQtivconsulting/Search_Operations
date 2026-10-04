import test from 'node:test';
import assert from 'node:assert/strict';
import {companyCoverage} from '../src/company-coverage';
test('coverage counts approved unique candidates only in the same search/company including direct mappings',()=>{
 const target={id:'t',role_id:'r',company_id:'c',expected:1};
 const records=[{kind:'mapping',id:'m1',role_id:'r',target_id:'t',candidate_id:'a',status:'Approved'},{kind:'mapping',id:'m2',role_id:'r',company_id:'c',candidate_id:'b',status:'Approved'},{kind:'mapping',id:'m3',role_id:'r',company_id:'c',candidate_id:'b',status:'Approved'},{kind:'mapping',id:'m4',role_id:'other',company_id:'c',candidate_id:'d',status:'Approved'},{kind:'mapping',id:'m5',role_id:'r',company_id:'c',candidate_id:'e',status:'Partner review'}];
 assert.deepEqual(companyCoverage(target,records),{planned:1,actual:2,remaining:0});assert.equal(companyCoverage({...target,expected:0},records).planned,0);assert.equal(companyCoverage({...target,expected:null},records).planned,null);
});
