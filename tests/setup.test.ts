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
