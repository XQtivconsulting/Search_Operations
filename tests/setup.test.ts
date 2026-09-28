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
 await assert.rejects(identity.invite('third@example.com','One','test','researcher','staff'),/already has an account/);
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
