import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {planInterviewImport} from '../src/interview-import';
import {importKey,parseCSV,interviewRows,interviewDate} from '../src/interview-import-file';
import {planHistoricalMappings} from '../src/mapping-import';
import {mappingLocationMatches} from '../src/mapping-locations';
import {importDate,historicalMappingRows,mappingCandidateName} from '../src/mapping-import-file';
registerHooks({resolve(s,c,n){if(s==='cloudflare:workers')return {url:'data:text/javascript,export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}',shortCircuit:true};return n(s,c);}});
const {Workspace}=await import('../src/workspace');
const admin:any={id:'admin',role:'admin',tenant:'test',name:'Admin'};
const members=[{id:'admin',role:'admin',status:'active',name:'Admin'},{id:'researcher',role:'researcher',status:'active',name:'Researcher',staff_id:'s'}];
const searches=[{id:'r',client:'Example',title:'Leader',search_number:1}];
const candidate={id:'c',kind:'candidate',name:'Example Person',url:'https://www.linkedin.com/in/example-person',company:'Existing Co',version:1};
const source:any={row:2,CurrentRecruitCRMStage:'Client Interviews in progress','Candidate Name':'Example Person','Job Name':'Leader','Company Name':'Example','Interview Round':'R1','Interview Status':'Completed','Interview Date':'2025-09-01T07:00:00Z','Feedback Outcome':'Positive','Feedback Notes':'Good discussion','Interviewer Name':'Example interviewer','Date Recommendation Submitted':'2025-08-25T07:00:00Z','Next Step':'Follow up','Next Step Date':'2025-09-03T07:00:00Z'};
const mappingRow={search_number:1,mapped_by:'Researcher',mapped_on:'2025-08-01',first_name:'Example',last_name:'Person',url:candidate.url,partner_review:'Yes',partner_reviewer:'Former Partner',partner_review_date:'2025-08-05'};
test('combined candidate names split without dropping compound names or changing explicit fields',()=>{
 assert.deepEqual(mappingCandidateName({name:'  Example   Person  '}),{first_name:'Example',last_name:'Person'});
 assert.deepEqual(mappingCandidateName({first_name:'Example van Sample',last_name:''}),{first_name:'Example',last_name:'van Sample'});
 assert.deepEqual(mappingCandidateName({name:'Person, Example Anne'}),{first_name:'Example Anne',last_name:'Person'});
 assert.deepEqual(mappingCandidateName({first_name:'Example Anne',last_name:'Person'}),{first_name:'Example Anne',last_name:'Person'});
 assert.deepEqual(mappingCandidateName({name:'Example'}),{first_name:'Example',last_name:''});
 for(const header of ['Name','Full Name','Candidate Name']){const parsed=historicalMappingRows([['Search ID','Researcher Name','Mapping Date',header,'LinkedIn URL'],[1,'Researcher','2025-08-01','Example Person',candidate.url]]);const p=planHistoricalMappings(parsed,searches,[],members,[])[0];assert.equal(p.data.first_name,'Example');assert.equal(p.data.last_name,'Person');}
});
function fixture(){const db=new DatabaseSync(':memory:');const ctx:any={storage:{sql:{exec(q:string,...p:any[]){if(!p.length&&q.includes('CREATE TABLE')){db.exec(q);return {toArray:()=>[]};}return {toArray:()=>db.prepare(q).all(...p)};}},transactionSync(fn:any){db.exec('BEGIN');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}}};const w=new Workspace(ctx,{});db.exec("INSERT INTO staff VALUES('s','Researcher');INSERT INTO searches(id,client,title,search_number) VALUES('r','Example','Leader',1);");const put=(kind:string,id:string,key:string,data:any,role='')=>db.prepare('INSERT INTO research_records(id,kind,role_id,record_key,data,version) VALUES(?,?,?,?,?,1)').run(id,kind,role,key,JSON.stringify(data));put('candidate','c',candidate.url,candidate);const records=()=>db.prepare('SELECT * FROM research_records').all().map((r:any)=>({...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version}));const run=(b:any,a=admin)=>w.research(a,b,members);return {db,w,put,records,run};}
test('SharePoint schema preamble, commas, multiline notes, BOM and full dates parse',()=>{
 const csv='\uFEFFListSchema={metadata}\r\nCandidate Name,Job Name,Company Name,Interview Round,Interview Status,Feedback Notes\r\nExample Person,Leader,Example,R1,Completed,"First line, detail\nSecond ""quoted"" line"\r\n';
 const rows=interviewRows(parseCSV(csv));assert.equal(rows.length,1);assert.equal(rows[0]['Feedback Notes'],'First line, detail\nSecond "quoted" line');assert.equal(interviewDate('2026-10-06T07:00:00Z'),'2026-10-06');assert.equal(importDate('2026-SEP-01'),'2026-09-01');assert.throws(()=>importDate('1-Sep'));assert.throws(()=>importDate('2026-02-30'));assert.throws(()=>parseCSV('A\n"bad'));
});
test('name-only identity requires confirmation, foreign selection is rejected, URL can identify exactly',()=>{
 assert.match(planInterviewImport([source],{},searches,[candidate])[0].error,/Confirm/);
 const bad=planInterviewImport([source],{[importKey(source)]:{candidate_id:'foreign'}},searches,[candidate])[0];assert.ok(bad.error);
 const good=planInterviewImport([{...source,'LinkedIn URL':candidate.url}],{},searches,[candidate])[0];assert.equal(good.result,'Import');assert.equal(good.rounds[0].outcome,'Positive');assert.equal(good.rounds[0].date,'2025-09-01');
});
test('empty rounds collapse, recommendation-only records survive, conflicting round duplicates block',()=>{
 const blank={...source,'Interview Round':'R2','Interview Status':'Not Started','Interview Date':'','Feedback Outcome':'Pending','Feedback Notes':'','Interviewer Name':'','Next Step':'','Next Step Date':''},res={[importKey(source)]:{candidate_id:'c'}};
 const p=planInterviewImport([source,blank,source],res,searches,[candidate])[0];assert.equal(p.rounds.length,1);assert.equal(p.skipped_rounds,1);assert.ok(p.warnings.some((w:string)=>/Repeated/.test(w)));
 const rec=planInterviewImport([blank],res,searches,[candidate])[0];assert.equal(rec.result,'Import');assert.equal(rec.rounds.length,0);assert.equal(rec.change_date,true);
 assert.match(planInterviewImport([source,{...source,'Feedback Notes':'Conflicting'}],res,searches,[candidate])[0].error,/Conflicting duplicate/);
});
test('historical interviews import atomically, preserve missing dates and never invent sourcing reviews',async()=>{
 const f=fixture(),rows=[{...source,'Interview Date':''}],resolutions={[importKey(source)]:{candidate_id:'c'}},action='historical-interview-import';
 const preview:any=await f.run({action,rows,resolutions,preview:true});assert.ok(preview.plan[0].warnings.some((w:string)=>/date missing/.test(w)));assert.equal(f.records().filter(r=>r.kind==='mapping').length,0);
 const result:any=await f.run({action,rows,resolutions,signature:preview.signature});assert.equal(result.rounds,1);const m=f.records().find(r=>r.kind==='mapping')!,e=f.records().find(r=>r.kind==='engagement')!;assert.equal(m.status,'Imported');assert.equal(m.submitted_at,undefined);assert.equal(m.partner_decision,undefined);assert.equal(e.stage_at,null);assert.equal(e.stage_id,'interviews');assert.equal(e.interviews[0].date,'');assert.equal(e.interviews[0].decision_on,undefined);assert.equal(e.interviews[0].interviewer,'Example interviewer');assert.equal(e.recommended_on,'2025-08-25');
 const repeat:any=await f.run({action,rows,preview:true});assert.equal(repeat.plan[0].result,'Unchanged');assert.equal(repeat.plan[0].error,undefined);assert.equal((await f.w.state(admin)).entries.length,0);f.db.close();
});
test('repeat imports protect newer app edits and explicitly resolve changed source conflicts',async()=>{
 const f=fixture(),action='historical-interview-import',rows=[source],resolutions={[importKey(source)]:{candidate_id:'c'}};
 const preview:any=await f.run({action,rows,resolutions,preview:true});await f.run({action,rows,resolutions,signature:preview.signature});
 let e=f.records().find(r=>r.kind==='engagement')!;e.interviews[0].feedback='Newer app note';f.db.prepare('UPDATE research_records SET data=?,version=version+1 WHERE id=?').run(JSON.stringify(e),e.id);
 const unchanged:any=await f.run({action,rows,preview:true});assert.equal(unchanged.plan[0].result,'Unchanged');
 const changed=[{...source,'Feedback Notes':'Source changed too'}],conflict:any=await f.run({action,rows:changed,preview:true});assert.equal(conflict.plan[0].needs_choice,true);await assert.rejects(f.run({action,rows:changed,signature:conflict.signature}),/Resolve/);
 const choices={[importKey(source)]:{action:'file'}},accepted:any=await f.run({action,rows:changed,resolutions:choices,preview:true});await f.run({action,rows:changed,resolutions:choices,signature:accepted.signature});e=f.records().find(r=>r.kind==='engagement')!;assert.equal(e.interviews[0].feedback,'Source changed too');assert.equal(f.records().filter(r=>r.kind==='mapping').length,1);f.db.close();
});
test('stale previews and unauthorized users cannot import; cutover blocks imports server-side',async()=>{
 const f=fixture(),action='historical-interview-import',rows=[source],resolutions={[importKey(source)]:{candidate_id:'c'}};
 await assert.rejects(f.run({action,rows,preview:true},{...admin,role:'researcher'}),/permission/i);
 const p:any=await f.run({action,rows,resolutions,preview:true});f.db.exec("UPDATE research_records SET version=2 WHERE id='c'");await assert.rejects(f.run({action,rows,resolutions,signature:p.signature}),/changed/);assert.equal(f.records().filter(r=>r.kind==='mapping').length,0);
 const settings:any=await f.run({action:'interview-import-settings',preview:true});await f.run({action:'interview-import-settings',version:settings.version,closed:true});await assert.rejects(f.run({action,rows,preview:true}),/transition is complete/);await assert.rejects(f.run({action:'interview-import-settings',version:0,closed:false}),/changed/);await f.run({action:'interview-import-settings',version:1,closed:false});assert.ok(await f.run({action,rows,resolutions,preview:true}));f.db.close();
});
test('mapping parser accepts legacy headers and reviewer dates require original identity',()=>{
 const rows=historicalMappingRows([['Search ID','Mapped By','Date','Name','LI Link'],[1,'Researcher','2025-08-01','Example Person',candidate.url]]);assert.equal(rows[0].name,'Example Person');
 const plan=planHistoricalMappings([{...mappingRow,partner_reviewer:''}],searches,[],members,[{id:'s',name:'Researcher'}]);assert.match(plan[0].error,/requires reviewer/);
 const valid=planHistoricalMappings([mappingRow],searches,[],members,[{id:'s',name:'Researcher'}])[0];assert.equal(valid.data.status,'Approved');assert.equal(valid.data.team_decision,'');assert.equal(valid.data.partner_reviewer_id,'');assert.equal(valid.data.staff_id,'s');
});
test('historical mappings confirm reuse, fill missing fields, preserve reviews and original work date',async()=>{
 const f=fixture(),action='historical-mapping-import',rows=[{...mappingRow,company:'Incoming Co',title:'Leader'}];
 const p:any=await f.run({action,rows,preview:true});assert.equal(p.plan[0].needs_choice,true);await assert.rejects(f.run({action,rows,signature:p.signature}),/Resolve/);
 rows[0]={...rows[0],choice:'reuse:c'} as any;const confirmed:any=await f.run({action,rows,preview:true});await f.run({action,rows,signature:confirmed.signature});
 const c=f.records().find(r=>r.kind==='candidate')!,m=f.records().find(r=>r.kind==='mapping')!;assert.equal(c.company,'Existing Co');assert.equal(c.title,'Leader');assert.equal(m.work_date,'2025-08-01');assert.equal(m.team_review_skipped,true);assert.equal(m.partner_reviewed_name,'Former Partner');assert.equal(m.peer_decision,'');assert.equal(m.partner_reviewed_at,'2025-08-05T12:00:00.000Z');
 const state=await f.w.state(admin);assert.equal(state.entries[0].mapped,1);assert.equal(state.entries[0].partner,1);assert.equal(state.entries[0].peer,0);const again:any=await f.run({action,rows,preview:true});assert.match(again.plan[0].result,/Existing mapping/);f.db.close();
});
test('mapping conflicts, foreign search and stale previews block all writes',async()=>{
 const f=fixture(),action='historical-mapping-import',rows=[{...mappingRow,url:'https://www.linkedin.com/in/new-example'},{...mappingRow,search_number:999}];const p:any=await f.run({action,rows,preview:true});assert.ok(p.plan[1].error);await assert.rejects(f.run({action,rows,signature:p.signature}),/Resolve/);assert.equal(f.records().filter(r=>r.kind==='mapping').length,0);
 const conflicting=planHistoricalMappings([mappingRow,{...mappingRow,partner_review:'No'}],searches,[],members,[]);assert.match(conflicting[1].error,/Conflicting rows/);f.db.close();
});
test('mapping history enriches an interview-only link without replacing its interviews',async()=>{
 const f=fixture(),rows=[source],resolutions={[importKey(source)]:{candidate_id:'c'}},action='historical-interview-import';const p:any=await f.run({action,rows,resolutions,preview:true});await f.run({action,rows,resolutions,signature:p.signature});
 const before=f.records().find(r=>r.kind==='mapping')!,engagement=f.records().find(r=>r.kind==='engagement')!;
 const mappings=[{...mappingRow,choice:'reuse:c'}],preview:any=await f.run({action:'historical-mapping-import',rows:mappings,preview:true});assert.equal(preview.plan[0].result,'Create mapping');await f.run({action:'historical-mapping-import',rows:mappings,signature:preview.signature});
 const after=f.records().find(r=>r.kind==='mapping')!;assert.equal(after.id,before.id);assert.equal(after.status,'Approved');assert.equal(after.staff_id,'s');assert.deepEqual(f.records().find(r=>r.kind==='engagement'),engagement);f.db.close();
});
test('manual output overlap blocks duplicate performance credit and unknown researchers keep their names',async()=>{
 const f=fixture();f.db.exec("INSERT INTO teams VALUES('t','Example Team');INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('a','r','t','2025-08-01');INSERT INTO entries(id,assignment_id,staff_id,mapped) VALUES('entry','a','s',5)");
 const p:any=await f.run({action:'historical-mapping-import',rows:[{...mappingRow,choice:'reuse:c'}],preview:true});assert.match(p.plan[0].error,/aggregate output overlaps/);
 const plan=planHistoricalMappings([{...mappingRow,mapped_by:'Former researcher'}],searches,[],members,[])[0];assert.equal(plan.data.mapped_by,'Former researcher');assert.equal(plan.data.staff_id,'');assert.ok(plan.warnings.some((w:string)=>/no staff credit/.test(w)));f.db.close();
});
test('same email on different LinkedIn identities is not silently duplicated',()=>{
 const plan=planHistoricalMappings([{...mappingRow,email:'example@example.test'},{...mappingRow,url:'https://www.linkedin.com/in/another-person',email:'example@example.test'}],searches,[],members,[]);assert.match(plan[1].error,/different LinkedIn/);
});
test('directory-only researcher receives mapping attribution without a member account or invitation',async()=>{
 const f=fixture(),actor={...admin,permissions:['users.profile']};const added=await f.w.mutate(actor,'staff',{name:'Historical Researcher',email:'historical@example.test'});
 assert.ok(added.id);assert.equal(f.db.prepare('SELECT email FROM staff_profiles WHERE staff_id=?').get(added.id)?.email,'historical@example.test');
 await assert.rejects(f.w.mutate(actor,'staff',{name:'historical researcher'}),/already has this name/);
 await assert.rejects(f.w.mutate({...admin,permissions:[]},'staff',{name:'Forbidden'}),/Permission required/);
 const rows=[{...mappingRow,mapped_by:'Historical Researcher',choice:'reuse:c'}],action='historical-mapping-import',preview:any=await f.run({action,rows,preview:true});assert.equal(preview.plan[0].data.staff_id,added.id);assert.equal(preview.plan[0].data.mapper_id,'');await f.run({action,rows,signature:preview.signature});
 const state=await f.w.state(admin);assert.equal(state.entries[0].staff_id,added.id);assert.equal(state.entries[0].mapped,1);assert.equal(state.entries[0].partner,1);assert.equal(members.some(m=>m.staff_id===added.id),false);f.db.close();
});
test('clearing a recommendation date in the app is a protected edit during repeat import',async()=>{
 const f=fixture(),action='historical-interview-import',rows=[source],resolutions={[importKey(source)]:{candidate_id:'c'}},p:any=await f.run({action,rows,resolutions,preview:true});await f.run({action,rows,resolutions,signature:p.signature});
 const e=f.records().find(r=>r.kind==='engagement')!;e.recommended_on='';f.db.prepare('UPDATE research_records SET data=?,version=version+1 WHERE id=?').run(JSON.stringify(e),e.id);
 const changed=[{...source,'Date Recommendation Submitted':'2025-08-26'}],preview:any=await f.run({action,rows:changed,preview:true});assert.equal(preview.plan[0].needs_choice,true);assert.equal(preview.plan[0].conflicts[0].field,'Recommendation date');await assert.rejects(f.run({action,rows:changed,signature:preview.signature}),/Resolve/);f.db.close();
});
test('mapping locations normalize unique city/state matches and ambiguous cities require confirmation',async()=>{
 const labels=['Dallas, Texas, United States','Dallas, Georgia, United States'];let indexLoads=0,shardLoads=0;
 const matches=await mappingLocationMatches([{location:'Dallas TX'},{location:'Dallas'},{location:'Dallas TX'}],async key=>{if(key==='index'){indexLoads++;return {states:[],shards:['64-61']};}shardLoads++;return [[labels[0],'dallas texas united states tx us','dallas','city'],[labels[1],'dallas georgia united states ga us','dallas','city']];});
 assert.equal(indexLoads,1);assert.equal(shardLoads,1);assert.deepEqual(matches['Dallas TX'].options,[labels[0]]);
 const unique=planHistoricalMappings([{...mappingRow,location:'Dallas TX'}],searches,[],members,[],matches)[0];assert.equal(unique.data.location,labels[0]);assert.equal(unique.data.source_location,'Dallas TX');assert.ok(!unique.needs_choice);
 const ambiguous=planHistoricalMappings([{...mappingRow,location:'Dallas'}],searches,[],members,[],matches)[0];assert.equal(ambiguous.needs_location,true);assert.equal(ambiguous.needs_choice,true);
 const selected=planHistoricalMappings([{...mappingRow,location:'Dallas',location_choice:labels[0]}],searches,[],members,[],matches)[0];assert.equal(selected.data.location,labels[0]);assert.ok(!selected.needs_choice);
 assert.match(planHistoricalMappings([{...mappingRow,location:'Dallas',location_choice:'Invented place'}],searches,[],members,[],matches)[0].error,/Location selection changed/);
});
test('unknown locations block import until corrected or explicitly left blank with original retained',()=>{
 const missing=planHistoricalMappings([{...mappingRow,location:'Unknown town'}],searches,[],members,[])[0];assert.equal(missing.needs_choice,true);
 const blank=planHistoricalMappings([{...mappingRow,location:'Unknown town',location_choice:'blank'}],searches,[],members,[])[0];assert.equal(blank.data.location,'');assert.equal(blank.data.source_location,'Unknown town');assert.ok(!blank.needs_choice);
});
test('canonical imported locations populate candidate geography without overwriting other tags',async()=>{
 const f=fixture(),rows=[{...mappingRow,choice:'reuse:c',location:'Dallas TX'}],action='historical-mapping-import',location_matches={'Dallas TX':{options:['Dallas, Texas, United States']}};
 const p:any=await f.run({action,rows,location_matches,preview:true});await f.run({action,rows,location_matches,signature:p.signature});const c=f.records().find(r=>r.kind==='candidate')!;assert.equal(c.location,'Dallas, Texas, United States');assert.deepEqual(c.tag_values.geography,['Dallas, Texas, United States']);assert.equal(f.records().find(r=>r.kind==='mapping')!.source_location,'Dallas TX');f.db.close();
});
