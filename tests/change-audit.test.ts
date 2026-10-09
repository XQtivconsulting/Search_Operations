import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {installChangeAudit,initializeAuditContext,setAuditContext,withAudit} from '../src/change-audit';
function fixture(){const db=new DatabaseSync(':memory:');const exec=(q:string,...p:any[])=>db.prepare(q).all(...p) as any[];db.exec('CREATE TABLE items(id TEXT PRIMARY KEY,tenant TEXT,status TEXT,interview_date TEXT);CREATE TABLE users(id TEXT PRIMARY KEY,password TEXT);');installChangeAudit(exec);const write=(q:string,...p:any[])=>{setAuditContext(exec);return exec(q,...p);};return {db,exec,write};}
test('row journal captures actor, tenant, before/after, noops and rollback atomically',()=>{
 const {db,exec,write}=fixture();withAudit({id:'member-a',tenant:'one'},'search:status',()=>{
 write("INSERT INTO items VALUES('search','one','Open','2026-10-01')");write("UPDATE items SET status='Closed' WHERE id='search'");write("UPDATE items SET status='Closed' WHERE id='search'");});
 let events=exec('SELECT * FROM change_events ORDER BY rowid');assert.equal(events.length,2);assert.equal(events[1].actor,'member-a');assert.equal(events[1].tenant,'one');assert.equal(JSON.parse(events[1].before_json).status,'Open');assert.equal(JSON.parse(events[1].after_json).status,'Closed');assert.equal(events[0].request_id,events[1].request_id);
 db.exec('BEGIN');withAudit({id:'member-b'},'interview:reschedule',()=>write("UPDATE items SET interview_date='2026-10-02'"));db.exec('ROLLBACK');assert.equal(exec('SELECT * FROM change_events').length,2);
 withAudit({id:'member-b'},'interview:reschedule',()=>write("UPDATE items SET interview_date='2026-10-03'"));events=exec('SELECT * FROM change_events ORDER BY rowid');assert.equal(events[2].actor,'member-b');assert.equal(JSON.parse(events[2].before_json).interview_date,'2026-10-01');assert.equal(JSON.parse(events[2].after_json).interview_date,'2026-10-03');db.close();
});
test('interleaved async requests retain their own actor and audit history cannot be replaced or removed',async()=>{
 const {db,exec,write}=fixture();let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const first=withAudit({id:'first'},'create',async()=>{await gate;write("INSERT INTO users VALUES('one','secret-one')");});
 await withAudit({id:'second'},'create',async()=>{write("INSERT INTO users VALUES('two','secret-two')");release();});await first;
 const events=exec('SELECT * FROM change_events ORDER BY rowid');assert.deepEqual(events.map(e=>e.actor),['second','first']);assert.ok(!JSON.stringify(events).includes('secret-'));assert.equal(JSON.parse(events[0].after_json).password,'[redacted]');
 assert.throws(()=>exec("DELETE FROM change_events"),/append-only/);assert.throws(()=>exec("UPDATE change_events SET actor='fake'"),/append-only/);assert.throws(()=>exec('INSERT OR REPLACE INTO change_events SELECT * FROM change_events LIMIT 1'),/append-only/);db.close();
});
test('restart resets stale actor and schema additions receive journal coverage',()=>{
 const {db,exec,write}=fixture();withAudit({id:'human'},'update',()=>write("INSERT INTO items VALUES('x','one','Open',NULL)"));initializeAuditContext(exec);exec("UPDATE items SET status='Closed'");assert.equal(exec('SELECT actor FROM change_events ORDER BY rowid DESC LIMIT 1')[0].actor,'system:initialization');
 db.exec('ALTER TABLE items ADD COLUMN note TEXT');installChangeAudit(exec);withAudit({id:'human'},'note',()=>write("UPDATE items SET note='new field'"));assert.equal(JSON.parse(exec('SELECT after_json FROM change_events ORDER BY rowid DESC LIMIT 1')[0].after_json).note,'new field');db.close();
});

test('replacement writes retain the previous row as well as the new row',()=>{
 const {db,exec,write}=fixture();withAudit({id:'member'},'replace',()=>{write("INSERT INTO users VALUES('one','old secret')");write("INSERT OR REPLACE INTO users VALUES('one','new secret')");});
 const events=exec('SELECT * FROM change_events ORDER BY rowid');assert.deepEqual(events.map(e=>e.operation),['INSERT','DELETE','INSERT']);assert.ok(events[1].before_json);db.close();
});
