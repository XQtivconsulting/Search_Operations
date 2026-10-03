import {createHash} from 'node:crypto';
import {snapshotBusiness,buildBusinessArchive} from './backup-export';
import {requireThat} from './domain';
export function nextWeeklyBackup(now=Date.now()){const date=new Date(now);date.setUTCHours(6,0,0,0);date.setUTCDate(date.getUTCDate()+(7-date.getUTCDay())%7);if(date.getTime()<=now)date.setUTCDate(date.getUTCDate()+7);return date.getTime();}
export const backupPrefix=(tenant:string)=>{requireThat(/^[a-zA-Z0-9_-]{1,100}$/.test(tenant),'Invalid workspace.');return `business-backups/${tenant}/`;};
export async function storeBusinessBackup(db:any,storage:any,bucket:R2Bucket,tenant:string,people:any[]){
 requireThat(bucket,'Private backup storage is not connected.',503);
 const snapshot=storage.transactionSync(()=>snapshotBusiness(db,tenant,people)),bytes=buildBusinessArchive(snapshot),id=new Date().toISOString().replace(/[.:]/g,'-')+'-'+crypto.randomUUID(),key=backupPrefix(tenant)+id;
 const checksum=createHash('sha256').update(bytes).digest('hex');
 await bucket.put(key+'.zip',bytes,{httpMetadata:{contentType:'application/zip'},customMetadata:{sha256:checksum,tenant}});
 const saved=await bucket.head(key+'.zip');requireThat(saved&&saved.size===bytes.byteLength&&saved.customMetadata?.sha256===checksum,'Backup upload could not be verified.',502);
 // A manifest is written last; incomplete uploads are never advertised as recoverable copies.
 const manifest={id,tenant,created_at:snapshot.created_at,bytes:bytes.byteLength,sha256:checksum,snapshot_sha256:snapshot.sha256,format:snapshot.format};
 await bucket.put(key+'.manifest.json',JSON.stringify(manifest),{httpMetadata:{contentType:'application/json'}});
 db.rows('INSERT INTO backup_runs(id,created_at,status,details) VALUES(?,?,?,?)',id,snapshot.created_at,'complete',JSON.stringify(manifest));
 return manifest;
}
