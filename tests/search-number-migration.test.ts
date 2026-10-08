import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {initializeSearchNumbers,backfillSearchNumbers,nextSearchNumber} from '../src/search-number';
test('backfill preserves existing public IDs, CRM references and internal keys and is idempotent',()=>{
 const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE searches(id TEXT PRIMARY KEY,external_id TEXT,search_number INTEGER);INSERT INTO searches VALUES('existing','114',9),('legacy','47',NULL),('local','LOCAL-ABC',NULL);INSERT INTO settings VALUES('search_number_high_water','50')");
 const db={rows:(q:string,...p:any[])=>sql.prepare(q).all(...p) as any[]};
 initializeSearchNumbers(db);backfillSearchNumbers(db);
 assert.deepEqual(db.rows('SELECT * FROM searches ORDER BY id').map(r=>[r.id,r.external_id,r.search_number]),[['existing','114',9],['legacy','47',51],['local','LOCAL-ABC',52]]);
 backfillSearchNumbers(db);assert.equal(nextSearchNumber(db),53);sql.close();
});
