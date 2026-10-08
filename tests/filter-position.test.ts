import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPosition} from '../src/filter-position';
test('filter panels stay inside mobile and desktop viewports at every edge',()=>{
 for(const [width,height] of [[375,667],[320,240],[1440,900],[768,450]])for(const rect of [{left:width-100,top:height-42,bottom:height-10},{left:0,top:0,bottom:30},{left:width/2,top:height/2,bottom:height/2+32}]){
  const p=filterPosition(rect,430,width,height);
  assert.ok(p.left>=12);assert.ok(p.top>=12);assert.ok(p.left+p.width<=width-12);assert.ok(p.top+p.maxHeight<=height-12);assert.ok(p.maxHeight>0);
 }
});
