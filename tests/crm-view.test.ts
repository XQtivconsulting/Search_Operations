import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCRMFilters,filterCRMRows} from '../src/crm-view';
const rows=[{external_id:'1',title:'AI Leader',status:'Open',client:'Alpha',partner:'One'},{external_id:'2',title:'Sales Leader',status:'Open',client:'Beta',partner:'Two'},{external_id:'3',title:'AI Engineer',status:'Abandoned',client:'Alpha',partner:'One'},{external_id:'4',title:'Director',status:'Open',client:'Gamma',partner:'Not assigned'}];
const apply=(f:any)=>filterCRMRows(rows,{...emptyCRMFilters(),...f},r=>r.client,r=>r.partner).map(r=>r.external_id);
test('CRM filters use OR within a column and AND across columns',()=>{
 assert.deepEqual(apply({statuses:['Open'],companies:['Alpha','Beta']}),['1','2']);
 assert.deepEqual(apply({statuses:['Open','Abandoned'],companies:['Alpha']}),['1','3']);
 assert.deepEqual(apply({statuses:['Open'],companies:['Alpha','Beta'],partners:['Two']}),['2']);
});
test('CRM filters distinguish All from None and combine text with selected values',()=>{
 assert.deepEqual(apply({}),['1','2','3','4']);assert.deepEqual(apply({statuses:[]}),[]);
 assert.deepEqual(apply({title:' ai ',statuses:['Abandoned']}),['3']);
 assert.deepEqual(apply({id:'2',companies:['Alpha']}),[]);
 assert.deepEqual(apply({partners:['Not assigned']}),['4']);
});
