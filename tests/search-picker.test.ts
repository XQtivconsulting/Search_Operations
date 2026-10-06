import test from 'node:test';import assert from 'node:assert/strict';
import {matchingSearches,searchDisplayId} from '../src/SearchPicker';
test('search picker searches ID, company and title and sorts IDs numerically without mutating input',()=>{
 const roles=[{id:'local-b',external_id:'100',client:'Alpha',title:'Sales leader'},{id:'local-a',external_id:'20',client:'Zulu',title:'Sales director'},{id:'manual-1',client:'Beta',title:'Engineer'}];
 assert.deepEqual(matchingSearches(roles,'sales zulu','company').map(r=>r.id),['local-a']);
 assert.equal(matchingSearches(roles,'100','id')[0].client,'Alpha');
 assert.deepEqual(matchingSearches(roles,'sales','id').map(r=>r.external_id),['20','100']);
 assert.deepEqual(matchingSearches(roles,'','company').map(r=>r.client),['Alpha','Beta','Zulu']);
 assert.equal(searchDisplayId(roles[2]),'Unnumbered');assert.equal(roles[0].external_id,'100');
 assert.equal(matchingSearches(roles,'missing','id').length,0);
});

test('sequential Search ID takes precedence over CRM ID',()=>{const rows=[{id:'a',search_number:12,external_id:'1',client:'A',title:'Leader'},{id:'b',search_number:2,external_id:'999',client:'B',title:'Leader'}];assert.equal(searchDisplayId(rows[0]),'12');assert.deepEqual(matchingSearches(rows,'','id').map(r=>r.id),['b','a']);});
