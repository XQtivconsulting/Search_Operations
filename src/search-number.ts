import {requireThat} from './domain';
type DB={rows:(sql:string,...params:any[])=>any[]};
export function searchNumber(value:unknown):number {
 const n=Number(value);
 requireThat(value!==''&&value!==null&&value!==undefined&&Number.isSafeInteger(n)&&n>0&&n<=2147483647,'XQtiv Search ID must be a positive whole number (up to 2147483647).');
 return n;
}
export function nextSearchNumber(db:DB):number {
 return Math.max(Number(db.rows("SELECT value FROM settings WHERE key='search_number_high_water'")[0]?.value||0),Number(db.rows('SELECT MAX(search_number) AS n FROM searches')[0]?.n||0))+1;
}
export function reserveSearchNumbers(db:DB,numbers:number[]){
 const high=Math.max(nextSearchNumber(db)-1,...numbers);
 db.rows("INSERT INTO settings(key,value) VALUES('search_number_high_water',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String(high));
}
export function initializeSearchNumbers(db:DB){
 if(!db.rows('PRAGMA table_info(searches)').some(c=>c.name==='search_number'))
  db.rows("ALTER TABLE searches ADD COLUMN search_number INTEGER CHECK(search_number IS NULL OR (typeof(search_number)='integer' AND search_number BETWEEN 1 AND 2147483647))");
 db.rows('CREATE UNIQUE INDEX IF NOT EXISTS searches_number_unique ON searches(search_number)');
 db.rows(`CREATE TRIGGER IF NOT EXISTS search_number_auto AFTER INSERT ON searches WHEN NEW.search_number IS NULL BEGIN
 INSERT INTO settings(key,value) VALUES('search_number_high_water',CAST(COALESCE((SELECT MAX(search_number) FROM searches),0)+1 AS TEXT))
 ON CONFLICT(key) DO UPDATE SET value=CAST(MAX(CAST(value AS INTEGER),COALESCE((SELECT MAX(search_number) FROM searches),0))+1 AS TEXT);
 UPDATE searches SET search_number=CAST((SELECT value FROM settings WHERE key='search_number_high_water') AS INTEGER) WHERE id=NEW.id;
 END`);
 for(const event of ['INSERT','UPDATE OF search_number'])db.rows(`CREATE TRIGGER IF NOT EXISTS search_number_high_${event==='INSERT'?'insert':'update'} AFTER ${event} ON searches WHEN NEW.search_number IS NOT NULL BEGIN
 INSERT INTO settings(key,value) VALUES('search_number_high_water',CAST(NEW.search_number AS TEXT))
 ON CONFLICT(key) DO UPDATE SET value=CAST(MAX(CAST(value AS INTEGER),NEW.search_number) AS TEXT);
 END`);
}
export function backfillSearchNumbers(db:DB){
 // Backfill only missing public numbers. Internal keys and CRM references never change.
 for(const row of db.rows('SELECT id FROM searches WHERE search_number IS NULL ORDER BY id')){
  const n=nextSearchNumber(db);searchNumber(n);
  db.rows('UPDATE searches SET search_number=? WHERE id=? AND search_number IS NULL',n,row.id);
 }

}

