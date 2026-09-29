import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTableValues} from '../src/table-sort';
test('table sort compares counts numerically, text naturally and leaves blanks last in both directions',()=>{
 assert.deepEqual([20,3,100,0].sort((a,b)=>compareTableValues(a,b)),[0,3,20,100]);
 assert.deepEqual([20,3,100,0].sort((a,b)=>compareTableValues(a,b,true)),[100,20,3,0]);
 assert.deepEqual(['Role 10','role 2','Alpha'].sort((a,b)=>compareTableValues(a,b)),['Alpha','role 2','Role 10']);
 assert.deepEqual(['','2026-09-21','2026-09-07'].sort((a,b)=>compareTableValues(a,b,true)),['2026-09-21','2026-09-07','']);
});
