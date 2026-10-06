import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initializeSearchNumbers,nextSearchNumber,reserveSearchNumbers,searchNumber} from '../src/search-number';
import {matchesPlanningSearch,searchStatus} from '../src/planning-filters';
import {carryoverAssignments} from '../src/plan-carryover';
test('search numbering preserves legacy keys, enforces uniqueness and never reuses removed high IDs',()=>{
 const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE searches(id TEXT PRIMARY KEY,external_id TEXT);INSERT INTO searches VALUES('legacy','500');");
 const db={rows:(q:string,...p:any[])=>sql.prepare(q).all(...p) as any[]};initializeSearchNumbers(db);
 assert.equal(db.rows("SELECT search_number FROM searches WHERE id='legacy'")[0].search_number,null);
 db.rows("UPDATE searches SET search_number=41 WHERE id='legacy'");db.rows("INSERT INTO searches(id,external_id) VALUES('new','900')");
 assert.equal(db.rows("SELECT search_number FROM searches WHERE id='new'")[0].search_number,42);
 assert.throws(()=>db.rows("INSERT INTO searches(id,search_number) VALUES('duplicate',41)"),/UNIQUE/);
 db.rows("DELETE FROM searches WHERE id='new'");assert.equal(nextSearchNumber(db),43);
 reserveSearchNumbers(db,[100]);db.rows("INSERT INTO searches(id) VALUES('later')");assert.equal(db.rows("SELECT search_number FROM searches WHERE id='later'")[0].search_number,101);
 initializeSearchNumbers(db);assert.equal(db.rows("SELECT external_id FROM searches WHERE id='legacy'")[0].external_id,'500');
 for(const invalid of [0,-1,1.5,'',null,'abc',2147483648])assert.throws(()=>searchNumber(invalid));
 sql.close();
});
test('planning filters combine multiple decisions and statuses with search selection',()=>{
 const ps=[{search_id:'a',week:'2026-01-05',disposition:'Start'},{search_id:'b',week:'2026-01-05',disposition:'Recalibrate'}];
 const match=(s:any,d:string[]|null,st:string[]|null,r:string[]|null=null)=>matchesPlanningSearch(s,ps,'2026-01-12',d,st,r);
 assert.ok(match({id:'a',status:'Open'},['Start','Recalibrate'],['Open']));
 assert.ok(match({id:'b',status:'Closed'},['Start','Recalibrate'],['Open','Closed']));
 assert.ok(!match({id:'b',status:'Closed'},null,['Open']));
 assert.ok(!match({id:'a',status:'Open'},null,['Open'],['b']));
 assert.ok(!match({id:'a',status:'Open'},[],null));
 assert.ok(match({id:'c',status:'Cancelled'},['Not decided'],['Cancelled']));
 assert.equal(searchStatus('Canceled'),'Cancelled');
});
test('carryover excludes occupied days, past work, PTO, departed researchers and inactive sourcing',()=>{
 const data:any={searches:[{id:'r',status:'Open'}],priorities:[{search_id:'r',week:'2026-01-05',disposition:'Continue',version:1}],teams:[{id:'t',roster_version:3}],team_members:[{team_id:'t',staff_id:'s'},{team_id:'t',staff_id:'p'}],timeOff:[{staff_id:'p',work_date:'2026-01-12',pto:1}],assignments:[{id:'a',search_id:'r',team_id:'t',work_date:'2026-01-05',target:5,notes:'Keep',version:2}],entries:[{assignment_id:'a',staff_id:'s'},{assignment_id:'a',staff_id:'p'},{assignment_id:'a',staff_id:'departed'}]};
 const items=carryoverAssignments(data,'2026-01-12','2026-01-12');assert.equal(items.length,1);assert.deepEqual(items[0].staff_ids,['s']);assert.equal(items[0].target,5);assert.equal(items[0].work_date,'2026-01-12');
 assert.equal(carryoverAssignments(data,'2026-01-12','2026-01-13').length,0);
 data.assignments.push({...data.assignments[0],id:'existing',work_date:'2026-01-12'});assert.equal(carryoverAssignments(data,'2026-01-12','2026-01-12').length,0);data.assignments.pop();
 data.priorities[0].disposition='Pause';assert.equal(carryoverAssignments(data,'2026-01-12','2026-01-12').length,0);
});
