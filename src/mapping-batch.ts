import {importHistoricalMappings} from './mapping-import';
import {hasPermission} from './access-policy';
import {requireThat} from './domain';
type R=Record<string,any>;
export const mappingBatchSchema=`CREATE TABLE IF NOT EXISTS mapping_batches(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL);`;
// Called only within Workspace's synchronous transaction. Domain changes and the
// durable row ledger commit together, including the request receipt.
export function mappingBatch(db:any,a:any,b:R,members:R[]){
 requireThat(hasPermission(a,'integrations.manage'),'Manage integrations permission required.',403);
 if(b.op==='list')return db.rows("SELECT id,json_extract(data,'$.name') name,json_array_length(data,'$.rows') pending,json_array_length(data,'$.outcomes') completed,version,updated_at FROM mapping_batches WHERE owner_id=? ORDER BY updated_at DESC",a.id);
 requireThat(typeof b.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(b.id),'Invalid batch ID.');
 const stored=db.rows('SELECT * FROM mapping_batches WHERE id=?',b.id)[0];
 requireThat(!stored||stored.owner_id===a.id,'Import batch not found.',404);
 let d:R=stored?JSON.parse(stored.data):null,version=stored?.version||0;
 const preview=():R=>d.rows.length?importHistoricalMappings(db,a,{rows:d.rows,preview:true,location_matches:d.locations},members):{plan:[],signature:null};
 const response=()=>({id:b.id,version,...d,...preview()});
 if(b.op==='get'){requireThat(d,'Import batch not found.',404);return response();}
 requireThat(['save','process'].includes(b.op),'Unknown import batch operation.');
 requireThat(typeof b.request_id==='string'&&b.request_id.length<=80,'Request ID required.');
 if(d?.last_request===b.request_id)return response();
 requireThat(b.version===version,'This import changed in another tab. Resume the saved batch before continuing.',409);
 if(b.op==='save'){
  requireThat(Array.isArray(b.rows)&&b.rows.length>0&&b.rows.length<=500,'Import 1–500 rows.');
  requireThat(b.rows.every((r:R)=>Number.isSafeInteger(r.row))&&new Set(b.rows.map((r:R)=>r.row)).size===b.rows.length,'Each source row must have a unique row number.');
  if(d){const pending=new Set(d.rows.map((r:R)=>r.row));requireThat(b.rows.length===pending.size&&b.rows.every((r:R)=>pending.has(r.row)),'Completed rows cannot be replaced. Start a new batch for a new file.');}
  d={name:String(b.name||d?.name||'Mapping import').slice(0,200),rows:b.rows,locations:{...d?.locations,...b.location_matches},outcomes:d?.outcomes||[],totals:d?.totals||{mapped:0,updated:0,unchanged:0,skipped:0},last_request:b.request_id};
 }else{
  requireThat(d,'Import batch not found.',404);
  const p=preview(),ready=p.plan.filter((r:R)=>!r.error&&!r.needs_choice).slice(0,10),ids=new Set(ready.map((r:R)=>r.row));
  if(ready.length){
   // Preserve full-file duplicate/conflict decisions when executing a small chunk.
   const selected=d.rows.filter((r:R)=>ids.has(r.row)).map((r:R)=>ready.find((p:R)=>p.row===r.row)?.result.includes('skip')?{...r,choice:'skip'}:r);
   const verified=importHistoricalMappings(db,a,{rows:selected,preview:true,location_matches:d.locations},members);
   const result:R=importHistoricalMappings(db,a,{rows:selected,signature:verified.signature,location_matches:d.locations},members);
   for(const key of ['mapped','updated','unchanged','skipped'])d.totals[key]+=result[key]||0;
   d.outcomes.push(...ready.map((r:R)=>({row:r.row,source:d.rows.find((source:R)=>source.row===r.row),outcome:r.result,import_run:result.import_run,at:new Date().toISOString()})));
   d.rows=d.rows.filter((r:R)=>!ids.has(r.row));
  }
  d.last_request=b.request_id;
 }
 version++;
 db.rows('INSERT INTO mapping_batches(id,owner_id,data,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at',b.id,a.id,JSON.stringify(d),version,new Date().toISOString());
 return response();
}
