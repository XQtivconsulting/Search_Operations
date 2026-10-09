import {AsyncLocalStorage} from 'node:async_hooks';

type Context={actor:string;tenant:string;action:string;requestId:string};
const context=new AsyncLocalStorage<Context>();
export function withAudit<T>(actor:{id?:string;tenant?:string}|undefined,action:string,fn:()=>T):T {
 const parent=context.getStore();
 return context.run({actor:actor?.id||parent?.actor||'system:maintenance',tenant:actor?.tenant||parent?.tenant||'',action,requestId:parent?.requestId||crypto.randomUUID()},fn);
}
export function setAuditContext(exec:(q:string,...p:any[])=>any){
 const c=context.getStore()||{actor:'system:maintenance',tenant:'',action:'maintenance',requestId:''};
 exec('UPDATE change_context SET actor=?,tenant=?,action=?,request_id=? WHERE singleton=1',c.actor,c.tenant,c.action,c.requestId);
}
export function initializeAuditContext(exec:(q:string,...p:any[])=>any[]){
 if(exec("SELECT name FROM sqlite_master WHERE type='table' AND name='change_context'").length)
  withAudit({id:'system:initialization'},'schema:initialize',()=>setAuditContext(exec));
}
const quote=(s:string)=>'"'+s.replace(/"/g,'""')+'"';
const literal=(s:string)=>"'"+s.replace(/'/g,"''")+"'";
// Existing domain histories remain unchanged. The new journal is the row-level safety net.
export const excludedAuditTables=new Set(['change_context','change_events','audit','research_events','member_events','account_events','limits','candidate_limits']);
export function installChangeAudit(exec:(q:string,...p:any[])=>any[]){
 exec('PRAGMA recursive_triggers=ON');
 exec(`CREATE TABLE IF NOT EXISTS change_context(singleton INTEGER PRIMARY KEY CHECK(singleton=1),actor TEXT NOT NULL,tenant TEXT NOT NULL,action TEXT NOT NULL,request_id TEXT NOT NULL)`);
 exec("INSERT OR IGNORE INTO change_context VALUES(1,'system:maintenance','','maintenance','')");
 exec(`CREATE TABLE IF NOT EXISTS change_events(id TEXT PRIMARY KEY,actor TEXT NOT NULL,tenant TEXT NOT NULL,action TEXT NOT NULL,request_id TEXT NOT NULL,table_name TEXT NOT NULL,operation TEXT NOT NULL,entity TEXT NOT NULL,before_json TEXT,after_json TEXT,created_at TEXT NOT NULL)`);
 exec('CREATE INDEX IF NOT EXISTS change_events_entity ON change_events(table_name,entity,created_at)');
 exec('CREATE INDEX IF NOT EXISTS change_events_actor ON change_events(actor,created_at)');
 for(const {name:table} of exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")){
  if(excludedAuditTables.has(table))continue;
  const columns=exec(`PRAGMA table_info(${quote(table)})`).map(r=>r.name as string);
  const snapshot=(ref:string)=>'json_object('+columns.flatMap(col=>{
   const value=`${ref}.${quote(col)}`;
   let safe=value;
   if(/password|token|secret|code_hash|session_hash/i.test(col))safe="'[redacted]'";
   if(col==='data'&&['candidate_file_chunks','brief_file_chunks','reset_backup_rows'].includes(table))safe=`json_object('bytes',length(${value}),'content','[not duplicated]')`;
   if(table==='research_records'&&col==='data')safe=`CASE WHEN json_valid(${value}) THEN json_remove(${value},'$.share_token','$.token','$.password','$.secret') ELSE ${value} END`;
   if(table==='settings'&&col==='value')safe=`CASE WHEN lower(${ref}.key) LIKE '%token%' OR lower(${ref}.key) LIKE '%secret%' OR lower(${ref}.key) LIKE '%password%' THEN '[redacted]' ELSE ${value} END`;
   return [literal(col),safe];
  }).join(',')+')';
  for(const op of ['INSERT','UPDATE','DELETE']){
   const ref=op==='DELETE'?'OLD':'NEW',before=op==='INSERT'?'NULL':snapshot('OLD'),after=op==='DELETE'?'NULL':snapshot('NEW');
   const condition=op==='UPDATE'?' WHEN '+columns.map(c=>`OLD.${quote(c)} IS NOT NEW.${quote(c)}`).join(' OR '):'';
   const name='change_v1_'+table+'_'+op;
   const sql=`CREATE TRIGGER ${quote(name)} AFTER ${op} ON ${quote(table)}${condition} BEGIN INSERT INTO change_events VALUES(lower(hex(randomblob(16))),(SELECT actor FROM change_context WHERE singleton=1),${columns.includes('tenant')?ref+'.tenant':"(SELECT tenant FROM change_context WHERE singleton=1)"},(SELECT action FROM change_context WHERE singleton=1),(SELECT request_id FROM change_context WHERE singleton=1),${literal(table)},${literal(op)},CAST(${ref}.rowid AS TEXT),${before},${after},strftime('%Y-%m-%dT%H:%M:%fZ','now')); END`;
   if(exec("SELECT sql FROM sqlite_master WHERE type='trigger' AND name=?",name)[0]?.sql!==sql){exec(`DROP TRIGGER IF EXISTS ${quote(name)}`);exec(sql);}
  }
 }
 for(const table of ['change_events','audit','research_events','member_events','account_events']){
  if(!exec("SELECT name FROM sqlite_master WHERE type='table' AND name=?",table).length)continue;
  exec(`CREATE TRIGGER IF NOT EXISTS ${quote('immutable_'+table+'_replace')} BEFORE INSERT ON ${quote(table)} WHEN EXISTS(SELECT 1 FROM ${quote(table)} WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'Audit history is append-only'); END`);
  for(const op of ['UPDATE','DELETE'])exec(`CREATE TRIGGER IF NOT EXISTS ${quote('immutable_'+table+'_'+op)} BEFORE ${op} ON ${quote(table)} BEGIN SELECT RAISE(ABORT,'Audit history is append-only'); END`);
 }
}
