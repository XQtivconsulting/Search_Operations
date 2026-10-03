import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {unzipSync,strFromU8} from 'fflate';
import {snapshotBusiness,buildBusinessArchive,validateSnapshot,workbook} from '../src/backup-export';
import {restoreBusinessSnapshot} from '../src/backup-restore';
import {storeBusinessBackup,nextWeeklyBackup,backupPrefix} from '../src/backup-service';
import {readJSONBody} from '../src/request-security';
registerHooks({resolve(s,c,next){if(s==='cloudflare:workers')return {url:'data:text/javascript,export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}',shortCircuit:true};return next(s,c);}});
const {Workspace}=await import('../src/workspace'),{Identity}=await import('../src/identity'),{default:worker}=await import('../src/worker');
function fixture(){const db=new DatabaseSync(':memory:');const rows=(q:string,...p:any[])=>{if(!p.length&&q.includes('CREATE TABLE')){db.exec(q);return [];}return db.prepare(q).all(...p);};const transaction=(fn:()=>any)=>{db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};let alarm:any=null;const storage={sql:{exec:(q:string,...p:any[])=>{const result=rows(q,...p);return {toArray:()=>result};}},transactionSync:transaction,getAlarm:async()=>alarm,setAlarm:async(n:number)=>{alarm=n;}};return {db,rows,transaction,storage,ctx:{storage},w:new Workspace({storage} as any,{})};}
const owner:any={id:'owner',role:'super_admin',roles:['super_admin'],tenant:'alpha'};
function seeded(){const f=fixture();f.rows("INSERT INTO searches(id,client,title) VALUES('s','Synthetic client','Example search')");for(const r of [{id:'c',kind:'candidate',name:'=SUM(1,2)',email:'synthetic@example.com'},{id:'m',kind:'mapping',candidate_id:'c',status:'Approved'}])f.rows('INSERT INTO research_records(id,kind,role_id,record_key,data,version) VALUES(?,?,?,?,?,?)',r.id,r.kind,r.id==='m'?'s':'',r.id,JSON.stringify(r),1);f.rows("INSERT INTO candidate_files VALUES('file','c','resume.txt','text/plain','Resume','owner','2026-10-03')");f.rows("INSERT INTO candidate_file_chunks VALUES('file',0,?)",btoa('synthetic attachment'));return f;}
test('backup contains master and per-search workbooks, raw attachments and verified JSON, excluding credentials',()=>{
 const f=seeded(),s=snapshotBusiness(f,'alpha',[{id:'owner',name:'Synthetic',password:'never-export',token:'never-export',email:'owner@example.com'}]),zip=unzipSync(buildBusinessArchive(s));
 assert.ok(zip['Master datasets.xlsx']);assert.ok(Object.keys(zip).some(k=>k.startsWith('searches/s-')));assert.equal(strFromU8(zip['attachments/candidate/file/resume%2Etxt']),'synthetic attachment');
 assert.equal(JSON.stringify(s).includes('never-export'),false);assert.equal(s.tables.candidate_sessions,undefined);validateSnapshot(s,'alpha');assert.throws(()=>validateSnapshot(s,'beta'),/workspace/);s.tables.searches[0].title='Tampered';assert.throws(()=>validateSnapshot(s,'alpha'),/checksum/);f.db.close();
});
test('Excel preserves long notes and never interprets formula-shaped source content',()=>{
 const long='x'.repeat(40000),zip=unzipSync(workbook([{name:'Notes',rows:[{notes:long,name:'=HYPERLINK("https://invalid")'}]}])),xml=strFromU8(zip['xl/worksheets/sheet1.xml']);assert.equal((xml.match(/x/g)||[]).length>=40000,true);assert.equal(xml.includes('<f>'),false);assert.match(xml,/inlineStr/);assert.match(xml,/HYPERLINK/);assert.match(xml,/<row r="4">/);
});
test('isolated restore preserves IDs, records and attachment bytes and refuses nonempty targets',()=>{
 const source=seeded(),target=fixture(),s=snapshotBusiness(source,'alpha',[]);const counts=restoreBusinessSnapshot(target,s,'alpha');assert.equal(counts.searches,1);assert.equal(target.rows('SELECT data FROM candidate_file_chunks')[0].data,btoa('synthetic attachment'));assert.equal(target.rows('SELECT id FROM searches')[0].id,'s');assert.throws(()=>restoreBusinessSnapshot(target,s,'alpha'),/empty/);source.db.close();target.db.close();
});
test('private storage only advertises complete verified uploads; failed upload leaves no complete backup',async()=>{
 const f=seeded(),objects=new Map<string,any>(),bucket:any={put:async(k:string,v:any,o:any)=>{objects.set(k,{body:v,...o});},head:async(k:string)=>({size:objects.get(k).body.byteLength,customMetadata:objects.get(k).customMetadata})};
 const done=await storeBusinessBackup(f,f.storage,bucket,'alpha',[]);assert.ok(objects.has(`business-backups/alpha/${done.id}.manifest.json`));assert.equal(f.rows("SELECT COUNT(*) n FROM backup_runs WHERE status='complete'")[0].n,1);
 await assert.rejects(storeBusinessBackup(f,f.storage,{put:async()=>{throw Error('unavailable');}} as any,'alpha',[]),/unavailable/);assert.equal(f.rows('SELECT COUNT(*) n FROM backup_runs')[0].n,1);assert.throws(()=>backupPrefix('../beta'),/Invalid/);f.db.close();
});
test('weekly schedule is Sunday 06 UTC and missed/failed alarms are visible and retried',async()=>{
 assert.equal(new Date(nextWeeklyBackup(Date.parse('2026-10-03T12:00:00Z'))).toISOString(),'2026-10-04T06:00:00.000Z');
 assert.equal(new Date(nextWeeklyBackup(Date.parse('2026-10-04T06:00:00Z'))).toISOString(),'2026-10-11T06:00:00.000Z');
 const f=fixture();(f.w as any).env={BACKUPS:{put:async()=>{throw Error('unavailable');}},IDENTITY:{getByName:()=>({members:async()=>[]})}};await f.w.ensureBackupSchedule('alpha');await f.w.alarm();assert.equal(f.rows('SELECT status FROM backup_runs')[0].status,'failed');assert.ok((await f.storage.getAlarm())<=Date.now()+3600001);f.db.close();
});
test('request limits apply to streaming bodies without Content-Length and invalid JSON stays a 400',async()=>{
 const request=(s:string)=>new Request('https://app.example.com',{method:'POST',body:s});await assert.rejects(readJSONBody(request('1234567890'),9),(e:any)=>e.status===413);await assert.rejects(readJSONBody(request('{')),(e:any)=>e.status===400);await assert.rejects(readJSONBody(request('[]')),/object/);assert.deepEqual(await readJSONBody(request('{"valid":true}')),{valid:true});
});
test('real membership authentication blocks foreign tenant export before accessing its workspace',async()=>{
 const f=fixture(),identity=new Identity(f.ctx as any,{});f.rows("INSERT INTO users VALUES('u','u@example.com','User','unused')");f.rows("INSERT INTO memberships VALUES('u','alpha','admin',NULL,'active')");const session=await identity.session('u');let touched=false;
 const env:any={IDENTITY:{getByName:()=>identity},WORKSPACE:{getByName:()=>{touched=true;return f.w;}}};
 const r=await worker.fetch(new Request('https://app.example.com/api/backups/export',{method:'POST',headers:{Origin:'https://app.example.com',Cookie:`search_session=${session.token}`,'X-Workspace':'beta'},body:'{}'}),env);assert.equal(r.status,401);assert.equal(touched,false);f.db.close();
});
test('researcher cannot export a workspace and cross-origin owner requests are denied',async()=>{
 let touched=false;const env:any={IDENTITY:{getByName:()=>({authenticate:async()=>({...owner,role:'researcher',roles:['researcher']})})},WORKSPACE:{getByName:()=>({exportBusiness:()=>{touched=true;}})}};
 for(const origin of ['https://evil.example','https://app.example.com']){const r=await worker.fetch(new Request('https://app.example.com/api/backups/export',{method:'POST',headers:{Origin:origin},body:'{}'}),env);assert.equal(r.status,403);}assert.equal(touched,false);
});
test('backup downloads construct the path only from authenticated tenant and reject traversal',async()=>{
 const paths:string[]=[],env:any={IDENTITY:{getByName:()=>({authenticate:async()=>owner})},WORKSPACE:{getByName:()=>({})},BACKUPS:{get:async(k:string)=>{paths.push(k);return null;}}};
 const send=(id:string)=>worker.fetch(new Request('https://app.example.com/api/backups/download',{method:'POST',headers:{Origin:'https://app.example.com'},body:JSON.stringify({id,tenant:'beta'})}),env);
 assert.equal((await send('../beta/archive')).status,400);assert.equal(paths.length,0);assert.equal((await send('valid-id')).status,404);assert.equal(paths[0],'business-backups/alpha/valid-id.manifest.json');
});
test('generated workbooks can be read by the application XLSX parser',async()=>{
 const {default:readXlsx}=await import('read-excel-file/node');
 const sheets=await readXlsx(Buffer.from(workbook([{name:'Candidates',rows:[{name:'Synthetic & Example',phone:'+15550000000',notes:'=1+1'}]}])));
 const rows=sheets[0].data;assert.deepEqual(rows[0],['Source row','Text part','name','phone','notes']);assert.equal(rows[1][2],'Synthetic & Example');assert.equal(rows[1][3],'+15550000000');assert.equal(rows[1][4],'=1+1');
});
