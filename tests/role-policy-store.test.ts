import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {identitySchema} from '../src/schema';
import {rolePolicySchema,roleDefinitions,mutateRolePolicy,validateAssignedRoles} from '../src/role-policy-store';
test('role storage isolates tenants, protects assigned roles and records versioned changes',()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(identitySchema);sqlite.exec(rolePolicySchema);
 const db={rows:(q:string,...p:any[])=>sqlite.prepare(q).all(...p) as any[]};
 try{
  const initial=roleDefinitions(db,'one');assert.equal(initial.length,9);
  const created=mutateRolePolicy(db,'one','admin',{action:'save',name:'Custom',permissions:['engagement.work']});
  const role=roleDefinitions(db,'one').find(r=>r.id===created.id)!;
  assert.throws(()=>validateAssignedRoles(db,'two',[role.id]),/valid workspace roles/);
  assert.throws(()=>mutateRolePolicy(db,'two','admin',{...role,action:'save'}),/not found/);
  assert.throws(()=>mutateRolePolicy(db,'one','admin',{...role,version:0,action:'save'}),/changed/);
  db.rows("INSERT INTO memberships VALUES('person','one',?,NULL,'active')",role.id);
  assert.throws(()=>mutateRolePolicy(db,'one','admin',{...role,action:'delete'}),/Reassign/);
  mutateRolePolicy(db,'one','admin',{...role,action:'save',permissions:['reviews.submit']});
  assert.equal(db.rows("SELECT staff_id FROM memberships WHERE user_id='person'")[0].staff_id,'person:person');
  assert.equal(roleDefinitions(db,'one').find(r=>r.id===role.id)?.version,2);
  assert.equal(roleDefinitions(db,'two').length,9);
  assert.throws(()=>mutateRolePolicy(db,'one','admin',{action:'save',name:'Bad',permissions:['super_admin']}),/recognized/);
  const unused=initial.find(r=>r.id==='engagement')!;mutateRolePolicy(db,'one','admin',{...unused,action:'delete'});
  assert.equal(roleDefinitions(db,'one').some(r=>r.id==='engagement'),false);
  assert.equal(db.rows("SELECT COUNT(*) n FROM member_events WHERE tenant='one'")[0].n,3);
 }finally{sqlite.close();}
});
