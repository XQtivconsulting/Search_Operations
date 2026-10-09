import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier, context, next) {
  if (specifier === 'cloudflare:workers') return {url:'data:text/javascript,export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}',shortCircuit:true};
  return next(specifier,context);
}});
const {Identity} = await import('../src/identity');
const {default:worker} = await import('../src/worker');
function fixture() {
  const db = new DatabaseSync(':memory:');
  const ctx = {storage:{sql:{exec(query:string,...params:any[]) {
    if (!params.length && query.includes('CREATE TABLE')) {db.exec(query);return {toArray:()=>[]};}
    return {toArray:()=>db.prepare(query).all(...params)};
  }},transactionSync(fn:()=>any) {db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
  return {db,identity:new Identity(ctx as any,{})};
}
test('setup refuses missing or wrong secret before creating an invitation', async()=>{
  const identity={};
  const env:any={IDENTITY:{getByName:()=>identity},SETUP_KEY:'synthetic-correct'};
  for(const key of ['', 'wrong']) {
    const response=await worker.fetch(new Request('https://app.example.com/api/setup',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:'{}'}),env);
    assert.equal(response.status,404);
  }
});
test('only one concurrent first-admin invitation is created', async()=>{
  const {db,identity}=fixture();
  const results=await Promise.allSettled([
    identity.invite('one@example.com','One','test','admin',null,true),
    identity.invite('two@example.com','Two','test','admin',null,true),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invites').get()?.n,1);
});
test('first-admin setup cannot grant access once a workspace has a member', async()=>{
  const {db,identity}=fixture();
  db.exec("INSERT INTO memberships(user_id,tenant,role,status) VALUES('existing','test','admin','active')");
  await assert.rejects(identity.invite('other@example.com','Other','test','admin',null,true),/already set up/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invites').get()?.n,0);
});

test('search partner API accepts only active workspace partners and never trusts supplied names',async()=>{
 const members=[{id:'p',name:'Actual Partner',role:'partner',status:'active',email:'private@example.com'},{id:'r',name:'Researcher',role:'researcher',status:'active'},{id:'old',name:'Inactive',role:'partner',status:'revoked'}];
 let saved:any=null;
 const env:any={IDENTITY:{getByName:()=>({authenticate:async()=>({tenant:'test',role:'admin'}),members:async(tenant:string)=>{assert.equal(tenant,'test');return members;}})},WORKSPACE:{getByName:(tenant:string)=>{assert.equal(tenant,'test');return {state:async()=>({}),mutate:async(a:any,k:string,b:any)=>{saved=b;return {id:'r'};}};}}};
 const send=(partner_id:string)=>worker.fetch(new Request('https://app.example.com/api/mutate',{method:'POST',headers:{Origin:'https://app.example.com'},body:JSON.stringify({kind:'search-owner',id:'r',partner_id,partner:'Spoofed'})}),env);
 for(const id of ['r','old','foreign']) assert.equal((await send(id)).status,400);
 assert.equal(saved,null);assert.equal((await send('p')).status,200);assert.equal((saved as any).partner,'Actual Partner');
 const state=await worker.fetch(new Request('https://app.example.com/api/state'),env);
 assert.deepEqual((await state.json() as any).partners,[{id:'p',name:'Actual Partner'}]);
});

test('CRM import validates every selected partner before any workspace write',async()=>{
 let written:any=null;
 const env:any={IDENTITY:{getByName:()=>({authenticate:async()=>({tenant:'test',role:'admin'}),members:async()=>[{id:'p',name:'Verified Partner',role:'partner',status:'active'},{id:'r',name:'Researcher',role:'researcher',status:'active'}]})},WORKSPACE:{getByName:()=>({applyCRM:async(a:any,jobs:any)=>{written=jobs;return {count:jobs.length};}})}};
 const send=(jobs:any[])=>worker.fetch(new Request('https://app.example.com/api/crm/apply',{method:'POST',headers:{Origin:'https://app.example.com'},body:JSON.stringify({jobs})}),env);
 assert.equal((await send([{partner_id:'p'},{partner_id:'r'}])).status,400);assert.equal(written,null);
 assert.equal((await send([{partner_id:'p',partner:'Wrong name'}])).status,200);assert.equal((written as any)[0].partner,'Verified Partner');
});

test('password change verifies current secret, preserves account and revokes every older session',async()=>{
 const {db,identity}=fixture();const {passwordHash,passwordOK}=await import('../src/password');
 db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('synthetic','synthetic@example.com','Synthetic',passwordHash('Old-password-123'));
 db.exec("INSERT INTO memberships VALUES('synthetic','test','researcher','staff','active')");
 const one=await identity.session('synthetic'),two=await identity.session('synthetic');
 await assert.rejects(identity.changePasswordAttempt(one.token,{currentPassword:'Wrong-password',newPassword:'New-password-456',confirmPassword:'New-password-456'},'ip'),/incorrect/);
 assert.equal(db.prepare("SELECT count FROM limits WHERE key='password-user:synthetic'").get()?.count,1);
 assert.ok(await identity.authenticate(two.token,'test'));
 await assert.rejects(identity.changePasswordAttempt(one.token,{currentPassword:'Old-password-123',newPassword:'short',confirmPassword:'short'},'ip'),/12 and 128/);
 const result=await identity.changePasswordAttempt(one.token,{currentPassword:'Old-password-123',newPassword:'New-password-456',confirmPassword:'New-password-456'},'ip');
 assert.equal(await identity.authenticate(one.token,'test'),null);assert.equal(await identity.authenticate(two.token,'test'),null);assert.ok(await identity.authenticate(result.token,'test'));
 assert.ok(passwordOK('New-password-456',db.prepare('SELECT password FROM users').get()!.password as string));
 await assert.rejects(identity.changePasswordAttempt(one.token,{},'ip'),/sign in/);db.close();
});
test('password endpoint enforces same origin and returns replacement HttpOnly cookie, never a secret',async()=>{
 let changed=0;const env:any={IDENTITY:{getByName:()=>({changePasswordAttempt:async(raw:string)=>{assert.equal(raw,'synthetic-session');changed++;return {token:'synthetic-replacement'};}})}};
 const send=(origin:string,method='POST')=>worker.fetch(new Request('https://app.example.com/api/change-password',{method,headers:{Origin:origin,Cookie:'search_session=synthetic-session'},...(method==='POST'?{body:'{}'}:{})}),env);
 assert.equal((await send('https://evil.example')).status,403);assert.equal((await send('https://app.example.com','GET')).status,405);assert.equal(changed,0);const r=await send('https://app.example.com');assert.equal(r.status,200);assert.match(r.headers.get('Set-Cookie')!,/HttpOnly; Secure; SameSite=Strict/);assert.deepEqual(await r.json(),{ok:true});
});

test('replacement invitation revokes the earlier link and linked staff cannot receive a second account',async()=>{
 const {db,identity}=fixture();const first=await identity.invite('typo@example.com','One','test','researcher','staff');
 const second=await identity.invite('correct@example.com','One','test','researcher','staff');
 assert.equal((await identity.invitationInfo(first,'ip')).status,'used');
 await assert.rejects(identity.accept({token:first,email:'typo@example.com',password:'Synthetic-password-123'},'ip'),/expired/);
 await identity.accept({token:second,email:'correct@example.com',password:'Synthetic-password-123'},'ip');
 await assert.rejects(identity.invite('third@example.com','One','test','researcher',(await identity.members('test'))[0].staff_id),/already has an account/);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM memberships').get()?.n,1);db.close();
});
async function emailFixture(){const f=fixture(),{passwordHash}=await import('../src/password');f.db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('u','before@example.com','Synthetic',passwordHash('Synthetic-password-123'));f.db.exec("INSERT INTO memberships VALUES('u','test','researcher','s','active')");return {...f,session:await f.identity.session('u')};}
test('email changes require password and mailbox proof, preserve memberships and rotate sessions',async()=>{
 const {db,identity,session}=await emailFixture();
 await assert.rejects(identity.requestEmailChange(session.token,{email:'after@example.com',currentPassword:'wrong'},'ip'),/incorrect/);
 const issued=await identity.requestEmailChange(session.token,{email:'AFTER@example.com',currentPassword:'Synthetic-password-123'},'ip');
 assert.equal(db.prepare('SELECT email FROM users').get()?.email,'before@example.com');
 assert.ok(!JSON.stringify(db.prepare('SELECT * FROM email_changes').get()).includes('"'+issued.code+'"'));
 const other=await identity.session('u');await assert.rejects(identity.confirmEmailChange(other.token,{code:issued.code},'ip'),/new email verification/);
 await assert.rejects(identity.confirmEmailChange(session.token,{code:'invalid'},'ip'),/Incorrect/);
 const changed=await identity.confirmEmailChange(session.token,{code:issued.code},'ip');assert.equal(changed.email,'after@example.com');
 assert.equal(await identity.authenticate(other.token,'test'),null);assert.equal(await identity.authenticate(session.token,'test'),null);
 const a=await identity.authenticate(changed.token,'test');assert.equal(a?.staffId,'s');assert.equal(a?.id,'u');assert.equal(a?.email,'after@example.com');
 await assert.rejects(identity.confirmEmailChange(changed.token,{code:issued.code},'ip'),/new email verification/);db.close();
});
test('email codes expire, repeated guesses are throttled and concurrent email ownership is checked',async()=>{
 let f=await emailFixture();let c=await f.identity.requestEmailChange(f.session.token,{email:'after@example.com',currentPassword:'Synthetic-password-123'},'ip');f.db.exec('UPDATE email_changes SET expires=0');await assert.rejects(f.identity.confirmEmailChange(f.session.token,{code:c.code},'ip'),/new email verification/);f.db.close();
 f=await emailFixture();c=await f.identity.requestEmailChange(f.session.token,{email:'after@example.com',currentPassword:'Synthetic-password-123'},'ip');f.db.exec("INSERT INTO users VALUES('another','after@example.com','Other','unused')");await assert.rejects(f.identity.confirmEmailChange(f.session.token,{code:c.code},'ip'),/cannot be used/);assert.equal(f.db.prepare("SELECT email FROM users WHERE id='u'").get()?.email,'before@example.com');f.db.close();
 f=await emailFixture();await f.identity.requestEmailChange(f.session.token,{email:'after@example.com',currentPassword:'Synthetic-password-123'},'ip');for(let i=0;i<5;i++)await assert.rejects(f.identity.confirmEmailChange(f.session.token,{code:'invalid'},'ip'),/Incorrect/);await assert.rejects(f.identity.confirmEmailChange(f.session.token,{code:'invalid'},'ip'),/Too many/);assert.equal(f.db.prepare('SELECT email FROM users').get()?.email,'before@example.com');f.db.close();
});
test('staff directory requires admin and email-change endpoints enforce origin and method',async()=>{
 let role='researcher',calls=0;const env:any={IDENTITY:{getByName:()=>({authenticate:async()=>({tenant:'test',role}),members:async()=>{calls++;return []},pendingInvitations:async()=>[]})},WORKSPACE:{getByName:()=>({})}};
 assert.equal((await worker.fetch(new Request('https://app.example.com/api/staff-directory'),env)).status,403);assert.equal(calls,0);role='admin';assert.equal((await worker.fetch(new Request('https://app.example.com/api/staff-directory'),env)).status,200);
 for(const path of ['request','confirm']) {assert.equal((await worker.fetch(new Request('https://app.example.com/api/change-email/'+path),env)).status,405);assert.equal((await worker.fetch(new Request('https://app.example.com/api/change-email/'+path,{method:'POST',headers:{Origin:'https://other.example'},body:'{}'}),env)).status,403);}
});

function peopleFixture(){const f=fixture();f.db.exec("INSERT INTO users VALUES('owner','owner@example.com','Original Owner','synthetic'),('admin2','admin@example.com','Another Admin','synthetic'),('reader','reader@example.com','Reader','synthetic');INSERT INTO memberships VALUES('owner','test','admin',NULL,'active'),('admin2','test','admin',NULL,'active'),('reader','test','founder',NULL,'active');");return f;}
test('original administrator is retained as protected owner and accounts are not merged',async()=>{
 const {db,identity}=peopleFixture(),{hasRole}=await import('../src/domain');
 const one=await identity.members('test'),two=await identity.members('test');assert.equal(one.length,3);assert.equal(two.length,3);
 assert.ok(hasRole(one.find(m=>m.id==='owner')!,'super_admin'));assert.ok(!hasRole(one.find(m=>m.id==='admin2')!,'super_admin'));
 assert.equal(db.prepare('SELECT COUNT(*) n FROM workspace_owners').get()?.n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM member_events').get()?.n,1);
 assert.equal(new Set(one.map(m=>m.email)).size,3);db.close();
});
test('only super admin can change assigned roles, last owner and staff links are protected',async()=>{
 const {db,identity}=peopleFixture(),all=await identity.members('test');const owner=all.find(m=>m.id==='owner')!,admin=all.find(m=>m.id==='admin2')!,reader=all.find(m=>m.id==='reader')!;
 await identity.updateMember(owner as any,{...owner,roles:['super_admin','admin','partner','researcher'],staff_id:owner.staff_id});
 let current=(await identity.members('test')).find(m=>m.id==='owner')!;assert.deepEqual(current.roles,['super_admin','admin','partner','researcher']);assert.equal(current.staff_id,'person:owner');
 await assert.rejects(identity.updateMember(owner as any,{...current,roles:['research_lead']}),/at least one/);
 await assert.rejects(identity.updateMember(admin as any,{...current,name:'Takeover',roles:['admin']}),/Only a super/);
 await assert.rejects(identity.updateMember(admin as any,{...reader,roles:['super_admin']}),/Only a super/);
 await assert.rejects(identity.revoke('test','owner','admin2'),/Only a super/);
 await assert.rejects(identity.updateMember(admin as any,{...reader,roles:['partner']}),/Only a super admin/);
 await identity.updateMember(owner as any,{...reader,name:'Updated Person',roles:['research_lead','partner']});
 const updated=(await identity.members('test')).find(m=>m.id==='reader')!;assert.equal(updated.name,'Updated Person');assert.deepEqual(updated.roles,['research_lead','partner']);
 await assert.rejects(identity.updateMember(admin as any,{...reader,roles:['partner']}),/changed/);
 await identity.updateMember(owner as any,{...updated,roles:['researcher'],staff_id:updated.staff_id});assert.equal((await identity.members('test')).find(m=>m.id==='reader')?.staff_id,'person:reader');
 await assert.rejects(identity.updateMember(owner as any,{...current,staff_id:'other-staff'}),/cannot be replaced/);
 await assert.rejects(identity.updateMember({...owner,tenant:'foreign'} as any,{...current}),/permission/);db.close();
});
test('membership changes take effect on existing sessions and prevent privilege escalation by readers',async()=>{
 const {db,identity}=peopleFixture(),all=await identity.members('test'),owner=all.find(m=>m.id==='owner')!,reader=all.find(m=>m.id==='reader')!;
 const session=await identity.session('reader');await assert.rejects(identity.updateMember(reader as any,{...reader,roles:['admin']}),/permission/);
 await identity.updateMember(owner as any,{...reader,roles:['researcher','partner'],staff_id:reader.staff_id});
 const actor=await identity.authenticate(session.token,'test');assert.deepEqual(actor?.roles,['researcher','partner']);assert.equal(actor?.staffId,'person:reader');
 const current=(await identity.members('test')).find(m=>m.id==='reader')!;await identity.updateMember(owner as any,{...current,status:'revoked'});assert.equal(await identity.authenticate(session.token,'test'),null);db.close();
});
test('multi-role invitations retain all roles; duplicate email cannot create another workspace membership',async()=>{
 const {db,identity}=fixture();const invite=await identity.invite('dual@example.com','Dual Person','test','researcher','s',false,['researcher','partner']);
 await identity.accept({token:invite,email:'dual@example.com',password:'Synthetic-password-123'},'ip');
 const members=await identity.members('test');assert.deepEqual(members[0].roles,['researcher','partner']);
 await assert.rejects(identity.invite('dual@example.com','Other Name','test','admin',null),/already has a workspace account/);assert.equal(members.length,1);db.close();
});
test('switched browser cookie is blocked before writes to a different account, including password and logout',async()=>{
 const {db,identity}=peopleFixture();const a=await identity.session('owner'),b=await identity.session('admin2');let writes=0;
 const env:any={IDENTITY:{getByName:()=>identity},WORKSPACE:{getByName:()=>({mutate:async()=>{writes++;return{};},state:async()=>({staff:[],entries:[]})})}};
 for(const path of ['mutate','logout','change-password','change-email/request','members/update']) {
  const r=await worker.fetch(new Request('https://app.example.com/api/'+path,{method:'POST',headers:{Origin:'https://app.example.com',Cookie:'search_session='+b.token,'X-Expected-User':'owner','X-Workspace':'test'},body:JSON.stringify({kind:'staff',name:'Forbidden'})}),env);
  assert.equal(r.status,409,path);assert.equal((await r.json() as any).code,'SESSION_CHANGED');
 }
 assert.equal(writes,0);assert.ok(await identity.authenticate(a.token,'test'));assert.ok(await identity.authenticate(b.token,'test'));
 const r=await worker.fetch(new Request('https://app.example.com/api/session',{headers:{Cookie:'search_session='+b.token,'X-Expected-User':'admin2'}}),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),{id:'admin2',email:'admin@example.com'});db.close();
});
test('manual count endpoints are retired and cross-workspace role updates are rejected',async()=>{
 const {db,identity}=peopleFixture(),session=await identity.session('owner');let writes=0;
 const env:any={IDENTITY:{getByName:()=>identity},WORKSPACE:{getByName:()=>({mutate:async()=>{writes++;},bulk:async()=>{writes++;}})}};
 const send=(path:string,body:any)=>worker.fetch(new Request('https://app.example.com/api/'+path,{method:'POST',headers:{Origin:'https://app.example.com',Cookie:'search_session='+session.token,'X-Workspace':'test','X-Expected-User':'owner'},body:JSON.stringify(body)}),env);
 assert.equal((await send('mutate',{kind:'entry'})).status,410);assert.equal((await send('bulk',{changes:[{kind:'review'}]})).status,410);assert.equal(writes,0);
 assert.equal((await send('members/update',{id:'not-in-workspace',version:0,roles:['admin']})).status,404);db.close();
});

test('reset test people preserves original owner, password and foreign memberships; invalidates other access and invitations',async()=>{
 const {db,identity}=peopleFixture(),all=await identity.members('test'),owner=all.find(m=>m.id==='owner')!;
 const otherSession=await identity.session('reader'),ownerSession=await identity.session('owner');const password=db.prepare("SELECT password FROM users WHERE id='owner'").get()!.password;
 db.exec("INSERT INTO memberships VALUES('reader','foreign','founder',NULL,'active')");
 const pending=await identity.invite('pending@example.com','Pending','test','researcher',null);
 await assert.rejects(identity.resetTestPeople(all.find(m=>m.id==='admin2') as any,{preview:true}),/original workspace owner/);
 const preview:any=await identity.resetTestPeople(owner as any,{preview:true});assert.equal(preview.remove.length,2);assert.equal(preview.keep.id,'owner');
 await assert.rejects(identity.resetTestPeople(owner as any,{signature:preview.signature,confirmEmail:'wrong@example.com'}),/email/);
 const result=await identity.resetTestPeople(owner as any,{signature:preview.signature,confirmEmail:owner.email});assert.equal(result.removed,2);assert.equal((await identity.members('test')).length,1);assert.equal(await identity.authenticate(otherSession.token,'test'),null);assert.ok(await identity.authenticate(otherSession.token,'foreign'));assert.ok(await identity.authenticate(ownerSession.token,'test'));assert.equal(db.prepare("SELECT password FROM users WHERE id='owner'").get()!.password,password);assert.equal((await identity.invitationInfo(pending,'ip')).status,'used');
 await assert.rejects(identity.resetTestPeople(owner as any,{signature:preview.signature,confirmEmail:owner.email}),/changed/);db.close();
});
test('new researcher invitation has no person allocation until accepted; role upgrades use account identity',async()=>{
 const {db,identity}=fixture();const invite=await identity.invite('new@example.com','New Person','test','researcher',null,false,['researcher','partner']);assert.equal((await identity.members('test')).length,0);assert.equal((await identity.pendingInvitations('test'))[0].staff_id,null);
 await identity.accept({token:invite,email:'new@example.com',password:'Synthetic-password-123'},'ip');const person=(await identity.members('test'))[0];assert.equal(person.staff_id,'person:'+person.id);assert.deepEqual(person.roles,['researcher','partner']);db.close();
});

test('manual search creation reaches the workspace and validates the partner',async()=>{
 let written=false;
 const env:any={IDENTITY:{getByName:()=>({authenticate:async()=>({tenant:'test',role:'admin'}),members:async()=>[]})},WORKSPACE:{getByName:()=>({mutate:async()=>{written=true;return {id:'local-search'};}})}};
 const send=(body:any)=>worker.fetch(new Request('https://app.example.com/api/mutate',{method:'POST',headers:{Origin:'https://app.example.com'},body:JSON.stringify(body)}),env);
 const res=await send({kind:'search',title:'Manual role',client:'Synthetic'});
 assert.equal(res.status,200);assert.equal(written,true);assert.equal((await res.json() as any).id,'local-search');
 written=false;assert.equal((await send({kind:'search',title:'Manual role',client:'Synthetic',partner_id:'foreign'})).status,400);assert.equal(written,false);
});

test('full reset endpoint checks original owner and email before workspace deletion, preserves account',async()=>{
 const {db,identity}=peopleFixture();let resets=0;
 const env:any={IDENTITY:{getByName:()=>identity},WORKSPACE:{getByName:()=>({previewReset:async()=>({signature:'snapshot',counts:{searches:1}}),resetWorkspace:async()=>{resets++;return {backupId:'saved'};},syncPeople:async()=>{}})}};
 const ownerSession=await identity.session('owner'),otherSession=await identity.session('admin2');
 const send=(token:string,body:any)=>worker.fetch(new Request('https://app.example.com/api/workspace-reset',{method:'POST',headers:{Origin:'https://app.example.com',Cookie:'search_session='+token,'X-Workspace':'test'},body:JSON.stringify(body)}),env);
 assert.equal((await send(otherSession.token,{action:'preview'})).status,403);
 const preview:any=await (await send(ownerSession.token,{action:'preview'})).json();
 assert.equal((await send(ownerSession.token,{action:'reset',peopleSignature:preview.people.signature,signature:preview.signature,confirmEmail:'incorrect@example.com'})).status,400);assert.equal(resets,0);
 const response=await send(ownerSession.token,{action:'reset',peopleSignature:preview.people.signature,signature:preview.signature,confirmEmail:preview.people.keep.email});
 assert.equal(response.status,200);assert.equal((await response.json() as any).ok,true);assert.equal(resets,1);assert.equal((await identity.members('test')).length,1);assert.ok(await identity.authenticate(ownerSession.token,'test'));db.close();
});

test('super admins manage tenant-scoped role templates with immediate session changes and protected owner',async()=>{
 const {db,identity}=peopleFixture(),{hasRole,canPlan}=await import('../src/domain');
 try{
  const all=await identity.members('test'),owner=all.find(m=>m.id==='owner')!,admin=all.find(m=>m.id==='admin2')!,reader=all.find(m=>m.id==='reader')!;
  await assert.rejects(identity.rolePolicy(reader as any,{action:'save',name:'Escalation',permissions:['roles.manage','users.access']}),/permission/);
  await assert.rejects(identity.rolePolicy({...admin,tenant:'foreign'} as any,{action:'save',name:'Cross tenant',permissions:['roles.manage','users.access']}),/permission/);
  const created=await identity.rolePolicy(owner as any,{action:'save',name:'Custom associate',permissions:['reviews.submit','engagement.work']});
  let catalog=await identity.roleCatalog(admin as any),role=catalog.roles.find(r=>r.id===created.id)!;
  await identity.updateMember(owner as any,{...reader,roles:[created.id]});
  const session=await identity.session('reader');let actor=await identity.authenticate(session.token,'test');
  assert.equal(actor?.staffId,'person:reader');assert.equal(hasRole(actor!,'researcher'),true);assert.equal(hasRole(actor!,'engagement'),true);assert.equal(canPlan(actor!),false);
  await assert.rejects(identity.rolePolicy(owner as any,{...role,action:'delete'}),/Reassign/);
  await identity.rolePolicy(owner as any,{...role,action:'save',permissions:['planning.allocate']});
  actor=await identity.authenticate(session.token,'test');assert.equal(hasRole(actor!,'researcher'),false);assert.equal(canPlan(actor!),true);assert.equal(actor?.staffId,'person:reader');
  await assert.rejects(identity.rolePolicy(owner as any,{...role,action:'save',permissions:['roles.manage','users.access']}),/changed/);
  await assert.rejects(identity.rolePolicy(owner as any,{action:'save',name:'Bad',permissions:['super_admin']}),/recognized/);
  await assert.rejects(identity.rolePolicy(owner as any,{action:'delete',id:'super_admin'}),/protected/);
  await assert.rejects(identity.updateMember(admin as any,{...owner,roles:[created.id]}),/Only a super/);
  const other=await identity.invite('other-tenant@example.com','Other','foreign','researcher',null);
  await assert.rejects(identity.validRoles('foreign',[created.id]),/valid workspace roles/);
  const latest=(await identity.members('test')).find(m=>m.id==='reader')!;
  await identity.updateMember(owner as any,{...latest,roles:['researcher']});
  role=(await identity.roleCatalog(admin as any)).roles.find(r=>r.id===created.id)!;
  const invite=await identity.invite('custom@example.com','Custom','test',created.id,null);
  await assert.rejects(identity.rolePolicy(owner as any,{...role,action:'delete'}),/Reassign/);
  const pending=(await identity.pendingInvitations('test')).find(i=>i.email==='custom@example.com')!;
  await identity.cancelInvitation(admin as any,pending.id);
  await identity.rolePolicy(owner as any,{...role,action:'delete'});
  assert.equal((await identity.roleCatalog(admin as any)).roles.some(r=>r.id===created.id),false);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM member_events WHERE user_id=?").get('role:'+created.id)!.n);
  assert.equal(hasRole((await identity.members('test')).find(m=>m.id==='owner')!,'super_admin'),true);
 }finally{db.close();}
});
test('changing a role to sourcing provisions stable identities for existing members',async()=>{
 const {db,identity}=peopleFixture();
 try{
  const people=await identity.members('test'),admin=people.find(m=>m.id==='admin2')!,owner=people.find(m=>m.id==='owner')!,reader=people.find(m=>m.id==='reader')!;
  const created=await identity.rolePolicy(owner as any,{action:'save',name:'Evolving role',permissions:[]});
  await identity.updateMember(owner as any,{...reader,roles:[created.id]});
  assert.equal((await identity.members('test')).find(m=>m.id==='reader')?.staff_id,'person:reader');
  const role=(await identity.roleCatalog(admin as any)).roles.find(r=>r.id===created.id)!;
  await identity.rolePolicy(owner as any,{...role,action:'save',permissions:['reviews.submit']});
  assert.equal((await identity.members('test')).find(m=>m.id==='reader')?.staff_id,'person:reader');
 }finally{db.close();}
});


test('invitation API permits Super Admin grants only from an actual Super Admin, including combined roles',async()=>{
 const {db,identity}=peopleFixture();
 try{
  await identity.members('test');const adminSession=await identity.session('admin2'),ownerSession=await identity.session('owner');
  const env:any={IDENTITY:{getByName:()=>identity},WORKSPACE:{getByName:()=>({})}};
  const invite=(session:string,assigned:string[],email:string)=>worker.fetch(new Request('https://app.example.com/api/invite?workspace=test',{method:'POST',headers:{Origin:'https://app.example.com',Cookie:'search_session='+session},body:JSON.stringify({name:'Synthetic Invite',email,roles:assigned})}),env);
  for(const assigned of [['super_admin'],['admin','super_admin']]){
   const response=await invite(adminSession.token,assigned,'blocked@example.com');assert.equal(response.status,403);assert.match(JSON.stringify(await response.json()),/Only a super admin/);
  }
  assert.equal(db.prepare('SELECT COUNT(*) n FROM invites').get()?.n,0);
  const allowed=await invite(ownerSession.token,['super_admin'],'allowed@example.com');assert.equal(allowed.status,200);
  assert.deepEqual((await identity.pendingInvitations('test'))[0].roles,['super_admin']);
  assert.equal((await invite(adminSession.token,['admin'],'ordinary@example.com')).status,200);
 }finally{db.close();}
});

test('role header counts reconcile with directory assignments, including multi-role and revoked members',async()=>{
 const {db,identity}=peopleFixture();
 try{
  let people=await identity.members('test');const owner=people.find(m=>m.id==='owner')!;const reader=people.find(m=>m.id==='reader')!;
  await identity.updateMember(owner as any,{...reader,roles:['admin','engagement'],status:'revoked'});
  const catalog=await identity.roleCatalog(owner as any);people=await identity.members('test');
  assert.equal(catalog.superAdminUsers,people.filter(m=>m.roles.includes('super_admin')).length);
  for(const role of catalog.roles)assert.equal(role.users,people.filter(m=>m.roles.includes(role.id)).length);
  assert.equal(catalog.roles.find(r=>r.id==='engagement')?.users,1);
  await assert.rejects(identity.roleCatalog({...owner,tenant:'foreign'} as any),/permission/);
 }finally{db.close();}
});

test('member roles and permissions resolve only from the current master, including after edits',async()=>{
 const {db,identity}=peopleFixture();
 db.exec("INSERT INTO member_profiles VALUES('reader','test','[\"researcher\",\"planner\"]','Synthetic researcher',1)");
 let person=(await identity.members('test')).find(m=>m.id==='reader')!;
 assert.deepEqual(person.roles,['researcher']);assert.ok(!person.permissions.includes('planning.allocate'));
 const owner=(await identity.members('test')).find(m=>m.id==='owner')!;
 const custom=await identity.rolePolicy(owner as any,{action:'save',name:'Delivery coordinator',permissions:['planning.allocate']});
 await identity.updateMember(owner as any,{id:'reader',version:person.version,name:person.name,status:'active',roles:[custom.id]});
 person=(await identity.members('test')).find(m=>m.id==='reader')!;assert.deepEqual(person.roles,[custom.id]);assert.ok(person.permissions.includes('planning.allocate'));
 await assert.rejects(identity.updateMember(owner as any,{id:'reader',version:person.version,roles:['planner']}),/valid workspace roles/);db.close();
});


test('permission grid saves atomically, rejects delegated admins and stale rows',async()=>{
 const {db,identity}=peopleFixture();try{
  const people=await identity.members('test'),owner=people.find(m=>m.id==='owner')!,admin=people.find(m=>m.id==='admin2')!;
  await assert.rejects(identity.rolePolicy({...admin,roles:['super_admin']} as any,{action:'save',name:'Blocked',permissions:[]}),/Super Admin permission/);
  const catalog=await identity.roleCatalog(owner as any),one=catalog.roles[0],two=catalog.roles[1];
  const changes=[{...one,permissions:['candidates.view']},{...two,permissions:['companies.view']}];
  const before=db.prepare('SELECT COUNT(*) n FROM member_events').get()!.n;
  await assert.rejects(identity.rolePolicy(owner as any,{action:'batch',roles:[changes[0],{...changes[1],version:-1}]}),/changed/);
  const unchanged=await identity.roleCatalog(owner as any);assert.deepEqual(unchanged.roles.find(r=>r.id===one.id)?.permissions,one.permissions);assert.equal(db.prepare('SELECT COUNT(*) n FROM member_events').get()!.n,before);
  await identity.rolePolicy(owner as any,{action:'batch',roles:changes});
  const saved=await identity.roleCatalog(owner as any);for(const change of changes){const role=saved.roles.find(r=>r.id===change.id)!;assert.deepEqual(role.permissions,change.permissions);assert.equal(role.version,change.version+1);}
  await assert.rejects(identity.rolePolicy(admin as any,{action:'batch',roles:changes}),/Super Admin permission/);
 }finally{db.close();}
});

test('extension API requires same-origin authenticated current membership and detects account switching',async()=>{
 const {db,identity}=peopleFixture();let writes=0;try{
 const session=await identity.session('reader');await identity.members('test');
 const env:any={IDENTITY:{getByName:()=>identity},WORKSPACE:{getByName:()=>({profileImport:async(a:any)=>{writes++;return {actor:a.id};}})}};
 const send=(cookie:string,origin:string,expected='reader')=>worker.fetch(new Request('https://app.example.com/api/profile-import/commit',{method:'POST',headers:{Origin:origin,Cookie:'search_session='+cookie,'X-Workspace':'test','X-Expected-User':expected},body:'{}'}),env);
 assert.equal((await send(session.token,'https://evil.example')).status,403);assert.equal((await send(session.token,'https://app.example.com','someone-else')).status,409);
 assert.equal((await send('invalid','https://app.example.com')).status,409);assert.equal(writes,0);
 assert.equal((await send(session.token,'https://app.example.com')).status,200);
 db.prepare("UPDATE memberships SET status='revoked' WHERE user_id='reader'").run();assert.equal((await send(session.token,'https://app.example.com')).status,401);assert.equal(writes,1);
 }finally{db.close();}
});
