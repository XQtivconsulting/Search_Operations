import {initializeSearchNumbers} from './search-number';
import {BusinessSnapshot,backupTables,validateSnapshot} from './backup-export';
import {requireThat} from './domain';
// Offline recovery only. The caller must create a NEW isolated database; no production endpoint calls this.
export function restoreBusinessSnapshot(db:any,snapshot:BusinessSnapshot,tenant:string){
 validateSnapshot(snapshot,tenant);
 for(const table of backupTables)if(table!=='settings'&&db.rows(`SELECT COUNT(*) n FROM "${table}"`)[0].n)throw Error('Restore requires an empty business database.');
 db.rows('PRAGMA foreign_keys=OFF');
 try{return db.transaction(()=>{
  // Restore exact saved IDs, including unnumbered legacy searches; allocation resumes afterwards.
  for(const trigger of ['search_number_auto','search_number_high_insert','search_number_high_update'])db.rows('DROP TRIGGER IF EXISTS '+trigger);
  db.rows('DELETE FROM settings');
  for(const [table,rows] of Object.entries(snapshot.tables)){
   const columns=new Set(db.rows(`PRAGMA table_info("${table}")`).map((r:any)=>r.name));
   for(const row of rows){const keys=Object.keys(row);requireThat(keys.length>0&&keys.every(k=>columns.has(k)),'Backup contains unsupported columns.');db.rows(`INSERT INTO "${table}" (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,...keys.map(k=>row[k]));}
  }
  initializeSearchNumbers(db);
  requireThat(db.rows('PRAGMA foreign_key_check').length===0,'Restored data has broken references.');
  return Object.fromEntries(Object.keys(snapshot.tables).map(t=>[t,db.rows(`SELECT COUNT(*) n FROM "${t}"`)[0].n]));
 });}finally{db.rows('PRAGMA foreign_keys=ON');}
}
