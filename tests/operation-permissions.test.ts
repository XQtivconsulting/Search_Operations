import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeMutation,authorizeResearch} from '../src/operation-permissions';
const actor=(permissions:string[])=>({id:'synthetic',tenant:'test',name:'Synthetic',email:'synthetic@example.com',role:'admin',roles:['admin'],permissions,accessRoles:['admin','planner','researcher'],staffId:'self'});
const db={rows:()=>[] as any[]};
test('allocation permission cannot create searches, make decisions, manage users or configure strategy',()=>{
 const a=actor(['planning.allocate']);
 assert.equal(authorizeMutation(db,a,'assignment',{}).id,a.id);
 for(const kind of ['search','decision','team','search-remove','search-owner','unknown'])assert.throws(()=>authorizeMutation(db,a,kind,{}),/Permission required/);
 for(const action of ['candidate-save','brief-save','strategy-save','engagement-pipeline-save','unknown'])assert.throws(()=>authorizeResearch(db,a,{action}),/permission|required/i);
});
test('keyword guidance cannot change or approve fit criteria',()=>{
 const stored={rows:()=>[{data:JSON.stringify({draft:'Old guidance',criteria:[{id:'fit',label:'Experience'}]})}]};
 const a=actor(['search.keywords']);
 assert.ok(authorizeResearch(stored,a,{action:'strategy-save',id:'s',content:'New guidance',criteria:[{id:'fit',label:'Experience'}]}));
 assert.throws(()=>authorizeResearch(stored,a,{action:'strategy-save',id:'s',content:'New guidance',criteria:[]}),/search.fit/);
 assert.throws(()=>authorizeResearch(stored,a,{action:'strategy-approve',id:'s'}),/search.fit/);
});
test('PTO own, others existing, and others new are independently authorized',()=>{
 assert.ok(authorizeMutation(db,actor(['pto.self']),'pto',{staff_id:'self',work_date:'2026-10-05'}));
 assert.throws(()=>authorizeMutation(db,actor(['pto.self']),'pto',{staff_id:'other'}),/pto.all/);
 assert.ok(authorizeMutation({rows:()=>[{pto:1}]},actor(['pto.edit']),'pto',{staff_id:'other'}));
 assert.throws(()=>authorizeMutation(db,actor(['pto.edit']),'pto',{staff_id:'other'}),/pto.all/);
});
test('review actions use persisted stage, not a caller supplied stage',()=>{
 assert.throws(()=>authorizeResearch({rows:()=>[{data:JSON.stringify({status:'Partner review'})}]},actor(['reviews.team']),{id:'m',action:'mapping-review',status:'Peer review'}),/reviews.partner/);
 const a=actor(['engagement.work']);
 assert.equal(authorizeResearch(db,a,{action:'engagement-update'}),a);
 assert.throws(()=>authorizeResearch(db,a,{action:'engagement-interview-save'}),/engagement.interviews/);
});
