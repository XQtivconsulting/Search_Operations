import test from 'node:test';
import assert from 'node:assert/strict';
import {mappingImportSummary,readyMappingRows} from '../src/mapping-preview';
import {planHistoricalMappings} from '../src/mapping-import';
test('partial import leaves errors and unresolved identities out, with totals accounting for every row',()=>{
 const plan=[{row:2,result:'Create mapping'},{row:3,result:'Update attribution'},{row:4,result:'Existing mapping — keep unchanged'},{row:5,result:'Skip'},{row:6,result:'Error',error:'Missing name'},{row:7,result:'Create mapping',needs_choice:true},{row:8,result:'Duplicate row — skip'}];
 assert.deepEqual(mappingImportSummary(plan),{create:1,enrich:0,update:1,unchanged:1,skipped:2,unresolved:2});const rows=plan.map(r=>({row:r.row,choice:r.row===5?'skip':''}));const ready=readyMappingRows(rows,plan);assert.equal(ready[4].choice,'skip');assert.equal(ready[5].choice,'skip');assert.equal(rows[4].choice,'');assert.equal(ready[0].choice,'');
 const validated=planHistoricalMappings(ready.slice(4,6),[],[],[],[]);assert.ok(validated.every(r=>r.result==='Skip'&&!r.error));
});
