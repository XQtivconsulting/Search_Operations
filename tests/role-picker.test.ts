import test from 'node:test';import assert from 'node:assert/strict';
import {matchingRoles,roleDisplayId} from '../src/RolePicker';
test('role picker searches ID, company and title and sorts IDs numerically without mutating input',()=>{
 const roles=[{id:'local-b',external_id:'100',client:'Alpha',title:'Sales leader'},{id:'local-a',external_id:'20',client:'Zulu',title:'Sales director'},{id:'manual-1',client:'Beta',title:'Engineer'}];
 assert.deepEqual(matchingRoles(roles,'sales zulu','company').map(r=>r.id),['local-a']);
 assert.equal(matchingRoles(roles,'100','id')[0].client,'Alpha');
 assert.deepEqual(matchingRoles(roles,'sales','id').map(r=>r.external_id),['20','100']);
 assert.deepEqual(matchingRoles(roles,'','company').map(r=>r.client),['Alpha','Beta','Zulu']);
 assert.equal(roleDisplayId(roles[2]),'manual-1');assert.equal(roles[0].external_id,'100');
 assert.equal(matchingRoles(roles,'missing','id').length,0);
});
