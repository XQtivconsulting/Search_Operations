import test from 'node:test';
import assert from 'node:assert/strict';
import {effectivePermissions,effectiveAccessRoles,hasPermission,roleTemplates,permissionIds} from '../src/access-policy';
const actor=(role:string)=>({roles:[role],permissions:effectivePermissions([role],roleTemplates)});
test('default matrix separates partner, research, engagement and administration',()=>{
 assert.equal(hasPermission(actor('researcher'),'search.jd'),true);
 assert.equal(hasPermission(actor('researcher'),'search.fit'),false);
 assert.equal(hasPermission(actor('researcher'),'engagement.work'),false);
 assert.equal(hasPermission(actor('research_lead'),'search.keywords'),true);
 assert.equal(hasPermission(actor('engagement_lead'),'search.keywords'),false);
 assert.equal(hasPermission(actor('engagement_lead'),'engagement.assign'),true);
 assert.equal(hasPermission(actor('partner'),'users.profile'),true);
 assert.equal(hasPermission(actor('partner'),'users.access'),false);
 assert.equal(hasPermission(actor('partner'),'reviews.submit'),false);
 assert.equal(hasPermission(actor('partner'),'search.delete'),false);
 assert.equal(hasPermission(actor('admin'),'search.delete'),true);
 assert.equal(hasPermission(actor('admin'),'roles.manage'),true);
});
test('saved policy overrides role names and unknown roles fail closed',()=>{
 assert.equal(hasPermission({roles:['admin'],permissions:[]},'roles.manage'),false);
 assert.deepEqual(effectivePermissions(['unknown'],roleTemplates),[]);
 assert.deepEqual(effectiveAccessRoles(['unknown'],roleTemplates),[]);
 assert.equal(hasPermission({roles:['super_admin'],permissions:[]},'roles.manage'),true);
 assert.deepEqual(effectivePermissions(['super_admin'],[]),permissionIds);
});
test('role combinations include necessary viewing but not adjacent editing powers',()=>{
 const definitions=[{id:'custom',name:'Coordinator',description:'',permissions:['planning.allocate','candidates.edit'],version:1}];
 const p=effectivePermissions(['custom'],definitions);
 assert.ok(p.includes('planning.view'));assert.ok(p.includes('candidates.view'));assert.ok(p.includes('search.view'));
 assert.ok(!p.includes('planning.decisions'));assert.ok(!p.includes('search.fit'));assert.ok(!p.includes('users.access'));
});
