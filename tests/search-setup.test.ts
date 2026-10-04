import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryRows,candidateColumns} from '../src/candidate-directory';
import {companyChildOptions} from '../src/company-taxonomy';
import {matchesAge} from '../src/candidate-demographics';
test('age and gender filters combine without becoming candidate table columns',()=>{
 const rows=[{id:'1',age:29,gender:'Female'},{id:'2',age:30,gender:'Female'},{id:'3',age:39,gender:'Male'},{id:'4',age:40},{id:'5'}];
 assert.deepEqual(directoryRows(rows,'',{age:'30–39',gender:'Female'},'id',false,new Map()).map(r=>r.id),['2']);
 assert.deepEqual(directoryRows(rows,'',{age:'Not recorded',gender:'Not recorded'},'id',false,new Map()).map(r=>r.id),['5']);
 assert.equal(matchesAge(59,'50–59'),true);assert.equal(matchesAge(60,'50–59'),false);assert.equal(matchesAge(60,'60+'),true);assert.equal(matchesAge(null,'Under 30'),false);
 assert.ok(!candidateColumns.some(([key])=>['age','gender'].includes(key)));
});
test('company classification cascades by industry then sector',()=>{
 const records=[{kind:'company',industries:['Technology'],sector:'Software',subsector:'SaaS'},{kind:'company',industries:['Technology'],sector:'Hardware',subsector:'Chips'},{kind:'company',industries:['Healthcare'],sector:'Providers',subsector:'Hospitals'}];
 assert.deepEqual(companyChildOptions(records,[]),{sectors:[],subsectors:[]});
 assert.deepEqual(companyChildOptions(records,['technology'],'Software'),{sectors:['Hardware','Software'],subsectors:['SaaS']});
 assert.deepEqual(companyChildOptions(records,['Healthcare'],'Providers'),{sectors:['Providers'],subsectors:['Hospitals']});
});
