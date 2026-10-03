// Usage: node --import tsx scripts/restore-business-backup.ts snapshot.json tenant NEW.sqlite
import {readFile,open} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {resolve} from 'node:path';
import {validateSnapshot} from '../src/backup-export';
import {restoreBusinessSnapshot} from '../src/backup-restore';
registerHooks({resolve(s,c,next){if(s==='cloudflare:workers')return {url:'data:text/javascript,export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}',shortCircuit:true};return next(s,c);}});
const [input,tenant,destination]=process.argv.slice(2);
if(!input||!tenant||!destination)throw Error('Provide snapshot JSON, expected tenant ID and a NEW local SQLite filename.');
const snapshot=JSON.parse(await readFile(input,'utf8'));validateSnapshot(snapshot,tenant);
const target=resolve(destination),file=await open(target,'wx',0o600);await file.close(); // Refuse existing paths.
const sqlite=new DatabaseSync(target);
const rows=(q:string,...p:any[])=>{if(!p.length&&q.includes('CREATE TABLE')){sqlite.exec(q);return [];}return sqlite.prepare(q).all(...p);};
const transaction=(fn:()=>any)=>{sqlite.exec('BEGIN');try{const r=fn();sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}};
try{const {Workspace}=await import('../src/workspace');new Workspace({storage:{sql:{exec:(q:string,...p:any[])=>{const result=rows(q,...p);return {toArray:()=>result};}},transactionSync:transaction}} as any,{});const counts=restoreBusinessSnapshot({rows,transaction},snapshot,tenant);console.log(JSON.stringify({restored:true,tenant,tables:counts,identityRestored:false}));}finally{sqlite.close();}
