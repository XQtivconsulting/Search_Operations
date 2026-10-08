import test from 'node:test';
import assert from 'node:assert/strict';
import {skipMappingRow} from '../src/mapping-preview';
import {apiResponse} from '../src/api-response';
import {planHistoricalMappings} from '../src/mapping-import';

test('skipping an invalid mapping clears its blocker and invalidates the preview signature',()=>{
 const rows=[{row:2,choice:'',search_number:1},{row:3,search_number:1,mapped_by:'Synthetic researcher',mapped_on:'2026-01-01',first_name:'Synthetic',last_name:'Person',url:'https://www.linkedin.com/in/synthetic-import-preview'}];
 const searches=[{id:'s',search_number:1}],plan=planHistoricalMappings(rows,searches,[],[],[]);
 assert.ok(plan[0].error);
 const before={signature:'old',plan},after=skipMappingRow(before,2);
 assert.equal(after.signature,null);assert.equal(after.plan[0].result,'Skip');assert.equal(after.plan[0].error,undefined);assert.equal(after.plan[0].needs_choice,false);
 assert.ok(before.plan[0].error);assert.equal(after.plan[1],before.plan[1]);
 const verified=planHistoricalMappings(rows.map(r=>r.row===2?{...r,choice:'skip'}:r),searches,[],[],[]);
 assert.equal(verified[0].result,'Skip');assert.equal(verified[1].result,'Create mapping');assert.ok(!verified.some(r=>r.error||r.needs_choice));
});
test('HTML API errors report HTTP status and request reference without displaying HTML',async()=>{
 await assert.rejects(()=>apiResponse(new Response('<!DOCTYPE html><body>gateway</body>',{status:502,headers:{'cf-ray':'synthetic-reference'}})),/HTTP 502.*synthetic-reference/);
 assert.deepEqual(await apiResponse(Response.json({error:'Validation failed'})),{error:'Validation failed'});
});
