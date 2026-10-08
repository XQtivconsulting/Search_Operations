// Historical manual counts are no longer an exposed workflow. These checks preserve stored history and rollback guarantees.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';
import { parseClipboard, gridCount } from '../src/grid';
import type { Actor } from '../src/domain';
// Run the actual workspace methods on SQLite; only the Cloudflare base class is substituted.
registerHooks({resolve(specifier, context, next) {
  if(specifier === 'cloudflare:workers') return {url:'data:text/javascript,export class DurableObject { constructor(ctx,env) {this.ctx=ctx;this.env=env} }',shortCircuit:true};
  return next(specifier,context);
}});
const { Workspace } = await import('../src/workspace');
const actor: Actor = {id:'admin',name:'Test',email:'codex-tests@yiaknolei.resend.app',tenant:'test',role:'admin',staffId:null};
function fixture(env:any={}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  const ctx = {storage: {sql: {exec(query:string,...params:any[]) {
    if(!params.length && query.includes('CREATE TABLE')) {db.exec(query); return {toArray:()=>[]};}
    return {toArray:()=>db.prepare(query).all(...params)};
  }}, transactionSync(fn:()=>any) {db.exec('BEGIN');try {const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
  const w = new Workspace(ctx as any, env);
  db.exec("INSERT INTO teams VALUES('t','Blue'); INSERT INTO staff VALUES('s','Researcher'); INSERT INTO searches(id,client,title) VALUES('r','Synthetic','Test role'); INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('a','r','t','2026-09-27'); INSERT INTO entries(id,assignment_id,staff_id) VALUES('e','a','s'); INSERT INTO staff VALUES('s2','Other'); INSERT INTO entries(id,assignment_id,staff_id) VALUES('e2','a','s2');");
  return {db,w,ctx};
}
test('bulk writes persist all rows and audit each change',async()=>{
  const {db,w}=fixture();
  await w.bulk(actor,[{kind:'entry',id:'e',version:1,mapped:12,notes:'A'},{kind:'entry',id:'e2',version:1,mapped:8,notes:'B'}]);
  assert.equal(db.prepare('SELECT SUM(mapped) n FROM entries').get()?.n,20);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get()?.n,2); db.close();
});
test('stale second row rolls back first row and audit',async()=>{
  const {db,w}=fixture();
  await assert.rejects(w.bulk(actor,[{kind:'entry',id:'e',version:1,mapped:12},{kind:'entry',id:'e2',version:99,mapped:8}]),/No rows were saved/);
  assert.equal(db.prepare("SELECT mapped FROM entries WHERE id='e'").get()?.mapped,null);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get()?.n,0); db.close();
});
test('bulk cannot bypass ownership or planning permissions',async()=>{
  const {db,w}=fixture(); const researcher = {...actor,role:'researcher' as const,staffId:'s'};
  await assert.rejects(w.bulk(researcher,[{kind:'entry',id:'e2',version:1,mapped:5}]),/own sourcing/);
  await assert.rejects(w.bulk(researcher,[{kind:'assignment-edit',id:'a',version:1,target:5}]),/Planning permission/);
  await assert.rejects(w.bulk(actor,[{kind:'entry',id:'foreign-workspace-record',version:1,mapped:5}]),/not found/); db.close();
});
test('review zero is completed, history is retained and output locks',async()=>{
  const {db,w}=fixture();
  await w.bulk(actor,[{kind:'entry',id:'e',version:1,mapped:10}]);
  await w.bulk(actor,[{kind:'review',stage:'peer',id:'e',version:2,approved:0}]);
  await w.bulk(actor,[{kind:'review',stage:'partner',id:'e',version:3,approved:0}]);
  await assert.rejects(w.bulk(actor,[{kind:'entry',id:'e',version:4,mapped:20}]),/reopened/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM reviews').get()?.n,2); db.close();
});
