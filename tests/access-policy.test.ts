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

test('navigation visibility separates monitor, performance, module gates and action permissions',async()=>{
 const {canViewPage}=await import('../src/navigation-access');
 const subject=(permissions:string[])=>({roles:['custom'],permissions});
 assert.equal(canViewPage(subject(['planning.view','nav.sourcing','nav.plan']),'Weekly plan'),true);
 assert.equal(canViewPage(subject(['planning.view','nav.sourcing','nav.plan']),'Delivery Monitor'),false);
 assert.equal(canViewPage(subject(['reports.view','nav.sourcing','nav.performance']),'Performance'),true);
 assert.equal(canViewPage(subject(['reports.view','nav.performance']),'Performance'),false);
 assert.equal(canViewPage(subject(['nav.admin','nav.integrations']),'Integrations'),false);
 assert.equal(canViewPage(subject(['nav.admin','nav.integrations','integrations.manage']),'Integrations'),true);
 assert.equal(canViewPage(subject(['nav.integrations','integrations.manage']),'Integrations'),false);
 assert.equal(canViewPage(subject([]),'Account settings'),true);
 assert.equal(canViewPage(subject([]),'Unknown page'),false);
 assert.equal(canViewPage({roles:['super_admin'],permissions:[]},'Integrations'),true);
 const p=effectivePermissions(['custom'],[{id:'custom',name:'Custom',description:'',version:1,permissions:['planning.allocate']}]);
 assert.ok(p.includes('planning.view'));assert.ok(!p.includes('nav.monitor'));assert.equal(canViewPage(subject(p),'Delivery Monitor'),false);
});
