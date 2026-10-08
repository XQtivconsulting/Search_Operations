import {createHash} from 'node:crypto';
import {Actor,hasRole,requireThat} from './domain';
type DB={rows:(q:string,...p:any[])=>any[];audit:(a:Actor,k:string,id:string,b:any,n:any)=>void};
// Children first: checked with foreign keys enabled in the reset tests.
export const resetTables=['search_status_history','crm_candidate_items','crm_candidate_batches','candidate_file_chunks','candidate_files','brief_file_chunks','brief_files','candidate_sessions','candidate_codes','candidate_invites','candidate_limits','role_publications','brief_shares','research_records','effort_records','effort_days','time_off','reviews','entries','assignments','weekly_priorities','weekly_decisions','team_members','team_rosters','staff_profiles','account_researchers','staff','teams','searches','crm_partners','crm_jobs','integration_runs','imports','issues'] as const;
export const resetSchema=`CREATE TABLE IF NOT EXISTS reset_backups(id TEXT PRIMARY KEY,actor TEXT NOT NULL,created_at TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reset_backup_rows(backup_id TEXT NOT NULL REFERENCES reset_backups(id),table_name TEXT NOT NULL,row_no INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(backup_id,table_name,row_no));`;
export function resetSnapshot(db:DB,a:Actor){
 requireThat(hasRole(a,'super_admin'),'Workspace owner permission required.',403);
 const available=new Set(db.rows("SELECT name FROM sqlite_master WHERE type='table'").map(r=>r.name));
 const tables=Object.fromEntries([...resetTables,'audit','research_events','settings'].filter(t=>available.has(t)).map(t=>[t,db.rows(`SELECT * FROM "${t}" ORDER BY rowid`)]));
 const signature=createHash('sha256').update(JSON.stringify(tables)).digest('hex');
 return {tables,signature,counts:Object.fromEntries(Object.entries(tables).filter(([t])=>!['audit','research_events','settings'].includes(t)).map(([t,rows])=>[t,rows.length]))};
}
export function clearWorkspace(db:DB,a:Actor,signature:string,people:any){
 const snapshot=resetSnapshot(db,a);
 requireThat(signature===snapshot.signature,'Workspace changed. Preview the reset again. No workspace data was cleared.',409);
 const id=crypto.randomUUID();
 db.rows('INSERT INTO reset_backups VALUES(?,?,?,?)',id,a.id,new Date().toISOString(),JSON.stringify({format:1,tenant:a.tenant,signature:snapshot.signature,counts:snapshot.counts,people}));
 for(const [table,rows] of Object.entries(snapshot.tables))rows.forEach((row,index)=>db.rows('INSERT INTO reset_backup_rows VALUES(?,?,?,?)',id,table,index,JSON.stringify(row)));
 for(const t of resetTables)if(snapshot.tables[t])db.rows(`DELETE FROM "${t}"`);
 // Immutable audit and research events remain private history; they do not populate working screens.
 db.audit(a,'workspace-reset',id,{counts:snapshot.counts},{backup_id:id,kept_owner:a.id});
 return {backupId:id,counts:snapshot.counts};
}

export function saveCleanBaseline(db:DB,a:Actor,people:any){
 requireThat(hasRole(a,'super_admin'),'Workspace owner permission required.',403);
 const existing=db.rows("SELECT id FROM reset_backups WHERE actor=? AND json_extract(data,'$.kind')='clean-baseline'",a.id)[0];
 if(existing)return {baselineId:existing.id,existing:true};
 requireThat(people.keep?.id===a.id&&people.remove?.length===0&&people.invitations===0,'A clean baseline requires only the owner account and no pending invitations.',409);
 const snapshot=resetSnapshot(db,a),owner=people.members?.find((m:any)=>m.id===a.id),staffId=owner?.staff_id;
 for(const [table,count] of Object.entries(snapshot.counts)){
   if(['staff','staff_profiles','account_researchers'].includes(table))continue;
   requireThat(count===0,'Workspace contains operational data. A clean baseline was not saved; no data was changed.',409);
 }
 for(const table of ['staff','staff_profiles','account_researchers'])for(const row of snapshot.tables[table]||[])
   requireThat(staffId&&(row.staff_id||row.id)===staffId,'Workspace contains other researcher records. No data was changed.',409);
 const id=crypto.randomUUID();
 db.rows('INSERT INTO reset_backups VALUES(?,?,?,?)',id,a.id,new Date().toISOString(),JSON.stringify({format:1,kind:'clean-baseline',label:'Clean baseline',tenant:a.tenant,signature:snapshot.signature,counts:snapshot.counts,people,policy:'Clear operational data with a fresh backup; retain owner account, current application and connection secrets. Credentials are not included in this snapshot.'}));
 for(const [table,rows] of Object.entries(snapshot.tables))rows.forEach((row,index)=>db.rows('INSERT INTO reset_backup_rows VALUES(?,?,?,?)',id,table,index,JSON.stringify(row)));
 db.audit(a,'clean-baseline-saved',id,null,{label:'Clean baseline'});
 return {baselineId:id,existing:false};
}
