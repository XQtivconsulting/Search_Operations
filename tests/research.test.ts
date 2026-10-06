import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {linkedin} from '../src/research';
registerHooks({resolve(s,c,n){if(s==='cloudflare:workers')return {url:'data:text/javascript,export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}',shortCircuit:true};return n(s,c);}});
const {Workspace}=await import('../src/workspace');
const admin:any={id:'admin',role:'admin',tenant:'test',name:'Admin',staffId:null};
const mapper:any={...admin,id:'mapper',role:'researcher',staffId:'s'};
const peer:any={...mapper,id:'peer',staffId:'p'};
const partner:any={...admin,id:'partner',role:'partner'};
const members=[{id:'admin',role:'admin',status:'active',name:'Admin'},{id:'mapper',role:'researcher',status:'active',name:'Mapper',staff_id:'s'},{id:'peer',role:'researcher',status:'active',name:'Peer',staff_id:'p'},{id:'partner',role:'partner',status:'active',name:'Partner'}];
function fixture(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');const ctx:any={storage:{sql:{exec(q:string,...p:any[]){if(!p.length&&q.includes('CREATE TABLE')){db.exec(q);return {toArray:()=>[]};}return {toArray:()=>db.prepare(q).all(...p)};}},transactionSync(fn:any){db.exec('BEGIN');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}}};const w=new Workspace(ctx,{});db.exec("INSERT INTO staff VALUES('s','Mapper'),('p','Peer');INSERT INTO teams VALUES('t','Blue');INSERT INTO team_members VALUES('t','s'),('t','p');INSERT INTO searches(id,client,title,partner_id) VALUES('r','Synthetic','One','partner'),('r2','Synthetic','Two','partner');");const run=(a:any,b:any)=>w.research(a,b,members);const state=()=>w.state(admin);const rec=async(id:string)=>(await state()).research.records.find(r=>r.id===id)!;return {db,w,run,state,rec};}
async function setup(f:ReturnType<typeof fixture>,role='r'){if(role==='r')await f.run(admin,{action:'team-reviewer',team_id:'t',reviewer_id:'peer'});const d=await f.run(admin,{action:'strategy-save',role_id:role,content:'Synthetic strategy'});await f.run(admin,{action:'strategy-approve',...await f.rec(d.id!)});const t=await f.run(admin,{action:'company-save',role_id:role,name:'Synthetic Co',scope:'Relevant leaders',team_id:'t',owner_id:'mapper'});return t.id!;}
const item={first_name:'Synthetic',last_name:'Person',name:'Synthetic Person',title:'Leader',url:'https://www.linkedin.com/in/synthetic-person/?tracking=1',rationale:'Relevant leadership evidence'};
async function mapping(f:ReturnType<typeof fixture>,target:string,role='r'){const v=await f.run(mapper,{action:'mapping-add',role_id:role,target_id:target,items:[item]});return v.ids![0];}
test('candidate shared across roles, mappings unique per role, failed batch fully rolls back',async()=>{const f=fixture(),t=await setup(f),id=await mapping(f,t);const t2=await setup(f,'r2');await mapping(f,t2,'r2');let s=await f.state();assert.equal(s.research.records.filter(r=>r.kind==='candidate').length,1);assert.equal(s.research.records.filter(r=>r.kind==='mapping').length,2);await assert.rejects(f.run(mapper,{action:'mapping-add',role_id:'r',target_id:t,items:[{...item,url:'https://www.linkedin.com/in/another-synthetic'},item]}),/already mapped/);s=await f.state();assert.equal(s.research.records.filter(r=>r.kind==='candidate').length,1);assert.equal(s.entries.length,0);assert.equal((await f.rec(id)).status,'Draft');f.db.close();});
test('two-stage reviews enforce owner and order, derive results once, preserve history',async()=>{const f=fixture(),t=await setup(f),id=await mapping(f,t);await f.run(mapper,{action:'mapping-submit',...await f.rec(id)});let r=await f.rec(id);await assert.rejects(f.run(admin,{...r,action:'mapping-review',decision:'Approve'}),/Team review requires/);await f.run(peer,{...r,action:'mapping-review',decision:'Approve'});await assert.rejects(f.run(peer,{...r,action:'mapping-review',decision:'Approve'}),/changed/);await f.run(partner,{...await f.rec(id),action:'mapping-review',decision:'Approve'});let s=await f.state();assert.deepEqual([s.entries[0].mapped,s.entries[0].peer,s.entries[0].partner],[1,1,1]);await f.run(admin,{...await f.rec(id),action:'mapping-reopen',notes:'New evidence'});await f.run(mapper,{...await f.rec(id),action:'mapping-edit',rationale:'Updated evidence'});await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});s=await f.state();assert.equal(s.entries[0].mapped,1);assert.equal(s.entries[0].partner,0);assert.equal(s.research.events.filter(e=>e.action==='mapping-review').length,2);assert.equal((await f.rec(id)).cycle,2);f.db.close();});
test('rejection requires reason, returned mappings retain review evidence',async()=>{const f=fixture(),t=await setup(f),id=await mapping(f,t);await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});await assert.rejects(f.run(peer,{...await f.rec(id),action:'mapping-review',decision:'Reject',notes:'Wrong fit'}),/rejection reason/);await f.run(peer,{...await f.rec(id),action:'mapping-review',decision:'Needs information',notes:'Explain scope'});assert.equal((await f.rec(id)).status,'Needs information');await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});assert.equal((await f.state()).entries[0].mapped,1);f.db.close();});
test('brief publication is approved-only and anonymous links are disabled',async()=>{const f=fixture();const d=await f.run(admin,{action:'brief-save',role_id:'r',content:'Candidate-safe description'});await assert.rejects(f.run(admin,{...await f.rec(d.id),action:'brief-publish'}),/Approve/);await f.run(admin,{...await f.rec(d.id),action:'brief-approve'});await f.run(admin,{...await f.rec(d.id),action:'brief-publish'});await f.run(admin,{...await f.rec(d.id),action:'brief-save',content:'Unpublished revision'});assert.equal(JSON.parse(f.db.prepare('SELECT data FROM role_publications').get()!.data as string).content,'Candidate-safe description');assert.equal(await f.w.publicBrief('legacy-token'),null);await f.run(admin,{...await f.rec(d.id),action:'brief-unpublish'});assert.equal(f.db.prepare('SELECT * FROM role_publications').all().length,0);await assert.rejects(f.run(mapper,{...await f.rec(d.id),action:'brief-publish'}),/permission/);f.db.close();});
test('claims are race-safe and self-review defaults require reassignment',async()=>{const f=fixture(),t=await setup(f);await f.run(admin,{...await f.rec(t),action:'company-save',owner_id:''});let company=await f.rec(t);await f.run(mapper,{...company,action:'company-claim'});await assert.rejects(f.run(peer,{...company,action:'company-claim'}),/changed/);const id=await mapping(f,t);await assert.rejects(f.run(admin,{...await f.rec(id),action:'mapping-reassign',reviewer_id:'mapper'}),/Self-review/);await assert.rejects(f.run(mapper,{...await f.rec(id),action:'mapping-reassign',reviewer_id:'peer'}),/permission/);f.db.close();});
test('manual output cutover blocks double counting and preserves historical rows',async()=>{const f=fixture();const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());f.db.prepare("INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('a','r','t',?)").run(date);f.db.exec("INSERT INTO entries(id,assignment_id,staff_id,mapped) VALUES('e','a','s',3)");const d=await f.run(admin,{action:'strategy-save',role_id:'r',content:'Strategy'});await assert.rejects(f.run(admin,{...await f.rec(d.id!),action:'strategy-approve'}),/manual output/);f.db.exec("UPDATE assignments SET work_date='2025-01-01'");await f.run(admin,{...await f.rec(d.id!),action:'strategy-approve'});assert.equal((await f.state()).entries[0].mapped,3);f.db.prepare("INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('b','r','t',?)").run(date);f.db.exec("INSERT INTO entries(id,assignment_id,staff_id) VALUES('new','b','s')");await assert.rejects(f.w.mutate(admin,'entry',{id:'new',version:1,mapped:5}),/candidate-derived/);f.db.close();});
test('foreign records, invalid links, readonly actors and inactive reviewers are rejected',async()=>{const f=fixture();await assert.rejects(f.run(admin,{action:'strategy-save',role_id:'foreign',content:'No'}),/not found/);await assert.rejects(f.run({...admin,role:'founder'},{action:'strategy-save',role_id:'r',content:'No'}),/read-only/);await assert.rejects(f.run(admin,{action:'team-reviewer',team_id:'t',reviewer_id:'foreign'}),/active workspace/);for(const u of ['javascript:alert(1)','https://linkedin.com.evil.test/in/a','https://user:pass@linkedin.com/in/a','https://linkedin.com/company/a'])assert.throws(()=>linkedin(u));assert.equal(linkedin(item.url),'https://www.linkedin.com/in/synthetic-person');f.db.close();});
test('batch submission rolls back every row on stale versions and review batch keeps individual events',async()=>{const f=fixture(),t=await setup(f);const result=await f.run(mapper,{action:'mapping-add',role_id:'r',target_id:t,items:[item,{...item,name:'Other',url:'https://www.linkedin.com/in/other-synthetic'}]});const ids=result.ids!;await assert.rejects(f.run(mapper,{action:'mapping-batch',operation:'mapping-submit',items:[{id:ids[0],version:1},{id:ids[1],version:99}]}),/changed/);assert.equal((await f.rec(ids[0])).status,'Draft');await f.run(mapper,{action:'mapping-batch',operation:'mapping-submit',items:ids.map((id:string)=>({id,version:1}))});await f.run(peer,{action:'mapping-batch',operation:'mapping-review',decision:'Approve',items:ids.map((id:string)=>({id,version:2}))});const state=await f.state();assert.equal(state.entries[0].mapped,2);assert.equal(state.entries[0].peer,2);assert.equal(state.research.events.filter(e=>e.action==='mapping-review').length,2);f.db.close();});
test('candidate-linked plan cannot be removed even when original manual entry is empty',async()=>{const f=fixture(),t=await setup(f),id=await mapping(f,t);await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});const date=(await f.rec(id)).work_date;await f.w.mutate(admin,'decision',{search_id:'r',week:date,disposition:'Start',version:0});const {weekDays}=await import('../src/planning');await f.w.mutate(admin,'week-plan',{search_id:'r',team_id:'t',roster_version:0,week:date,days:weekDays(date).map(d=>({date:d,enabled:d===date,target:10}))});const state=await f.state();const a=state.assignments[0];assert.equal(state.entries.find(e=>e.source==='candidates')?.assignment_id,a.id);await assert.rejects(f.w.mutate(admin,'week-plan',{search_id:'r',team_id:'t',roster_version:0,week:date,days:weekDays(date).map(d=>({date:d,enabled:false,id:d===date?a.id:undefined,version:d===date?a.version:undefined}))}),/Candidate work/);f.db.close();});
test('research screens render empty and populated role states without requiring real accounts',async()=>{const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {ResearchPanel}=await import('../src/ResearchPanel');const f=fixture(),t=await setup(f);await mapping(f,t);const state=await f.state();for(const view of ['Role repository','My Work','Workflow Monitor'])for(const tab of ['Role brief','Search strategy','Target companies','Candidate mappings','Results']){const html=renderToStaticMarkup(React.createElement(ResearchPanel,{data:{...state,people:members},api:async()=>({}),reload:async()=>{},view,initialRole:'r',initialTab:tab,onDirty:()=>{}}));assert.ok(html.includes('research-panel'));assert.ok(!html.includes('NaN'));}f.db.close();});
const {default:worker}=await import('../src/worker');
test('anonymous brief endpoint is closed and research routes use authoritative member tenant',async()=>{const f=fixture();const env:any={IDENTITY:{getByName:()=>({authenticate:async()=>admin,members:async(t:string)=>{assert.equal(t,'test');return members;}})},WORKSPACE:{getByName:(t:string)=>{assert.equal(t,'test');return f.w;}}};const res=await worker.fetch(new Request('https://app.example.com/api/public-brief?workspace=test&token='+('a'.repeat(72))),env);assert.equal(res.status,404);const mutation=await worker.fetch(new Request('https://app.example.com/api/research',{method:'POST',headers:{Origin:'https://app.example.com','X-Workspace':'foreign'},body:JSON.stringify({action:'strategy-save',role_id:'r',content:'Strategy'})}),env);assert.equal(mutation.status,200);const forbidden=await worker.fetch(new Request('https://app.example.com/api/research',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}),env);assert.equal(forbidden.status,403);f.db.close();});
test('future cutover preserves today counts and blocks early candidate submission',async()=>{const f=fixture();await f.run(admin,{action:'team-reviewer',team_id:'t',reviewer_id:'peer'});const d=await f.run(admin,{action:'strategy-save',role_id:'r',content:'Strategy'});const future=new Date(Date.now()+3*86400000).toISOString().slice(0,10);await f.run(admin,{...await f.rec(d.id),action:'strategy-approve',cutover:future});const t=await f.run(admin,{action:'company-save',role_id:'r',name:'Synthetic',team_id:'t',owner_id:'mapper'});const id=await mapping(f,t.id);await assert.rejects(f.run(mapper,{...await f.rec(id),action:'mapping-submit'}),/submissions open/);assert.equal((await f.rec(id)).status,'Draft');assert.equal((await f.state()).entries.length,0);f.db.close();});
test('company master metadata is reusable; role targets can be created before strategy or assignment',async()=>{const f=fixture();const c=await f.run(admin,{action:'company-master',name:'Reusable Co',company_type:'Services',industries:'Healthcare, Retail',offerings:'AI, Data',specialties:'AI, AI',geographies:'US',website:'https://example.com'});let company=await f.rec(c.id);assert.deepEqual(company.specialties,['AI']);const t=await f.run(admin,{action:'company-save',role_id:'r',company_id:c.id});let target=await f.rec(t.id);assert.equal(target.team_id,'');assert.equal(target.priority,'');assert.equal(target.scope,'');assert.equal(target.strategy_revision,null);await f.run(admin,{...company,action:'company-master',name:'Renamed Co',industries:'Healthcare',offerings:'AI'});assert.equal((await f.rec(c.id)).name,'Renamed Co');await assert.rejects(f.run(admin,{...company,action:'company-master',name:'Stale'}),/changed/);await assert.rejects(f.run(admin,{action:'company-save',role_id:'r',company_id:c.id}),/already/);await f.run(admin,{...target,action:'company-save',team_id:'t',owner_id:'mapper',category:'AI firms'});target=await f.rec(t.id);assert.equal(target.company_id,c.id);assert.equal(target.category,'AI firms');assert.equal(target.owner_id,'mapper');await assert.rejects(f.run(mapper,{action:'company-master',name:'Unauthorized'}),/permission/);f.db.close();});
test('bulk company selection is atomic and independent of role strategy approval',async()=>{const f=fixture();const a=await f.run(admin,{action:'company-master',name:'A'}),b=await f.run(admin,{action:'company-master',name:'B'});await assert.rejects(f.run(admin,{action:'company-batch',role_id:'r',company_ids:[a.id,'foreign']}),/not found/);assert.equal((await f.state()).research.records.filter(r=>r.kind==='target').length,0);await f.run(admin,{action:'company-batch',role_id:'r',company_ids:[a.id,b.id],category:'Consulting'});assert.equal((await f.state()).research.records.filter(r=>r.kind==='target').length,2);f.db.close();});
test('submission enters shared team review without a designated lead',async()=>{const f=fixture(),t=await setup(f);f.db.exec("DELETE FROM research_records WHERE kind='team-reviewer'");const id=await mapping(f,t);await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});assert.equal((await f.rec(id)).status,'Peer review');assert.equal((await f.rec(id)).reviewer_id,'');f.db.close();});
test('pairings and reassignments reject outsiders and departed peer cannot review',async()=>{const f=fixture(),t=await setup(f),id=await mapping(f,t);f.db.exec("INSERT INTO staff VALUES('x','Outside');INSERT INTO teams VALUES('outside','Outside');INSERT INTO team_members VALUES('outside','x')");const outsider={id:'outsider',role:'researcher',status:'active',staff_id:'x',name:'Outside'};const ms=[...members,outsider];await assert.rejects(f.w.research(admin,{action:'peer-route',team_id:'t',staff_id:'s',reviewer_id:'outsider'},ms),/same team/);await assert.rejects(f.w.research(admin,{...await f.rec(id),action:'mapping-reassign',reviewer_id:'outsider'},ms),/same team/);await f.run(admin,{action:'peer-route',team_id:'t',staff_id:'s',reviewer_id:'peer'});await assert.rejects(f.run(admin,{action:'peer-route',team_id:'t',staff_id:'s',reviewer_id:'mapper'}),/Self-review/);await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});f.db.exec("DELETE FROM team_members WHERE team_id='t' AND staff_id='p'");await assert.rejects(f.run(peer,{...await f.rec(id),action:'mapping-review',decision:'Approve'}),/same team/);f.db.close();});
test('new daily, company and team screens render; reviewer options exclude self',async()=>{const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {DailyWork}=await import('../src/DailyWork');const {CompanyUniverse}=await import('../src/CompanyUniverse');const {PeerSetup}=await import('../src/PeerSetup');const f=fixture(),state={...await f.state(),people:members};const shared={data:state,api:async()=>({}),reload:async()=>{},onDirty:()=>{}};assert.ok(renderToStaticMarkup(React.createElement(DailyWork,{...shared,assignments:[],entries:[],renderEntries:()=>null,onOpen:()=>{}})).includes('Group by'));assert.ok(renderToStaticMarkup(React.createElement(CompanyUniverse,shared)).includes('Company size'));const peers=renderToStaticMarkup(React.createElement(PeerSetup,shared));assert.ok(peers.includes('Team lead for Blue'));assert.ok(peers.includes('Team lead for Blue'));assert.ok(!peers.includes('value="partner"'));f.db.close();});

test('company import combines repeated rows and tags, protects values, checks preview versions and rolls back conflicts',async()=>{
 const f=fixture();const c=await f.run(admin,{action:'company-master',name:'Example Co',tags:'AI',website:'https://example.com',revenue:'100 USD'});
 const rows=[{name:'Example Co',tags:'ai,Data',website:'https://example.com',revenue:'200 USD'},{name:' Example Co ',tags:'Consulting'},{name:'New Co',tags:'AI'},{name:'New Co',tags:'Services'}];
 const preview=await f.run(admin,{action:'company-import',preview:true,rows});assert.equal(preview.plan.length,2);assert.deepEqual(preview.plan[0].tags,['AI','Data','Consulting']);assert.equal(preview.plan[0].revenue,'100 USD');
 await f.run(admin,{action:'company-import',rows,signature:preview.signature});assert.deepEqual((await f.rec(c.id)).tags,['AI','Data','Consulting']);assert.equal((await f.state()).research.records.filter(r=>r.kind==='company').length,2);
 await assert.rejects(f.run(admin,{action:'company-import',rows,signature:preview.signature}),/changed/);
 await assert.rejects(f.run(mapper,{action:'company-import',preview:true,rows}),/permission/);
 const conflict=[{name:'Newer Co'},{name:'Example Co',website:'https://different.example'}];await assert.rejects(f.run(admin,{action:'company-import',rows:conflict,preview:true}),/conflicting/);assert.equal((await f.state()).research.records.filter(r=>r.kind==='company').length,2);
 const replacement=await f.run(admin,{action:'company-import',rows,overwrite:true,preview:true});assert.equal(replacement.plan[0].revenue,'200 USD');f.db.close();
});
test('wave batches preserve role assignment and roll back on stale targets or cross-role permissions',async()=>{
 const f=fixture();const t=await f.run(admin,{action:'company-save',role_id:'r',name:'One'}),u=await f.run(admin,{action:'company-save',role_id:'r2',name:'Two'});
 await assert.rejects(f.run(admin,{action:'target-waves',wave:2,items:[{id:t.id,version:1},{id:u.id,version:9}]}),/changed/);assert.equal((await f.rec(t.id)).wave,null);
 await f.run(admin,{action:'target-waves',wave:2,items:[{id:t.id,version:1},{id:u.id,version:1}]});assert.equal((await f.rec(t.id)).wave,2);assert.equal((await f.rec(u.id)).role_id,'r2');await assert.rejects(f.run(mapper,{action:'target-waves',wave:1,items:[{id:t.id,version:2}]}),/permission/);f.db.close();
});
test('secure candidate invites require email code, hide tokens, bind roles, expire and revoke sessions',async()=>{
 const f=fixture(),t=await setup(f),mid=await mapping(f,t),candidate=(await f.rec(mid)).candidate_id;
 const d=await f.run(admin,{action:'brief-save',role_id:'r',content:'Approved candidate content'});await f.run(admin,{...await f.rec(d.id),action:'brief-approve'});await f.run(admin,{...await f.rec(d.id),action:'brief-publish'});
 await assert.rejects(f.w.candidateInvite(mapper,{role_id:'r',candidate_id:candidate,email:'synthetic@example.com',days:7}),/permission/);
 await assert.rejects(f.w.candidateInvite(admin,{role_id:'r',candidate_id:'unmapped',email:'synthetic@example.com',days:7}),/mapped/);
 const invitation=await f.w.candidateInvite(admin,{role_id:'r',candidate_id:candidate,email:'synthetic@example.com',days:7});
 assert.ok(!JSON.stringify(await f.state()).includes(invitation.token));assert.ok(!JSON.stringify(await f.w.candidateInvites(admin,'r')).includes('token_hash'));
 await assert.rejects(f.w.candidatePage(invitation.token),/Verify/);
 const c=await f.w.candidateCode({token:invitation.token},'ip');assert.equal(c.email,'synthetic@example.com');
 await assert.rejects(f.w.candidateVerify({token:invitation.token,code:'000000'},'ip'),/Incorrect/);assert.equal(f.db.prepare('SELECT attempts FROM candidate_codes').get()?.attempts,1);
 const session=await f.w.candidateVerify({token:invitation.token,code:c.code},'ip');const page=await f.w.candidatePage(session.token,invitation.token);assert.equal(page.content,'Approved candidate content');assert.equal(page.candidate_name,'Synthetic Person');assert.ok(!JSON.stringify(page).includes('rationale'));
 await assert.rejects(f.w.candidatePage(session.token,'other-invitation'),/Verify/);await assert.rejects(f.w.candidateVerify({token:invitation.token,code:c.code},'ip'),/new verification/);
 await f.w.candidateRevoke(admin,invitation.id);await assert.rejects(f.w.candidatePage(session.token),/Verify/);await assert.rejects(f.w.candidateCode({token:invitation.token},'ip'),/unavailable/);
 const newer=await f.w.candidateInvite(admin,{role_id:'r',candidate_id:candidate,email:'synthetic@example.com',days:7});f.db.prepare('UPDATE candidate_invites SET expires=0 WHERE id=?').run(newer.id);await assert.rejects(f.w.candidateCode({token:newer.token},'ip'),/expired/);f.db.close();
});
test('candidate code attempts are bounded, unpublish blocks sessions and publication snapshots exclude drafts',async()=>{
 const f=fixture(),t=await setup(f),mid=await mapping(f,t),candidate=(await f.rec(mid)).candidate_id;
 const d=await f.run(admin,{action:'brief-save',role_id:'r',content:'Approved text',page:{sections:[{heading:'Role',body:'Approved text'}]}});await f.run(admin,{...await f.rec(d.id),action:'brief-approve'});await f.run(admin,{...await f.rec(d.id),action:'brief-publish'});
 const i=await f.w.candidateInvite(admin,{role_id:'r',candidate_id:candidate,email:'synthetic@example.com',days:1}),c=await f.w.candidateCode({token:i.token},'ip');for(let n=0;n<5;n++)await assert.rejects(f.w.candidateVerify({token:i.token,code:'000000'},'ip'));await assert.rejects(f.w.candidateVerify({token:i.token,code:c.code},'ip'),/new verification/);
 const j=await f.w.candidateInvite(admin,{role_id:'r',candidate_id:candidate,email:'synthetic@example.com',days:1}),code=await f.w.candidateCode({token:j.token},'ip'),s=await f.w.candidateVerify({token:j.token,code:code.code},'ip');
 await f.run(admin,{...await f.rec(d.id),action:'brief-save',page:{sections:[{heading:'Role',body:'Unapproved text'}]}});assert.equal((await f.w.candidatePage(s.token)).page.sections[0].body,'Approved text');
 await f.run(admin,{...await f.rec(d.id),action:'brief-unpublish'});await assert.rejects(f.w.candidatePage(s.token),/Verify/);f.db.close();
});

test('document publication never inherits the role title, client or earlier page fields',async()=>{
 const {layoutDocument,freshDocumentPage}=await import('../src/document-layout');const f=fixture();
 const d=layoutDocument([{text:'Synthetic Alpha role',x:50,y:740,width:400,size:30,bold:true,page:1},{text:'Source-only role requirements and responsibilities.',x:50,y:680,width:450,size:12,bold:false,page:1}]);
 const page=freshDocumentPage(d,'synthetic-alpha.pdf','a'.repeat(64));
 const first=await f.run(admin,{action:'brief-save',role_id:'r',content:'Old unrelated content',page:{sections:[{heading:'Old section',body:'Old unrelated content'}],partner_name:'Old partner'}});
 await f.run(admin,{action:'brief-release',role_id:'r',...await f.rec(first.id),page});
 const published=JSON.parse(f.db.prepare('SELECT data FROM role_publications WHERE role_id=?').get('r')!.data as string);
 assert.equal(published.title,'Synthetic Alpha role');assert.equal(published.client,'');assert.equal(published.page.partner_name,'');assert.ok(!JSON.stringify(published).includes('Old unrelated'));assert.equal(published.page.source_text,undefined);assert.equal((await f.rec(first.id)).status,'Approved');assert.equal((await f.rec(first.id)).published_revision,1);
 const before=await f.rec(first.id);await assert.rejects(f.run(mapper,{action:'brief-release',role_id:'r',...before,page}),/permission/);
 await assert.rejects(f.run(admin,{action:'brief-release',role_id:'r',...before,page:{...page,title:'Unrelated company content'}}),/only wording/);
 assert.equal((await f.rec(first.id)).version,before.version);assert.equal(JSON.parse(f.db.prepare('SELECT data FROM role_publications WHERE role_id=?').get('r')!.data as string).title,'Synthetic Alpha role');f.db.close();
});

test('unaccepted people cannot be assigned or paired; active account is required',async()=>{
 const f=fixture();await setup(f);f.db.exec("INSERT INTO staff VALUES('unlinked','Future Teammate');INSERT INTO team_members VALUES('t','unlinked')");
 await assert.rejects(f.run(admin,{action:'peer-route',team_id:'t',staff_id:'s',reviewer_staff_id:'unlinked'}),/same team/);
 assert.equal(f.db.prepare("SELECT COUNT(*) n FROM team_members WHERE staff_id='unlinked'").get()?.n,0);
 const roster=f.db.prepare("SELECT version FROM team_rosters WHERE team_id='t'").get()!.version;
 await assert.rejects(f.w.mutate(admin,'team-members',{id:'t',version:roster,staff_ids:['s','unlinked']},members),/active researcher/);
 const active=[...members,{id:'future-account',name:'Future',role:'researcher',status:'active',staff_id:'unlinked'}];
 await f.w.mutate(admin,'team-members',{id:'t',version:roster,staff_ids:['s','p','unlinked']},active);
 await f.w.research(admin,{action:'peer-route',team_id:'t',staff_id:'s',reviewer_staff_id:'unlinked'},active);f.db.close();
});
test('unlinked teammates are hidden from reviewer choices',async()=>{
 const f=fixture();f.db.exec("INSERT INTO staff VALUES('unlinked','Future Teammate');INSERT INTO team_members VALUES('t','unlinked')");
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{PeerSetup}=await import('../src/PeerSetup'),{StaffDirectory}=await import('../src/StaffDirectory');
 const data={...await f.state(),people:members},props={data,api:async()=>({}),reload:async()=>{}};
 const html=renderToStaticMarkup(React.createElement(PeerSetup,props));
 assert.ok(!html.includes('Future Teammate'));assert.ok(html.includes('Team lead for Blue'));
 f.db.close();
});

test('candidate directory enforces LinkedIn uniqueness, requires both names and preserves mapping snapshots on contact edits',async()=>{
 const f=fixture();const c=await f.run(mapper,{action:'candidate-save',first_name:'Alex',last_name:'Example',url:'https://linkedin.com/in/Alex-Example/?trk=synthetic',email:'alex@example.com',phone:'+1 555 0100'});
 const candidate=await f.rec(c.id);assert.equal(candidate.url,'https://www.linkedin.com/in/alex-example');
 await assert.rejects(f.run(mapper,{action:'candidate-save',first_name:'Different',last_name:'Spelling',url:'https://www.linkedin.com/in/alex-example'}),/already exists/);
 await assert.rejects(f.run(mapper,{action:'candidate-save',first_name:'Missing',url:'https://www.linkedin.com/in/missing'}),/last name/);
 const m=await f.run(mapper,{action:'mapping-add',role_id:'r',team_id:'t',items:[{candidate_id:c.id,rationale:'Evidence for role one'}]});
 await f.run(mapper,{...candidate,action:'candidate-save',first_name:'Alexander',email:'updated@example.com'});
 assert.equal((await f.rec(c.id)).email,'updated@example.com');assert.equal((await f.rec(m.ids[0])).name,'Alex Example');assert.equal((await f.rec(m.ids[0])).candidate_id,c.id);
 await assert.rejects(f.run(mapper,{...candidate,action:'candidate-save',first_name:'Stale'}),/changed/);f.db.close();
});
test('one candidate links to multiple roles and researchers with independent mapping attribution and review state',async()=>{
 const f=fixture();await setup(f);await setup(f,'r2');
 const c=await f.run(mapper,{action:'candidate-save',first_name:'Shared',last_name:'Candidate',url:'https://www.linkedin.com/in/shared-person'});
 const one=await f.run(mapper,{action:'mapping-add',role_id:'r',team_id:'t',items:[{candidate_id:c.id,rationale:'Role one fit'}]});
 const two=await f.run(peer,{action:'mapping-add',role_id:'r2',team_id:'t',items:[{candidate_id:c.id,rationale:'Role two fit'}]});
 await f.run(mapper,{...await f.rec(one.ids[0]),action:'mapping-submit'});
 const m1=await f.rec(one.ids[0]),m2=await f.rec(two.ids[0]);assert.equal(m1.status,'Peer review');assert.equal(m2.status,'Draft');assert.equal(m1.candidate_id,m2.candidate_id);assert.equal(m1.mapper_id,'mapper');assert.equal(m2.mapper_id,'peer');assert.notEqual(m1.rationale,m2.rationale);
 await assert.rejects(f.run(peer,{action:'mapping-add',role_id:'r',team_id:'t',items:[{candidate_id:c.id}]}),/already mapped/);
 assert.equal((await f.state()).research.records.filter(r=>r.kind==='candidate').length,1);
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{Candidates}=await import('../src/Candidates');const html=renderToStaticMarkup(React.createElement(Candidates,{data:{...await f.state(),people:members},api:async()=>({}),reload:async()=>{},onDirty:()=>{}}));assert.ok(html.includes('Shared'));assert.ok(!html.includes('View 2 mapped searches for Shared Candidate'));assert.ok(html.includes('Filter searches'));assert.ok(html.includes('Filter Industry'));assert.ok(!html.includes('Search coverage'));assert.ok(!html.includes('Mapped by Mapper'));assert.ok(!html.includes('Mapped by Peer'));f.db.close();
});
test('admin plus researcher can map under their own identity; researcher permission and team membership are enforced',async()=>{
 const f=fixture();await setup(f);const dual={...mapper,role:'admin',roles:['admin','researcher','partner']},ms=members.map(m=>m.id==='mapper'?{...m,role:'admin',roles:['admin','researcher','partner']}:m);
 const added=await f.w.research(dual,{action:'mapping-add',role_id:'r',team_id:'t',items:[item]},ms);assert.equal((await f.rec(added.ids[0])).mapper_id,mapper.id);
 await f.w.research(dual,{...await f.rec(added.ids[0]),action:'mapping-submit'},ms);assert.equal((await f.rec(added.ids[0])).reviewer_id,'');
 await assert.rejects(f.w.research({...dual,roles:['admin']},{action:'mapping-add',role_id:'r2',team_id:'t',items:[item]},ms),/Researcher role/);
 await assert.rejects(f.run(mapper,{action:'mapping-add',role_id:'r2',team_id:'foreign',items:[item]}),/team you belong/);
 await assert.rejects(f.run({...admin,role:'founder'},{action:'candidate-save',...item}),/already exists/);f.db.close();
});
test('read-only candidate and people screens do not offer sourcing writes; teams are visible without duplicate directories',async()=>{
 const f=fixture(),React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{Candidates}=await import('../src/Candidates'),{TeamsPanel}=await import('../src/TeamsPanel');
 const shared={data:{...await f.state(),actor:{...admin,role:'founder'},people:members},api:async()=>({}),reload:async()=>{},onDirty:()=>{}};
 const markup=renderToStaticMarkup(React.createElement(Candidates,shared));assert.ok(markup.includes('>Add candidate<'));assert.ok(!markup.includes('Import Excel'));assert.ok(!markup.includes('Assign selected'));
 const teams=renderToStaticMarkup(React.createElement(TeamsPanel,{...shared,onAdd:()=>{}}));assert.ok(teams.includes('Blue'));assert.ok(!teams.includes('Edit members'));assert.ok(!teams.includes('Edit researcher'));f.db.close();
});

test('explicit target assignment validates researcher team and preserves existing mappings and coverage',async()=>{
 const f=fixture(),target=await setup(f),mid=await mapping(f,target),before=await f.rec(target);
 await f.run(admin,{...before,action:'target-assign',team_id:'t',owner_id:'peer'});const after=await f.rec(target);
 assert.equal(after.owner_id,'peer');assert.equal(after.company_id,before.company_id);assert.equal(after.scope,before.scope);assert.equal((await f.rec(mid)).mapper_id,'mapper');
 await assert.rejects(f.run(admin,{...before,action:'target-assign',team_id:'t',owner_id:'mapper'}),/changed/);
 await assert.rejects(f.run(mapper,{...after,action:'target-assign',team_id:'t',owner_id:'mapper'}),/permission/);
 await assert.rejects(f.run(admin,{...after,action:'target-assign',team_id:'t',owner_id:'partner'}),/researcher linked/);f.db.close();
});

test('candidate spreadsheet import previews and reuses canonical profiles, with idempotent role mapping',async()=>{
 const f=fixture();const rows=[{first_name:'Test',last_name:'Person',url:'https://linkedin.com/in/bulk-person?trk=x',email:'test@example.com'},{first_name:'Duplicate',last_name:'Person',url:'https://www.linkedin.com/in/bulk-person/'}];
 const b={action:'candidate-import',rows,role_id:'r',team_id:'t'};const p=await f.run({...mapper,roles:['researcher','data_quality']},{...b,preview:true});assert.equal(p.plan[1].status,'Duplicate in file');assert.equal((await f.state()).research.records.length,0);
 const result=await f.run({...mapper,roles:['researcher','data_quality']},{...b,signature:p.signature});assert.deepEqual(result,{created:1,reused:0,mapped:1,skipped:1});
 const c=(await f.state()).research.records.find(r=>r.kind==='candidate')!;assert.equal(c.first_name,'Test');const again=await f.run({...mapper,roles:['researcher','data_quality']},{...b,preview:true});assert.equal(again.plan[0].mapping,'Already mapped');assert.equal((await f.run({...mapper,roles:['researcher','data_quality']},{...b,signature:again.signature})).mapped,0);
 const assign={action:'candidate-assign',candidate_ids:[c.id],role_id:'r2',team_id:'t'};const ap=await f.run(peer,{...assign,preview:true});await f.run(peer,{...assign,signature:ap.signature});const maps=(await f.state()).research.records.filter(r=>r.kind==='mapping');assert.equal(maps.length,2);assert.ok(maps.every(m=>m.status==='Draft'));assert.equal(maps.find(m=>m.role_id==='r2')?.mapper_id,'peer');f.db.close();
});
test('candidate import validates rows, stale previews, permissions and atomic rollback',async()=>{
 const f=fixture(),rows=[{first_name:'New',last_name:'Person',url:'https://linkedin.com/in/new-bulk'}],b={action:'candidate-import',rows};
 await assert.rejects(f.run({...admin,role:'super_admin'},{...b,preview:true,rows:[...rows,{...rows[0],url:'bad'}]}),/Row 3/);
 await assert.rejects(f.run({...admin,role:'founder'},{...b,preview:true}),/permission/);
 await assert.rejects(f.run({...admin,role:'super_admin'},{...b,role_id:'r',team_id:'t',preview:true}),/Researcher/);
 const p=await f.run({...admin,role:'super_admin'},{...b,preview:true});await f.run({...admin,role:'super_admin'},{action:'candidate-save',...rows[0]});await assert.rejects(f.run({...admin,role:'super_admin'},{...b,signature:p.signature}),/changed/);
 await assert.rejects(f.run({...mapper,roles:['researcher','data_quality']},{action:'candidate-assign',candidate_ids:['foreign'],role_id:'r',team_id:'t',preview:true}),/not found/);
 const old=await f.run({...admin,role:'super_admin'},{action:'candidate-save',first_name:'Old',last_name:'Name',url:'https://linkedin.com/in/legacy-bulk'});const raw=f.db.prepare('SELECT data FROM research_records WHERE id=?').get(old.id)!.data as string;const data=JSON.parse(raw);delete data.first_name;f.db.prepare('UPDATE research_records SET data=? WHERE id=?').run(JSON.stringify(data),old.id);
 const batch={action:'candidate-import',rows:[{...rows[0],url:'https://linkedin.com/in/rollback-new'},{first_name:'Old',last_name:'Name',url:data.url}],role_id:'r',team_id:'t'};const pre=await f.run({...mapper,roles:['researcher','data_quality']},{...batch,preview:true});await assert.rejects(f.run({...mapper,roles:['researcher','data_quality']},{...batch,signature:pre.signature}),/first name|First name/);assert.ok(!(await f.state()).research.records.some(r=>r.url==='https://www.linkedin.com/in/rollback-new'));f.db.close();
});

test('accepted account may share a display name with legacy staff or another account without breaking state',async()=>{
 const f=fixture();f.db.exec("INSERT INTO staff VALUES('legacy-duplicate','Same Person');INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('old','r','t','2026-09-01');INSERT INTO entries(id,assignment_id,staff_id,mapped) VALUES('old-entry','old','legacy-duplicate',7)");
 const accepted=[...members,{id:'account-one',name:'Same Person',role:'researcher',status:'active',staff_id:'person:account-one'},{id:'account-two',name:'Same Person',role:'researcher',status:'active',staff_id:'person:account-two'}];
 const state=await f.w.state(admin,accepted);assert.equal(state.staff.filter(s=>s.name==='Same Person').length,3);assert.equal(f.db.prepare("SELECT mapped FROM entries WHERE id='old-entry'").get()?.mapped,7);
 const again=await f.w.state(admin,accepted);assert.equal(again.staff.length,state.staff.length);assert.equal(f.db.prepare("SELECT name FROM staff WHERE id='legacy-duplicate'").get()?.name,'Same Person');
 const version=(again.teams.find(t=>t.id==='t') as any).roster_version;await f.w.mutate(admin,'team-members',{id:'t',version,staff_ids:['person:account-one','person:account-two']},accepted);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM team_members WHERE team_id='t'").get()?.n,2);f.db.close();
});

test('inline mappings create explicit companies and role coverage atomically, reuse master candidates, and keep authorship',async()=>{
 const f=fixture();const b={action:'mapping-inline',role_id:'r',team_id:'t',first_name:'Inline',last_name:'Person',url:'https://linkedin.com/in/inline-person',company:'Inline Co',title:'VP of Sales'};
 await assert.rejects(f.run(mapper,b),/explicitly add/);assert.equal((await f.state()).research.records.length,0);
 const result=await f.run(mapper,{...b,create_company:true});let state=await f.state();const company=state.research.records.find(r=>r.kind==='company')!,candidate=state.research.records.find(r=>r.kind==='candidate')!,target=state.research.records.find(r=>r.kind==='target')!,mapping=await f.rec(result.ids[0]);
 assert.equal(candidate.company_id,company.id);assert.equal(candidate.title,'VP of Sales');assert.equal(mapping.title,'VP of Sales');assert.equal(target.owner_id,'mapper');assert.equal(mapping.target_id,target.id);assert.equal(mapping.mapper_id,'mapper');assert.equal(mapping.staff_id,'s');assert.equal(mapping.team_id,'t');assert.equal(mapping.status,'Draft');assert.equal(target.status,'Not started');
 await assert.rejects(f.run(mapper,{...b,candidate_version:candidate.version}),/already mapped/);
 await f.run(peer,{...b,role_id:'r2',candidate_version:candidate.version,company:'Wrong incoming company',first_name:'Wrong incoming name',title:'Wrong incoming title'});
 state=await f.state();assert.equal(state.research.records.filter(r=>r.kind==='company').length,1);assert.equal(state.research.records.filter(r=>r.kind==='candidate').length,1);assert.equal((await f.rec(candidate.id)).first_name,'Inline');assert.equal((await f.rec(candidate.id)).title,'VP of Sales');assert.equal(state.research.records.find(r=>r.kind==='mapping'&&r.role_id==='r2')?.title,'VP of Sales');assert.equal(state.research.records.find(r=>r.kind==='mapping'&&r.role_id==='r2')?.mapper_id,'peer');
 await f.run(mapper,{...target,action:'company-progress',status:'Completed',notes:'Research complete'});assert.equal((await f.rec(mapping.id)).status,'Draft');f.db.close();
});
test('inline mapping validation rolls back new company and target; stale candidate details are rejected',async()=>{
 const f=fixture(),base={action:'mapping-inline',role_id:'r',team_id:'t',company:'Rollback Co',create_company:true,url:'https://linkedin.com/in/rollback-inline'};
 await assert.rejects(f.run(mapper,{...base,first_name:'Missing last name'}),/last name/);assert.equal((await f.state()).research.records.length,0);
 await assert.rejects(f.run({...mapper,role:'founder'},base),/Researcher/);await assert.rejects(f.run(mapper,{...base,team_id:'foreign',first_name:'Test',last_name:'Person'}));assert.equal((await f.state()).research.records.length,0);
 const c=await f.run(mapper,{action:'candidate-save',first_name:'Existing',last_name:'Person',url:base.url});await assert.rejects(f.run(mapper,{...base,candidate_version:99}),/changed/);assert.equal((await f.state()).research.records.length,1);f.db.close();
});
test('role-first My Work and mapping entry expose roles first and no mapping popup or contact fields',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{MyWork}=await import('../src/MyWork'),{InlineMapping}=await import('../src/InlineMapping');
 const f=fixture(),data={...await f.state(),actor:mapper,people:members},common={data,api:async()=>({}),reload:async()=>{},onDirty:()=>{},onCandidate:()=>{}};
 const html=renderToStaticMarkup(React.createElement(MyWork,{...common,onOpen:()=>{}}));assert.ok(html.includes('My planned work'));assert.ok(!html.includes('My company assignments'));
 const row=renderToStaticMarkup(React.createElement(InlineMapping,{...common,role:'r',team:'t'}));assert.ok(row.includes('LinkedIn profile URL'));assert.ok(row.includes('Current company'));assert.ok(row.includes('Current title'));assert.ok(!row.includes('role="dialog"'));assert.ok(!row.includes('Email'));assert.ok(!row.includes('Phone'));f.db.close();
});

test('bulk company allocation is atomic, role scoped and uses active team researchers',async()=>{
 const f=fixture(),a=await f.run(admin,{action:'company-save',role_id:'r',name:'Bulk A'}),b=await f.run(admin,{action:'company-save',role_id:'r',name:'Bulk B'}),body={action:'target-assign-batch',role_id:'r',team_id:'t',owner_id:'mapper',items:[{id:a.id,version:1},{id:b.id,version:1}]};
 await assert.rejects(f.run(mapper,body),/permission/);await assert.rejects(f.run(admin,{...body,items:[body.items[0],{id:b.id,version:99}]}),/changed/);assert.equal((await f.rec(a.id)).owner_id,'');
 await f.run(admin,body);assert.equal((await f.rec(a.id)).owner_id,'mapper');assert.equal((await f.rec(b.id)).owner_id,'mapper');
 await assert.rejects(f.run(admin,{...body,role_id:'r2',items:[{id:a.id,version:2}]}),/this role/);f.db.close();
});
test('assign to me resolves an unassigned company through role planning while respecting an explicit team',async()=>{
 const f=fixture();f.db.exec("INSERT INTO teams VALUES('other','Other');INSERT INTO team_members VALUES('other','s');INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('plan','r','t','2026-09-28')");
 const t=await f.run(admin,{action:'company-save',role_id:'r',name:'Claimable'});await f.run(mapper,{...await f.rec(t.id),action:'company-claim'});const claimed=await f.rec(t.id);assert.equal(claimed.team_id,'t');assert.equal(claimed.owner_id,'mapper');
 await assert.rejects(f.run(peer,{...claimed,action:'company-claim'}),/already assigned/);
 const blocked=await f.run(admin,{action:'company-save',role_id:'r',name:'Other team',team_id:'other'});await assert.rejects(f.run(peer,{...await f.rec(blocked.id),action:'company-claim',team_id:'t'}),/assigned team/);f.db.close();
});
test('no talent counts as completed research with zero mappings and retains completion attribution',async()=>{
 const f=fixture(),t=await f.run(admin,{action:'company-save',role_id:'r',name:'Researched company',team_id:'t',owner_id:'mapper'});await f.run(mapper,{...await f.rec(t.id),action:'company-progress',status:'No relevant talent',notes:'Checked relevant leadership; none meet the mandate.'});
 const completed=await f.rec(t.id);assert.equal(completed.coverage_researcher_id,'mapper');assert.equal(completed.coverage_team_id,'t');assert.ok(completed.completed_at);
 const {workflowSummary}=await import('../src/workflow-summary');const summary=workflowSummary(await f.state()).find((r:any)=>r.role.id==='r')!;assert.equal(summary.completed,1);assert.equal(summary.noTalent,1);assert.equal(summary.submitted,0);
 await assert.rejects(f.run(admin,{action:'target-assign-batch',role_id:'r',team_id:'t',owner_id:'peer',items:[{id:t.id,version:completed.version}]}),/Reopen/);assert.equal((await f.rec(t.id)).owner_id,'mapper');f.db.close();
});

test('team membership permits own mapping review and lead changes do not assign pending reviews',async()=>{
 const f=fixture(),t=await setup(f),id=await mapping(f,t);await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});
 const config=(await f.state()).research.records.find(r=>r.kind==='team-reviewer')!;await f.run(admin,{...config,action:'team-reviewer',team_id:'t',reviewer_id:'mapper'});
 assert.equal((await f.rec(id)).reviewer_id,'');await f.run(mapper,{...await f.rec(id),action:'mapping-review',decision:'Approve'});assert.equal((await f.rec(id)).status,'Partner review');
 await assert.rejects(f.run(partner,{...await f.rec(id),action:'mapping-review',decision:'Hold',notes:'Maybe'}),/Choose a decision/);
 await f.run(partner,{...await f.rec(id),action:'mapping-review',decision:'Needs information',notes:'Please verify scale'});assert.equal((await f.rec(id)).status,'Needs information');f.db.close();
});
test('approved criteria require per-criterion evidence or explained not-applicable on submission',async()=>{
 const f=fixture(),t=await setup(f),id=await mapping(f,t);const strategy=(await f.state()).research.records.find(r=>r.kind==='strategy')!;
 await f.run(admin,{...strategy,action:'strategy-save',content:'Updated',criteria:[{id:'location',label:'Location',requirement:'Can work in London'}]});await f.run(admin,{...await f.rec(strategy.id),action:'strategy-approve'});
 await assert.rejects(f.run(mapper,{...await f.rec(id),action:'mapping-submit'}),/Rate the candidate|Provide evidence/);
 await f.run(mapper,{...await f.rec(id),action:'mapping-edit',rationale:'Relevant',evidence:{location:{text:'Candidate confirms relocation',not_applicable:false,rating:4}}});await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});
 assert.equal((await f.rec(id)).criteria_snapshot[0].label,'Location');assert.equal((await f.rec(id)).evidence.location.text,'Candidate confirms relocation');f.db.close();
});
test('original brief is stored and read without creating or publishing a web page',async()=>{
 const f=fixture(),base64=Buffer.from('%PDF synthetic test').toString('base64');const file=await f.run(admin,{action:'brief-file-save',role_id:'r',name:'brief.pdf',base64});
 assert.equal((await f.run(mapper,{action:'brief-file-read',role_id:'r',file_id:file.id})).base64,base64);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM role_publications').get()?.n,0);
 await assert.rejects(f.run(mapper,{action:'brief-file-save',role_id:'r',name:'bad.pdf',base64}),/permission/);f.db.close();
});
test('assigned setup tasks permit draft work and own status changes, not approval',async()=>{
 const f=fixture();const task=await f.run(admin,{action:'task-save',role_id:'r',owner_id:'mapper',team_id:'t',task_type:'Search strategy',work_date:'2026-09-30'});
 const d=await f.run(mapper,{action:'strategy-save',role_id:'r',content:'Draft by assignee',criteria:[]});await assert.rejects(f.run(mapper,{...await f.rec(d.id),action:'strategy-approve'}),/permission/);
 await f.run(mapper,{...await f.rec(task.id),action:'task-status',status:'Completed'});assert.equal((await f.rec(task.id)).status,'Completed');f.db.close();
});
test('researcher transfer checks versions and preserves historic assignments',async()=>{
 const f=fixture();await f.w.syncPeople(members);f.db.exec("INSERT INTO teams VALUES('new','New'); INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('old','r','t','2026-09-28');INSERT INTO entries(id,assignment_id,staff_id) VALUES('e','old','s')");
 await f.w.mutate(admin,'team-transfer',{staff_id:'s',from:'t',to:'new',from_version:0,to_version:0},members);assert.equal(f.db.prepare("SELECT team_id FROM assignments WHERE id='old'").get()?.team_id,'t');assert.equal(f.db.prepare("SELECT team_id FROM team_members WHERE staff_id='s'").get()?.team_id,'new');f.db.close();
});

test('company alias matches canonical identity during mapping and conflicting aliases are rejected',async()=>{
 const f=fixture();const c=await f.run(admin,{action:'company-master',name:'Example Formova',aliases:'Example'});
 await assert.rejects(f.run(admin,{action:'company-master',name:'Other',aliases:'Example'}),/already assigned/);
 const result=await f.run(mapper,{action:'mapping-inline',role_id:'r',team_id:'t',first_name:'Alex',last_name:'Example',url:'https://linkedin.com/in/alias-synthetic',company:'Example',company_id:c.id});
 const m=await f.rec(result.ids[0]);assert.equal(m.company_id,c.id);assert.equal(m.company,'Example Formova');assert.equal((await f.state()).research.records.filter(r=>r.kind==='company').length,1);f.db.close();
});

test('new inline mapping persists criterion justification and approved requirements before submission',async()=>{
 const f=fixture();await setup(f);const strategy=(await f.state()).research.records.find(r=>r.kind==='strategy')!;
 await f.run(admin,{...strategy,action:'strategy-save',content:'Fit strategy',criteria:[{id:'scope',label:'Leadership scope',requirement:'Multiple sites'}]});
 await f.run(admin,{...await f.rec(strategy.id),action:'strategy-approve'});
 const result=await f.run(mapper,{action:'mapping-inline',role_id:'r',team_id:'t',first_name:'Case',last_name:'Example',url:'https://linkedin.com/in/criterion-case',rationale:'Relevant scope',evidence:{scope:{text:'Led quality at three sites',rating:5}}});
 const m=await f.rec(result.ids[0]);assert.equal(m.evidence.scope.text,'Led quality at three sites');assert.equal(m.criteria_snapshot[0].requirement,'Multiple sites');assert.equal(m.status,'Draft');
 await f.run(mapper,{...m,action:'mapping-submit'});assert.equal((await f.rec(m.id)).status,'Peer review');f.db.close();
});

test('strategy weights persist through approval and invalid totals leave the saved draft untouched',async()=>{
 const f=fixture();await setup(f);const s=(await f.state()).research.records.find(r=>r.kind==='strategy')!;
 await f.run(admin,{...s,action:'strategy-save',content:'Weighted strategy',criteria:[{id:'scope',label:'Scope',requirement:'Multi-site',weight:60},{id:'qualification',label:'Qualification',requirement:'Certification',weight:40}]});
 const saved=await f.rec(s.id);await assert.rejects(f.run(admin,{...saved,action:'strategy-save',content:'Invalid weights',criteria:[{id:'scope',label:'Scope',weight:90}]}),/100/);
 assert.equal((await f.rec(s.id)).version,saved.version);
 await f.run(admin,{...saved,action:'strategy-approve'});
 assert.deepEqual((await f.rec(s.id)).active_criteria.map((c:any)=>c.weight),[60,40]);f.db.close();
});

const engMember={id:'engager',role:'engagement',status:'active',name:'Synthetic Engagement'};
const engActor:any={...admin,id:'engager',role:'engagement'};
async function engagementFixture(){const f=fixture(),t=await setup(f),mid=await mapping(f,t);await f.run(mapper,{...await f.rec(mid),action:'mapping-submit'});await f.run(peer,{...await f.rec(mid),action:'mapping-review',decision:'Approve'});await f.run(partner,{...await f.rec(mid),action:'mapping-review',decision:'Approve'});const ms=[...members,engMember],run=(a:any,b:any)=>f.w.research(a,b,ms),team=await run(admin,{action:'engagement-team-save',name:'Synthetic Engagement',member_ids:['engager'],lead_id:'engager'});const eng=async()=>(await f.state()).research.records.find(r=>r.kind==='engagement'&&r.mapping_id===mid)!;const body=async()=>({...await eng(),mapping_id:mid,mapping_version:(await f.rec(mid)).version});return {...f,run,mid,team,eng,body};}
test('partner approval hands off candidates to shared search engagement; assignment preserves sourcing and partner',async()=>{const f=await engagementFixture();const first=await f.eng();assert.equal(first.stage,'Assigned');assert.equal(first.owner_id,undefined);await assert.rejects(f.run(mapper,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']}),/Only the planner/);await assert.rejects(f.run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['mapper']}),/active Engagement/);const assignment=await f.run(partner,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']});assert.deepEqual((await f.rec(assignment.id)).member_ids,['engager']);assert.equal((await f.rec(f.mid)).mapper_id,'mapper');assert.equal(f.db.prepare("SELECT partner_id FROM searches WHERE id='r'").get()?.partner_id,'partner');await assert.rejects(f.run(admin,{id:assignment.id,version:0,action:'engagement-search-assign',role_id:'r',member_ids:[]}),/changed/);await assert.rejects(f.run(admin,{...await f.body(),action:'engagement-assign',owner_id:'engager'}),/Unknown engagement action/);f.db.close();});
test('pipeline movement requires notes, records stage duration, and blocks stale or reopened work',async()=>{const f=await engagementFixture();await f.run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']});const before=await f.body();await assert.rejects(f.run(engActor,{...before,action:'engagement-update',stage_id:'linkedin',notes:''}),/Add a note/);await f.run(engActor,{...before,action:'engagement-update',stage_id:'linkedin',occurred_on:'2026-10-01',notes:'Connection sent'});await assert.rejects(f.run(engActor,{...before,action:'engagement-update',stage_id:'email1',occurred_on:'2026-10-01',notes:'Stale'}),/changed/);const entered=(await f.eng()).stage_at;await f.run(engActor,{...await f.body(),action:'engagement-update',stage_id:'linkedin',occurred_on:'2026-10-01',notes:'Additional note'});assert.equal((await f.eng()).stage_at,entered);await f.run(admin,{...await f.rec(f.mid),action:'mapping-reopen',notes:'Recheck fit'});await assert.rejects(f.run(engActor,{...await f.body(),action:'engagement-update',stage_id:'screening',occurred_on:'2026-10-02',notes:'Blocked'}),/approval is required/);const activities=(await f.state()).research.records.filter(r=>r.kind==='candidate-activity');assert.equal(activities.length,2);const move=activities.find(r=>r.type==='Stage update')!;assert.equal(move.from_stage_id,'assigned');assert.equal(move.to_stage_id,'linkedin');assert.equal(move.days_in_previous_stage,0);assert.ok(move.stage_left_at);f.db.close();});
test('candidate 360 tags, scoped notes and attachments require editing permissions and remain private workspace records',async()=>{const f=await engagementFixture(),cid=(await f.rec(f.mid)).candidate_id,c=await f.rec(cid);await f.run(engActor,{action:'candidate-tags',candidate_id:cid,candidate_version:c.version,tag_values:{expertise:['AI','AI','Cloud']}});assert.deepEqual((await f.rec(cid)).tag_values.expertise,['AI','Cloud']);await assert.rejects(f.run(engActor,{action:'candidate-note',candidate_id:cid,role_id:'r2',type:'Note',occurred_on:'2026-10-01',notes:'Wrong search'}),/not mapped/);await f.run(engActor,{action:'candidate-note',candidate_id:cid,type:'Transcript',occurred_on:'2026-10-01',notes:'Synthetic call transcript'});const transcript=(await f.state()).research.records.find((r:any)=>r.kind==='candidate-activity'&&r.type==='Transcript');assert.deepEqual(transcript.transcript_summary,['Synthetic call transcript']);assert.equal(transcript.summary_method,'source-excerpts-v1');assert.equal(transcript.notes,'Synthetic call transcript');await assert.rejects(f.run({...engActor,role:'founder'},{action:'candidate-note',candidate_id:cid,type:'Note',occurred_on:'2026-10-01',notes:'Forbidden'}),/permission/);const file=await f.run(engActor,{action:'candidate-file-save',candidate_id:cid,name:'synthetic-resume.pdf',category:'Resume',base64:btoa('synthetic document')});const read=await f.run(engActor,{action:'candidate-file-read',candidate_id:cid,file_id:file.id});assert.equal(atob(read.base64),'synthetic document');const assessment=await f.run(engActor,{action:'candidate-file-save',candidate_id:cid,name:'synthetic-assessment.xlsx',category:'Assessment',base64:btoa('synthetic spreadsheet')});const assessmentRead=await f.run(engActor,{action:'candidate-file-read',candidate_id:cid,file_id:assessment.id});assert.equal(atob(assessmentRead.base64),'synthetic spreadsheet');assert.ok(!JSON.stringify(await f.state()).includes(read.base64));await assert.rejects(f.run(engActor,{action:'candidate-file-read',candidate_id:'other',file_id:file.id}),/not found/);await assert.rejects(f.run(engActor,{action:'candidate-file-save',candidate_id:cid,name:'bad.html',category:'Resume',base64:btoa('bad')}),/Upload/);f.db.close();});
test('removing engagement membership blocks stale owner actions and reapproval does not duplicate handoff',async()=>{const f=await engagementFixture();await f.run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']});await assert.rejects(f.w.research(engActor,{...await f.body(),action:'engagement-update',stage:'Contacting',occurred_on:'2026-10-01',notes:'Unauthorized'},members),/not assigned/);await f.run(admin,{...await f.rec(f.mid),action:'mapping-reopen',notes:'Recheck'});await f.run(mapper,{...await f.rec(f.mid),action:'mapping-submit'});await f.run(peer,{...await f.rec(f.mid),action:'mapping-review',decision:'Approve'});await f.run(partner,{...await f.rec(f.mid),action:'mapping-review',decision:'Approve'});assert.equal((await f.state()).research.records.filter(r=>r.kind==='engagement').length,1);assert.equal((await f.eng()).owner_id,undefined);f.db.close();});
test('engagement and candidate 360 screens render synthetic work without real accounts',async()=>{const f=await engagementFixture(),React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{Engagement}=await import('../src/Engagement'),{Candidate360}=await import('../src/Candidate360');const data={...await f.state(),people:[...members,engMember]};const shared={data,api:async()=>({}),reload:async()=>{},onDirty:()=>{},onCandidate:()=>{}};assert.ok(renderToStaticMarkup(React.createElement(Engagement,shared)).includes('Find a search'));assert.ok(renderToStaticMarkup(React.createElement(Candidate360,{...shared,candidate:await f.rec((await f.rec(f.mid)).candidate_id)})).includes('Notes'));f.db.close();});
test('stopping sourcing leaves engagement running; search closure only permits notes and outcomes',async()=>{const f=await engagementFixture();await f.run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']});await f.w.mutate(admin,'decision',{search_id:'r',week:'2026-09-28',disposition:'Stop',version:0});await f.run(engActor,{...await f.body(),action:'engagement-update',stage_id:'linkedin',occurred_on:'2026-10-01',notes:'Contacted after sourcing stopped'});for(const status of ['Closed','Abandoned','Cancelled']){f.db.prepare('UPDATE searches SET status=? WHERE id=?').run(status,'r');await assert.rejects(f.run(engActor,{...await f.body(),action:'engagement-update',stage_id:'email1',occurred_on:'2026-10-04',notes:'Blocked'}),/outreach is stopped/);}await f.run(engActor,{...await f.body(),action:'engagement-update',stage_id:'client-rejected',occurred_on:'2026-10-04',notes:'Recorded closure feedback'});assert.equal((await f.eng()).stage,'Rejected by Client');assert.equal((await f.rec(f.mid)).status,'Approved');f.db.close();});

test('multiple engagement members share all candidates on an assigned search and reassignment revokes prior access',async()=>{const f=await engagementFixture(),second={id:'engager2',role:'engagement',status:'active',name:'Second engagement member'},ms=[...members,engMember,second],run=(a:any,b:any)=>f.w.research(a,b,ms);const assignment=await run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['engager','engager2']});await run(engActor,{...await f.body(),action:'engagement-update',stage_id:'linkedin',occurred_on:'2026-10-01',notes:'First teammate sent connection'});const other={...engActor,id:'engager2'};await run(other,{...await f.body(),action:'engagement-update',stage_id:'email1',occurred_on:'2026-10-01',notes:'Second teammate completed the shared work'});assert.equal((await f.state()).research.records.find(r=>r.kind==='candidate-activity'&&r.to_stage_id==='email1')?.actor_id,'engager2');await run(admin,{...await f.rec(assignment.id),action:'engagement-search-assign',member_ids:['engager2']});await assert.rejects(run(engActor,{...await f.body(),action:'engagement-update',stage_id:'engaged-email',occurred_on:'2026-10-02',notes:'Former assignee'}),/not assigned/);await run(other,{...await f.body(),action:'engagement-update',stage_id:'engaged-email',occurred_on:'2026-10-02',notes:'Current search assignee'});f.db.close();});
test('later partner approvals inherit the existing search assignment without candidate allocation',async()=>{const f=await engagementFixture();await f.run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']});const result=await f.run(mapper,{action:'mapping-add',role_id:'r',target_id:(await f.rec(f.mid)).target_id,items:[{...item,first_name:'Second',url:'https://www.linkedin.com/in/synthetic-second-handoff'}]});const mid=result.ids[0];await f.run(mapper,{...await f.rec(mid),action:'mapping-submit'});await f.run(peer,{...await f.rec(mid),action:'mapping-review',decision:'Approve'});await f.run(partner,{...await f.rec(mid),action:'mapping-review',decision:'Approve'});const e=(await f.state()).research.records.find(r=>r.kind==='engagement'&&r.mapping_id===mid)!;assert.equal(e.owner_id,undefined);await f.run(engActor,{...e,mapping_id:mid,mapping_version:(await f.rec(mid)).version,action:'engagement-update',stage_id:'linkedin',occurred_on:'2026-10-08',notes:'Connection sent'});assert.equal((await f.rec(e.id)).stage_id,'linkedin');assert.equal((await f.eng()).stage,'Assigned');f.db.close();});
test('global pipeline administration enforces role, version, unique stages, occupied-stage preservation and stale movement',async()=>{const {defaultPipeline}=await import('../src/engagement-pipeline');const f=await engagementFixture();await assert.rejects(f.run(partner,{action:'engagement-pipeline-save',stages:defaultPipeline}),/Administrator/);const stages=defaultPipeline.map(s=>({...s,threshold:s.id==='linkedin'?3:0}));const config=await f.run(admin,{action:'engagement-pipeline-save',stages});await assert.rejects(f.run(admin,{action:'engagement-pipeline-save',stages}),/changed/);await f.run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']});await assert.rejects(f.run(engActor,{...await f.body(),action:'engagement-update',stage_id:'linkedin',notes:'Stale config',occurred_on:'2026-10-01'}),/configuration changed/);await f.run(engActor,{...await f.body(),pipeline_version:1,action:'engagement-update',stage_id:'linkedin',notes:'Sent',occurred_on:'2026-10-01'});await assert.rejects(f.run(admin,{...await f.rec(config.id),action:'engagement-pipeline-save',stages:stages.filter(s=>s.id!=='linkedin')}),/Move candidates out/);await assert.rejects(f.run(admin,{...await f.rec(config.id),action:'engagement-pipeline-save',stages:[...stages,stages[3]]}),/unique/);await assert.rejects(f.run(admin,{action:'engagement-sequence-save',role_id:'r',steps:[]}),/Unknown/);await f.run(admin,{...await f.rec(config.id),action:'engagement-pipeline-save',stages:stages.map(s=>s.id==='linkedin'?{...s,label:'LinkedIn invite sent'}:s)});const {engagementRows}=await import('../src/engagement-domain');assert.equal(engagementRows((await f.state()).research.records).find(r=>r.mapping_id===f.mid)?.stage,'LinkedIn invite sent');assert.equal((await f.state()).research.records.find(r=>r.kind==='candidate-activity')?.to_stage,'LinkedIn Connections Sent');f.db.close();});
test('stage age and funnel counts distinguish unknown history, elapsed days, exits and late stage',async()=>{const {stageDays,stageOverdue,isActiveStage,isLateStage,defaultPipeline,resolvedStage}=await import('../src/engagement-pipeline');const now=Date.parse('2026-10-05T12:00:00Z');assert.equal(stageDays({},now),null);assert.equal(stageDays({stage_at:'2026-10-02T12:00:00Z'},now),3);assert.equal(stageOverdue({stage_at:'2026-10-02T12:00:00Z'},{...defaultPipeline[2],threshold:3},now),true);assert.equal(stageOverdue({stage_at:'2026-10-02T12:00:00Z'},defaultPipeline[2],now),false);assert.equal(isActiveStage(defaultPipeline.find(s=>s.id==='warm')!),false);assert.equal(isActiveStage(defaultPipeline.find(s=>s.id==='placed')!),false);assert.equal(isLateStage(defaultPipeline.find(s=>s.id==='recommended')!),true);assert.equal(resolvedStage({stage:'Engaged'},defaultPipeline).label,'Engaged (channel not recorded)');});
test('recommendation date is manual, versioned and independent of stage age and CRM status',async()=>{const f=await engagementFixture();await f.run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']});await assert.rejects(f.run(engActor,{...await f.body(),action:'engagement-update',stage_id:'recommended',occurred_on:'2026-09-30',notes:'Recommended'}),/actual date/);await f.run(engActor,{...await f.body(),action:'engagement-update',stage_id:'recommended',recommended_on:'2026-09-20',occurred_on:'2026-09-30',notes:'Recommendation recorded later'});const before=await f.body(),entered=before.stage_at,status=f.db.prepare("SELECT status FROM searches WHERE id='r'").get()?.status;await f.run(engActor,{...before,action:'engagement-update',recommended_on:'2026-09-19',occurred_on:'2026-09-30',notes:'Corrected actual submission date'});assert.equal((await f.eng()).recommended_on,'2026-09-19');assert.equal((await f.eng()).stage_at,entered);assert.equal(f.db.prepare("SELECT status FROM searches WHERE id='r'").get()?.status,status);assert.ok((await f.state()).research.records.some(r=>r.kind==='candidate-activity'&&r.recommended_on==='2026-09-20'));await assert.rejects(f.run(engActor,{...before,action:'engagement-update',recommended_on:'2026-09-18',occurred_on:'2026-09-30',notes:'Stale correction'}),/changed/);f.db.close();});
test('interviews preserve independent rounds, explicit outcomes, feedback history and stage-clock semantics',async()=>{const f=await engagementFixture();await f.run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']});const one={number:1,status:'Scheduled',outcome:'Pending',date:'2026-09-21',interviewer:'Synthetic interviewer'};await f.run(engActor,{...await f.body(),action:'engagement-interview-save',stage_id:'interviews',recommended_on:'2026-09-19',interview:one,occurred_on:'2026-09-20',notes:'First interview scheduled'});const entered=(await f.eng()).stage_at;await f.run(engActor,{...await f.body(),action:'engagement-interview-save',interview:{...one,status:'Completed'},occurred_on:'2026-09-21',notes:'Waiting for client feedback'});assert.equal((await f.eng()).interviews[0].outcome,'Pending');await f.run(engActor,{...await f.body(),action:'engagement-interview-save',interview:{...one,status:'Completed',outcome:'Progressing',decision_on:'2026-09-22'},occurred_on:'2026-09-22',notes:'Client requested round two'});await f.run(engActor,{...await f.body(),action:'engagement-interview-save',interview:{...one,number:2,date:'2026-09-24'},occurred_on:'2026-09-22',notes:'Second round scheduled'});assert.equal((await f.eng()).interviews.length,2);assert.equal((await f.eng()).interviews[0].outcome,'Progressing');assert.equal((await f.eng()).stage_at,entered);const reject={...one,number:2,status:'Completed',outcome:'Rejected',date:'2026-09-24',decision_on:'2026-09-25'};await assert.rejects(f.run(engActor,{...await f.body(),action:'engagement-interview-save',interview:reject,occurred_on:'2026-09-25',notes:'No fit'}),/exited/);await f.run(engActor,{...await f.body(),action:'engagement-interview-save',stage_id:'client-rejected',interview:reject,occurred_on:'2026-09-25',notes:'Rejected after second round'});const e=await f.eng();assert.equal(e.stage_id,'client-rejected');assert.equal(e.interviews[1].decision_on,'2026-09-25');assert.equal(e.recommended_on,'2026-09-19');assert.equal((await f.state()).research.records.filter(r=>r.kind==='candidate-activity'&&r.interview).length,5);assert.equal((await f.rec(f.mid)).status,'Approved');f.db.close();});
test('interview writes enforce search assignment, dates, optimistic versions and closed searches',async()=>{const f=await engagementFixture(),body={action:'engagement-interview-save',interview:{number:1,status:'Scheduled',outcome:'Pending',date:'2026-09-24'},occurred_on:'2026-09-23',notes:'Scheduled'};await assert.rejects(f.run(engActor,{...await f.body(),...body}),/not assigned/);await f.run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']});await assert.rejects(f.run(engActor,{...await f.body(),...body,interview:{...body.interview,date:''}}),/interview date/);await assert.rejects(f.run(engActor,{...await f.body(),...body,interview:{...body.interview,status:'Completed',outcome:'Progressing'}}),/outcome date/);await assert.rejects(f.run(engActor,{...await f.body(),...body,interview:{...body.interview,number:0}}),/round/);const old=await f.body();await f.run(engActor,{...old,...body});await assert.rejects(f.run(engActor,{...old,...body}),/changed/);f.db.prepare("UPDATE searches SET status='Placed' WHERE id='r'").run();await assert.rejects(f.run(engActor,{...await f.body(),...body}),/closed/);await f.run(engActor,{...await f.body(),action:'engagement-update',stage_id:'placed',occurred_on:'2026-09-30',notes:'Placement confirmed'});assert.equal((await f.eng()).stage_id,'placed');assert.equal((await f.eng()).interviews.length,1);f.db.close();});
test('candidate finder exposes results without selecting a search and normalizes multi-word queries',async()=>{const {candidateMatches,pipelineUsesList,interviewTone}=await import('../src/interviews');assert.equal(pipelineUsesList('Board','',''),true);assert.equal(pipelineUsesList('Board','r','  mohIT '),true);assert.equal(pipelineUsesList('Board','r',''),false);assert.equal(candidateMatches({first_name:'Mohit',last_name:'Surana',company:'Granules India'},'  SURANA   moh '),true);assert.equal(candidateMatches({name:'Mohit Surana'},'wrong'),false);assert.equal(interviewTone({status:'Completed',outcome:'Pending'}),'awaiting');assert.equal(interviewTone({status:'Completed',outcome:'Progressing'}),'progressing');assert.equal(interviewTone({status:'Completed',outcome:'Rejected'}),'rejected');});
test('interview tracker renders client, manual recommendation, dated round outcomes and all-search controls',async()=>{const f=await engagementFixture();await f.run(admin,{...await f.body(),action:'engagement-interview-save',stage_id:'interviews',recommended_on:'2026-09-18',interview:{number:1,status:'Completed',outcome:'Progressing',date:'2026-09-20',decision_on:'2026-09-21',interviewer:'Synthetic interviewer'},occurred_on:'2026-09-21',notes:'Continue'});const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{InterviewTracker}=await import('../src/InterviewTracker');const html=renderToStaticMarkup(React.createElement(InterviewTracker,{data:{...await f.state(),people:[...members,engMember]},api:async()=>{},reload:async()=>{},onDirty:()=>{},onCandidate:()=>{}}));for(const value of ['All clients','Recommended to client','Search status (CRM)','Synthetic interviewer','Progressing','R1','18 Sept 2026','aria-sort','Edit recommendation for'])assert.ok(html.includes(value),value);assert.ok(!html.includes('interview-search-row'));f.db.close();});

test('shared team review permits team members, search partner and super admin, records actual reviewer and retains separate partner stage',async()=>{
 for(const actor of [mapper,peer,partner,{...admin,role:'super_admin'}]){
  const f=fixture(),t=await setup(f),id=await mapping(f,t);await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});const before=await f.rec(id);
  await f.run(actor,{...before,action:'mapping-review',decision:'Approve',notes:'Reviewed evidence'});
  const next=await f.rec(id);assert.equal(next.status,'Partner review');assert.equal(next.peer_reviewed_by,actor.id);assert.equal(next.peer_reviewed_name,members.find(m=>m.id===actor.id)!.name);assert.ok(next.peer_reviewed_at);assert.equal(next.partner_decision,null);
  const event=(await f.state()).research.events.find(e=>e.action==='mapping-review');assert.equal(event?.actor,actor.id);
  await assert.rejects(f.run(peer,{...before,action:'mapping-review',decision:'Approve'}),/changed/);
  if(actor.id!=='partner')await assert.rejects(f.run(actor,{...next,action:'mapping-review',decision:'Approve'}),/another person|Self-review/);
  await f.run(partner,{...next,action:'mapping-review',decision:'Approve'});assert.equal((await f.rec(id)).status,'Approved');f.db.close();
 }
});
test('shared review rejects unrelated partners, engagement-only users, planners and departed members',async()=>{
 const f=fixture(),t=await setup(f),id=await mapping(f,t);await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});
 for(const role of ['partner','engagement','planner','admin']){const actor:any={id:'other',role,tenant:'test',name:'Other',staffId:null};await assert.rejects(f.w.research(actor,{...await f.rec(id),action:'mapping-review',decision:'Approve'},[...members,{...actor,status:'active'}]),/Team review requires/);}
 await assert.rejects(f.w.research(peer,{...await f.rec(id),action:'mapping-review',decision:'Approve'},members.map(m=>m.id==='peer'?{...m,status:'inactive'}:m)),/active workspace/);assert.equal((await f.rec(id)).status,'Peer review');f.db.close();
});

test('Assigned handoff is independent of membership and assigning a search preserves stage age',async()=>{
 const f=await engagementFixture(),first=await f.eng();assert.equal(first.stage_id,'assigned');assert.ok(first.handoff_at);
 await f.run(admin,{action:'engagement-search-assign',role_id:'r',member_ids:['engager']});
 const after=await f.eng();assert.equal(after.stage_at,first.stage_at);assert.equal(after.version,first.version);assert.equal(after.owner_id,undefined);f.db.close();
});
test('pipeline action labels persist and terminal thresholds are disabled on save',async()=>{
 const {defaultPipeline}=await import('../src/engagement-pipeline'),f=await engagementFixture();
 const stages=defaultPipeline.map(s=>({...s,threshold:3,action_label:'Perform '+s.id}));
 const result=await f.run(admin,{action:'engagement-pipeline-save',stages});const config=await f.rec(result.id);
 assert.equal(config.stages.find((s:any)=>s.id==='email1').action_label,'Perform email1');
 assert.equal(config.stages.find((s:any)=>s.id==='placed').threshold,0);assert.equal(config.stages.find((s:any)=>s.id==='withdrawn').threshold,0);
 await assert.rejects(f.run(admin,{...config,action:'engagement-pipeline-save',stages:[{id:'ready',label:'Ready for outreach',group:'Top Funnel',threshold:0},...stages]}),/replaced by Assigned/);f.db.close();
});

test('candidate note section is saved with author and cannot fabricate stage updates',async()=>{
 const f=await engagementFixture(),cid=(await f.rec(f.mid)).candidate_id;
 const body={action:'candidate-note',candidate_id:cid,type:'Transcript',note_group:'Interview notes',notes:'Synthetic screening discussion.',occurred_on:'2026-10-03'};
 const saved=await f.run(engActor,body),note=await f.rec(saved.id);
 assert.equal(note.note_group,'Interview notes');assert.equal(note.actor_id,engActor.id);assert.equal(note.notes,body.notes);
 const simple=await f.run(engActor,{action:'candidate-note',candidate_id:cid,type:'Note',notes:'Simple automatic dated note',actor_id:'forged',created_at:'1999-01-01'});const simpleNote=await f.rec(simple.id);assert.equal(simpleNote.actor_id,engActor.id);assert.notEqual(simpleNote.created_at,'1999-01-01');assert.match(simpleNote.occurred_on,/^\d{4}-\d{2}-\d{2}$/);
 await assert.rejects(f.run(engActor,{...body,note_group:'Stage updates'}),/Stage updates are recorded by the pipeline/);
 const legacy=await f.run(engActor,{...body,type:'Note',note_group:undefined});assert.equal((await f.rec(legacy.id)).note_group,'General notes');
 const interview=await f.run(engActor,{...body,type:'Interview',note_group:'General notes'});assert.equal((await f.rec(interview.id)).note_group,'Interview notes');
 f.db.close();
});

for(const bulk of [false,true])test('assigned partner can map and complete both review stages with separate audit events: '+(bulk?'bulk':'individual'),async()=>{
 const f=fixture(),t=await setup(f),id=await mapping(f,t);
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{ResearchPanel}=await import('../src/ResearchPanel');
 const render=async(actor:any)=>renderToStaticMarkup(React.createElement(ResearchPanel,{data:{...await f.state(),actor,people:members},api:async()=>({}),reload:async()=>{},view:'Search repository',initialRole:'r',onDirty:()=>{}}));
 await f.run(mapper,{...await f.rec(id),action:'mapping-submit'});
 let html=await render(mapper);
 assert.match(html,/<button type="button" class="monitor-icon-action" aria-label="Team review for Synthetic Person"/);
 assert.ok(html.includes('View details'));
 await f.run(mapper,{...await f.rec(id),action:'mapping-review',decision:'Approve'});
 html=await render(partner);
 assert.match(html,/<button type="button" class="monitor-icon-action" aria-label="Partner review for Synthetic Person"/);
 html=await render(peer);
 assert.match(html,/<button type="button" disabled="" class="monitor-icon-action" aria-label="Partner review for Synthetic Person"/);
 await assert.rejects(f.run(peer,{...await f.rec(id),action:'mapping-review',decision:'Approve'}),/assigned to another/);
 f.db.prepare('UPDATE searches SET partner_id=? WHERE id=?').run('mapper','r');
 const selfPartner={...mapper,roles:['researcher','partner']};
 html=await render(selfPartner);
 assert.match(html,/<button type="button" class="monitor-icon-action" aria-label="Partner review for Synthetic Person"/);
 assert.ok(!html.includes('Self-review blocked.'));
 assert.ok(!html.includes('Different partner needed'));
 const before=await f.rec(id),eventCount=(await f.state()).research.events.filter((e:any)=>e.record_id===id).length;
 await assert.rejects(f.run(mapper,{...before,action:'mapping-review',decision:'Approve'}),/Partner permission/);
 await f.run(selfPartner,bulk?{action:'mapping-batch',operation:'mapping-review',items:[{id,version:before.version}],decision:'Approve'}:{...before,action:'mapping-review',decision:'Approve'});
 assert.equal((await f.rec(id)).status,'Approved');
 assert.equal((await f.rec(id)).version,before.version+1);
 assert.equal((await f.state()).research.events.filter((e:any)=>e.record_id===id).length,eventCount+1);
 const journey=(await f.state()).research.records.find((r:any)=>r.kind==='engagement'&&r.mapping_id===id);assert.equal(journey?.stage_id,'assigned');
 const reviews=(await f.state()).research.events.filter((e:any)=>e.record_id===id&&e.action==='mapping-review');
 assert.equal(reviews.length,2);assert.ok(reviews.every((e:any)=>e.actor==='mapper'));
 assert.deepEqual(new Set(reviews.map((e:any)=>e.data.before.status)),new Set(['Peer review','Partner review']));
 await assert.rejects(f.run(selfPartner,{...before,action:'mapping-review',decision:'Approve'}),/changed/);
 html=await render(selfPartner);assert.ok(!html.includes('aria-label="Partner review for Synthetic Person"'));
 f.db.close();
});


test('candidate import permission is server-enforced and all members may add a candidate',async()=>{
 const f=fixture(),body={action:'candidate-import',preview:true,rows:[{first_name:'Synthetic',last_name:'Quality',url:'https://linkedin.com/in/synthetic-quality'}]};
 for(const role of ['admin','planner','founder','researcher','partner','engagement'])await assert.rejects(f.run({...admin,role},body),/permission/);
 for(const role of ['super_admin','data_quality'])assert.equal((await f.run({...admin,role},body)).plan.length,1);
 const c=await f.run({...admin,role:'founder'},{action:'candidate-save',...body.rows[0]});assert.ok(c.id);
 await assert.rejects(f.run({...admin,role:'founder'},{...await f.rec(c.id),action:'candidate-save'}),/read-only/);
 await f.run({...admin,role:'data_quality'},{...await f.rec(c.id),action:'candidate-save',potential_client:true});assert.equal((await f.rec(c.id)).potential_client,true);
 const version=(await f.rec(c.id)).version;
 await f.run({...admin,role:'data_quality'},{action:'candidate-tags',candidate_id:c.id,candidate_version:version,tag_values:{industry:['technology','Technology'],expertise:['Synthetic specialty']}});
 assert.deepEqual((await f.rec(c.id)).tag_values.industry,['Technology']);assert.equal((await f.state()).research.records.filter(r=>r.kind==='candidate-tag-value'&&r.label==='Synthetic specialty').length,1);
 await assert.rejects(f.run({...admin,role:'data_quality'},{action:'candidate-tags',candidate_id:c.id,candidate_version:version,tag_values:{}}),/changed/);
 f.db.close();
});

test('known compensation details are versioned, attributed, independent of tags and permission checked',async()=>{
 const f=await engagementFixture(),cid=(await f.rec(f.mid)).candidate_id,c=await f.rec(cid);
 const body={action:'candidate-compensation',candidate_id:cid,candidate_version:c.version,compensation_details:'Base USD 300k; current total USD 450k; minimum next role USD 500k\nEquity discussed separately.'};
 await assert.rejects(f.run({...engActor,role:'founder'},body),/permission/);
 await f.run(engActor,body);const saved=await f.rec(cid);
 assert.equal(saved.compensation_details,body.compensation_details);assert.equal(saved.compensation_details_by,engActor.id);assert.ok(saved.compensation_details_at);assert.deepEqual(saved.tag_values,c.tag_values);
 await assert.rejects(f.run(engActor,body),/changed/);
 await assert.rejects(f.run(engActor,{...body,candidate_version:saved.version,compensation_details:'x'.repeat(10001)}),/10,000/);
 await f.run(engActor,{...body,candidate_version:saved.version,compensation_details:''});assert.equal((await f.rec(cid)).compensation_details,'');
 assert.ok((await f.state()).research.events.some((e:any)=>e.action==='candidate-compensation'&&e.record_id===cid));
 f.db.close();
});


test('verified locality tags persist through candidate saves and retain version/permission/audit controls',async()=>{
 const f=await engagementFixture(),cid=(await f.rec(f.mid)).candidate_id,c=await f.rec(cid);
 const label='North Caldwell, New Jersey, United States',body={action:'candidate-tags',candidate_id:cid,candidate_version:c.version,tag_values:{geography:[label]}};
 await assert.rejects(f.run(engActor,body),/standardized/);
 await assert.rejects(f.run({...engActor,role:'founder'},{...body,verified_geographies:[label]}),/permission/);
 await f.run(engActor,{...body,verified_geographies:[label]});
 const saved=await f.rec(cid);assert.deepEqual(saved.tag_values.geography,[label]);
 await assert.rejects(f.run(engActor,{...body,verified_geographies:[label]}),/changed/);
 await f.run(engActor,{...body,candidate_version:saved.version});
 assert.deepEqual((await f.rec(cid)).tag_values.geography,[label]);
 assert.ok((await f.state()).research.events.some((e:any)=>e.action==='candidate-tags'&&e.record_id===cid));f.db.close();
});

test('directory assignment links candidates without team membership or changing the plan',async()=>{
 const f=fixture();const c=await f.run(mapper,{action:'candidate-save',first_name:'Directory',last_name:'Person',url:'https://linkedin.com/in/directory-link'});
 f.db.exec("DELETE FROM team_members WHERE staff_id='s'");
 const body={action:'candidate-assign',candidate_ids:[c.id],role_id:'r'};
 const p=await f.run(mapper,{...body,preview:true});const saved=await f.run(mapper,{...body,signature:p.signature});assert.equal(saved.mapped,1);
 const m=(await f.state()).research.records.find(r=>r.kind==='mapping')!;assert.equal(m.team_id,'');assert.equal(m.mapper_id,'mapper');assert.equal(m.status,'Draft');assert.equal((await f.state()).assignments.length,0);
 const again=await f.run(mapper,{...body,preview:true});assert.equal((await f.run(mapper,{...body,signature:again.signature})).mapped,0);
 await assert.rejects(f.run(mapper,{action:'mapping-add',role_id:'r2',team_id:'t',items:[{candidate_id:c.id}]}),/team you belong/);
 await assert.rejects(f.run(mapper,{action:'mapping-link',role_id:'r2',items:[{...item}]}),/existing candidate/);
 const strategy=await f.run(admin,{action:'strategy-save',role_id:'r',content:'Search strategy'});await f.run(admin,{...await f.rec(strategy.id),action:'strategy-approve'});
 await f.run(mapper,{...await f.rec(m.id),action:'mapping-edit',rationale:'Relevant experience'});await f.run(mapper,{...await f.rec(m.id),action:'mapping-submit'});
 await assert.rejects(f.run(peer,{...await f.rec(m.id),action:'mapping-review',decision:'Approve'}),/Team review requires/);
 f.db.exec("INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('plan','r','t','2020-01-01')");
 await f.run(peer,{...await f.rec(m.id),action:'mapping-review',decision:'Approve'});assert.equal((await f.rec(m.id)).status,'Partner review');assert.equal((await f.rec(m.id)).peer_reviewed_by,'peer');
 f.db.close();
});

test('funnel assignments hand work between members while partner retains all-stage authority',async()=>{
 const f=await engagementFixture(),second={id:'engager2',role:'engagement',status:'active',name:'Later funnel member'},ms=[...members,engMember,second],run=(a:any,b:any)=>f.w.research(a,b,ms),other={...engActor,id:'engager2'};
 const assignment=await run(partner,{action:'engagement-search-assign',role_id:'r',group_member_ids:{'Top Funnel':['engager'],Outreach:['engager'],Engaged:['engager2'],Screening:['engager2']}});
 assert.deepEqual((await f.rec(assignment.id)).member_ids,['engager','engager2']);
 await assert.rejects(run(other,{...await f.body(),action:'engagement-update',stage_id:'linkedin',notes:'Wrong funnel',occurred_on:'2026-10-04'}),/not assigned/);
 await run(engActor,{...await f.body(),action:'engagement-update',stage_id:'engaged-email',notes:'Positive response hands off',occurred_on:'2026-10-04'});
 await assert.rejects(run(engActor,{...await f.body(),action:'engagement-update',stage_id:'screening',notes:'Former funnel owner',occurred_on:'2026-10-04'}),/not assigned/);
 await run(other,{...await f.body(),action:'engagement-update',stage_id:'screening',notes:'Screening completed',occurred_on:'2026-10-04'});
 await run(partner,{...await f.body(),action:'engagement-update',stage_id:'shortlist',notes:'Partner across funnels',occurred_on:'2026-10-04'});
 await run(admin,{...await f.body(),action:'engagement-update',stage_id:'engaged-phone',notes:'Admin across funnels',occurred_on:'2026-10-04'});
 await assert.rejects(run(admin,{...await f.rec(assignment.id),action:'engagement-search-assign',group_member_ids:{Wrong:['engager']}}),/valid funnel/);
 await assert.rejects(run(admin,{...await f.rec(assignment.id),action:'engagement-search-assign',group_member_ids:{Outreach:['mapper']}}),/active Engagement/);
 const current=await f.rec(assignment.id);
 await run(admin,{...current,action:'engagement-search-assign',group_member_ids:{Engaged:[]}});
 await assert.rejects(run(other,{...await f.body(),action:'engagement-update',stage_id:'screening',notes:'Unassigned funnel',occurred_on:'2026-10-04'}),/not assigned/);
 await assert.rejects(run(admin,{...current,action:'engagement-search-assign',group_member_ids:{Engaged:['engager2']}}),/changed/);
 f.db.close();
});

test('company taxonomy saves preserve metadata and linked creation rolls back invalid searches',async()=>{
 const f=fixture();const c=await f.run(admin,{action:'company-master',name:'Synthetic Tagged',industries:['Energy'],sector:'Utilities',subsector:'Power',employee_band:'1–500',revenue_band:'Under $1 million',website:'https://example.com'});
 await f.run(admin,{action:'company-master',id:c.id,version:1,name:'Synthetic Updated',sector:'Renewables'});
 const saved=await f.rec(c.id);assert.equal(saved.website,'https://example.com/');assert.equal(saved.employee_band,'1–500');assert.equal(saved.sector,'Renewables');
 const before=(await f.state()).research.records.length;
 await assert.rejects(f.run(admin,{action:'company-master-and-target',name:'Rollback Company',role_id:'missing'}));assert.equal((await f.state()).research.records.length,before);
 const linked=await f.run(admin,{action:'company-master-and-target',name:'Linked Company',role_id:'r',subsector:'Solar'});assert.equal((await f.rec(linked.target.id)).company_id,linked.company.id);assert.equal((await f.rec(linked.company.id)).subsector,'Solar');f.db.close();
});

test('target coverage revisions preserve actuals, enforce permission, zero, reason and versions',async()=>{
 const f=fixture();const t=await f.run(admin,{action:'company-save',role_id:'r',name:'Coverage Company',expected:3});
 await assert.rejects(f.run(mapper,{...await f.rec(t.id),action:'target-coverage',expected:0,notes:'No suitable talent'}),/permission/);
 await assert.rejects(f.run(partner,{...await f.rec(t.id),action:'target-coverage',expected:0}),/Explain/);
 const old=await f.rec(t.id);await f.run(partner,{...old,action:'target-coverage',expected:0,notes:'No suitable talent'});assert.equal((await f.rec(t.id)).expected,0);assert.equal((await f.rec(t.id)).coverage_updated_by,'partner');
 await assert.rejects(f.run(partner,{...old,action:'target-coverage',expected:5,notes:'Revised'}),/changed/);
 assert.ok((await f.state()).research.events.some(e=>e.action==='target-coverage'));f.db.close();
});

test('candidate personal attributes preserve profile data, validate and require current version and permission',async()=>{
 const f=await engagementFixture(),cid=(await f.rec(f.mid)).candidate_id,c=await f.rec(cid);
 const body={action:'candidate-attributes',candidate_id:cid,candidate_version:c.version,age:47,gender:'Male'};
 await assert.rejects(f.run({...engActor,role:'founder'},body),/permission/);
 await f.run(engActor,body);const saved=await f.rec(cid);
 assert.equal(saved.age,47);assert.equal(saved.gender,'Male');assert.equal(saved.name,c.name);assert.equal(saved.attributes_updated_by,engActor.id);
 await assert.rejects(f.run(engActor,body),/changed/);
 for(const age of [-1,121,2.5,'abc'])await assert.rejects(f.run(engActor,{...body,candidate_version:saved.version,age}),/whole number/);
 await assert.rejects(f.run(engActor,{...body,candidate_version:saved.version,gender:'invalid'}),/gender/);
 await f.run(engActor,{...body,candidate_version:saved.version,age:'',gender:''});
 assert.equal((await f.rec(cid)).age,null);assert.equal((await f.rec(cid)).gender,'');
 assert.ok((await f.state()).research.events.some((e:any)=>e.action==='candidate-attributes'&&e.record_id===cid));f.db.close();
});

test('local searches are planner-owned creation with distinct references and audit',async()=>{
 const f=fixture();await assert.rejects(f.w.mutate(mapper,'search',{client:'Synthetic',title:'Local search'}),/permission/);
 await assert.rejects(f.w.mutate(admin,'search',{client:'Synthetic'}),/client and role/);
 const {id}=await f.w.mutate(admin,'search',{client:'Synthetic',title:'Local search',external_id:'108',partner_id:'partner',start_date:'2026-10-04'});
 const search=(await f.state()).searches.find((s:any)=>s.id===id)!;assert.match(search.external_id,/^LOCAL-/);assert.equal(search.status,'Open');assert.equal(search.partner_id,'partner');
 assert.ok(f.db.prepare("SELECT * FROM audit WHERE entity=?").all(id).length);f.db.close();
});
test('draft assignment adds current companies with optional coverage and blocks fit edits until strategy exists',async()=>{
 const f=fixture();const company=await f.run(admin,{action:'company-master',name:'Synthetic Corporation',aliases:['Synthetic Co']});
 const c1=await f.run(mapper,{action:'candidate-save',first_name:'One',last_name:'Synthetic',url:'https://linkedin.com/in/target-one',company:'Synthetic Co'});
 const c2=await f.run(mapper,{action:'candidate-save',first_name:'Two',last_name:'Synthetic',url:'https://linkedin.com/in/target-two',company:'Synthetic Corporation'});
 const c3=await f.run(mapper,{action:'candidate-save',first_name:'Three',last_name:'Synthetic',url:'https://linkedin.com/in/target-three',company:'New Synthetic Company'});
 const b={action:'candidate-assign',role_id:'r',candidate_ids:[c1.id,c2.id,c3.id]};const p=await f.run(mapper,{...b,preview:true});await f.run(mapper,{...b,signature:p.signature});
 const records=(await f.state()).research.records,targets=records.filter(r=>r.kind==='target'),maps=records.filter(r=>r.kind==='mapping');assert.equal(targets.length,2);assert.equal(records.filter(r=>r.kind==='company').length,2);assert.ok(targets.some(t=>t.company_id===company.id));assert.ok(targets.every(t=>t.expected===null&&t.owner_id===''&&t.status==='Not started'));assert.ok(maps.every(m=>m.target_id&&m.status==='Draft'&&m.team_id===''));
 await assert.rejects(f.run(mapper,{...maps[0],action:'mapping-edit',rationale:'Relevant'}),/Create a search strategy/);
 await assert.rejects(f.run(mapper,{...maps[0],action:'mapping-submit'}),/rationale|strategy/i);
 const s=await f.run(admin,{action:'strategy-save',role_id:'r',content:'Search Synthetic Corporation using enterprise sales keywords.',criteria:[]});await f.run(admin,{...await f.rec(s.id),action:'strategy-approve'});
 await f.run(mapper,{...await f.rec(maps[0].id),action:'mapping-edit',rationale:'Relevant experience'});await f.run(mapper,{...await f.rec(maps[0].id),action:'mapping-submit'});assert.equal((await f.rec(maps[0].id)).status,'Peer review');f.db.close();
});
test('clone copies planned targets only, preserves destination targets and rejects stale or unauthorized requests',async()=>{
 const f=fixture(),t=await setup(f);await f.run(admin,{...await f.rec(t),action:'target-coverage',expected:10});await f.run(admin,{...await f.rec(t),action:'company-progress',status:'Completed',notes:'Synthetic completion'});
 await f.run(admin,{action:'company-save',role_id:'r',name:'Zero Synthetic',expected:0,wave:2});await f.run(admin,{action:'company-save',role_id:'r',name:'Unset Synthetic'});
 const source=(await f.state()).research.records.filter(r=>r.kind==='target'&&r.role_id==='r'),body={action:'target-clone',role_id:'r2',source_role_id:'r',source_signature:JSON.stringify(source.map(t=>[t.id,t.version]).sort())};
 await assert.rejects(f.run(mapper,body),/permission/);await assert.rejects(f.run({...partner,id:'other'},body),/permission/);await assert.rejects(f.run(admin,{...body,source_signature:'stale'}),/changed/);await assert.rejects(f.run(admin,{...body,source_role_id:'r2'}),/different/);
 const result=await f.run(partner,body);assert.equal(result.copied,3);assert.equal(result.skipped,0);
 const targets=(await f.state()).research.records.filter(r=>r.kind==='target'&&r.role_id==='r2');assert.deepEqual(targets.map(t=>t.expected).sort(),[0,10,null].sort());assert.equal(targets.find(t=>t.name==='Zero Synthetic')?.wave,2);assert.ok(targets.every(t=>t.status==='Not started'&&!t.owner_id&&!t.team_id&&!t.completed_at));assert.equal((await f.state()).research.records.filter(r=>r.kind==='mapping'&&r.role_id==='r2').length,0);
 await f.run(admin,{...targets[0],action:'target-coverage',expected:42,notes:'Destination choice'});assert.equal((await f.run(admin,body)).skipped,3);assert.equal((await f.rec(targets[0].id)).expected,42);f.db.close();
});
test('batch assignment avoids reading audit history and bounds full record scans per batch',async()=>{
 const f=fixture();const ids:string[]=[];
 for(let i=0;i<105;i++)ids.push((await f.run(mapper,{action:'candidate-save',first_name:'Synthetic',last_name:String(i),url:'https://linkedin.com/in/synthetic-perf-'+i,company:'Synthetic Performance Co'})).id);
 const b={action:'candidate-assign',role_id:'r',candidate_ids:ids},p=await f.run(mapper,{...b,preview:true});let historyReads=0,recordReads=0;
 const original=f.w.rows.bind(f.w);f.w.rows=(q:string,...args:any[])=>{if(/SELECT .*FROM research_events/i.test(q))historyReads++;if(q==='SELECT * FROM research_records')recordReads++;return original(q,...args);};
 const saved=await f.run(mapper,{...b,signature:p.signature});assert.equal(saved.mapped,105);assert.equal(historyReads,0);assert.ok(recordReads<=3,`${recordReads} full scans`);assert.equal((await f.state()).research.records.filter(r=>r.kind==='target').length,1);f.db.close();
});

test('existing unlinked drafts receive targets once without altering approved mappings or company allocations',async()=>{
 const {backfillDraftTargets}=await import('../src/draft-targets');const f=fixture();
 const c=await f.run(mapper,{action:'candidate-save',first_name:'Existing',last_name:'Draft',company:'Existing Synthetic Co',url:'https://linkedin.com/in/existing-draft'});
 for(const [id,status] of [['legacy-draft','Draft'],['legacy-approved','Approved']])f.db.prepare('INSERT INTO research_records VALUES(?,?,?,?,?,1)').run(id,'mapping','r',id,JSON.stringify({candidate_id:c.id,status,company:'Existing Synthetic Co',target_id:'',company_id:'',rationale:'Existing evidence'}));
 assert.equal(backfillDraftTargets(f.w),1);const m=await f.rec('legacy-draft');assert.ok(m.target_id);assert.equal(m.rationale,'Existing evidence');assert.equal(m.version,2);assert.equal((await f.rec('legacy-approved')).target_id,'');assert.equal(backfillDraftTargets(f.w),0);assert.equal((await f.state()).research.records.filter(r=>r.kind==='target').length,1);f.db.close();
});

test('target entry keeps company context and validates ownership and candidate-company conflicts',async()=>{
 const f=fixture(),t=await setup(f);const target=await f.rec(t);
 const b={action:'mapping-inline',role_id:'r',target_id:t,team_id:'t',company_id:target.company_id,company:target.name,first_name:'Popup',last_name:'Synthetic',url:'https://linkedin.com/in/popup-synthetic'};
 const result=await f.run(mapper,b);assert.equal((await f.rec(result.ids[0])).target_id,t);
 await assert.rejects(f.run(peer,{...b,url:'https://linkedin.com/in/popup-other'}),/not assigned/);
 const c=await f.run(mapper,{action:'candidate-save',first_name:'Different',last_name:'Company',company:'Other Synthetic',url:'https://linkedin.com/in/popup-conflict'});await assert.rejects(f.run(mapper,{...b,url:'https://linkedin.com/in/popup-conflict',candidate_version:(await f.rec(c.id)).version}),/different current company/);
 await f.run(mapper,{...await f.rec(t),action:'company-progress',status:'Need help',notes:'Coverage mismatch',coverage_flag:true});const updated=await f.rec(t);assert.equal(updated.coverage_flag,true);assert.equal(updated.status,'Need help');await assert.rejects(f.run(peer,{...updated,action:'company-progress',status:'Completed',notes:'Other researcher'}),/owner or role manager/);f.db.close();
});

test('candidate URL variants reuse a single identity for directory, inline mapping and import',async()=>{
 const f=fixture();const created=await f.run(mapper,{action:'candidate-save',first_name:'Canonical',last_name:'Synthetic',url:'www.linkedin.com/in/canonical-synthetic'});
 for(const url of ['http://linkedin.com/in/CANONICAL-SYNTHETIC/',' linkedin.com /in/canonical- synthetic '])await assert.rejects(f.run(mapper,{action:'candidate-save',first_name:'Canonical',last_name:'Synthetic',url}),/already exists/);
 const candidate=await f.rec(created.id);await f.run(mapper,{action:'mapping-inline',role_id:'r',team_id:'t',first_name:'Wrong',last_name:'Name',url:'linkedin.com/in/CANONICAL-SYNTHETIC ',candidate_version:candidate.version});
 const preview=await f.run({...admin,role:'super_admin'},{action:'candidate-import',preview:true,rows:[{first_name:'Canonical',last_name:'Synthetic',url:'http://linkedin.com/in/canonical-synthetic?trk=example'}]});assert.equal(preview.plan[0].existingId,created.id);
 const records=(await f.state()).research.records;assert.equal(records.filter(r=>r.kind==='candidate').length,1);assert.equal(records.find(r=>r.kind==='mapping')?.candidate_id,created.id);f.db.close();
});

test('any active member can maintain an isolated versioned pitch without changing job description permissions',async()=>{
 const f=fixture(),founder={...admin,id:'founder',role:'founder'},engagement={...admin,id:'engagement',role:'engagement'};
 const roster=[...members,{id:'founder',name:'Founder',role:'founder',status:'active'},{id:'engagement',name:'Engagement',role:'engagement',status:'active'}];
 const run=(a:any,b:any)=>f.w.research(a,b,roster);
 const first=await run(founder,{action:'pitch-save',role_id:'r',content:'Why this opportunity matters'});
 const saved=await f.rec(first.id);assert.equal(saved.kind,'pitch');assert.equal(saved.content,'Why this opportunity matters');assert.equal(saved.updated_by,'founder');
 await assert.rejects(run(engagement,{action:'pitch-save',role_id:'r',content:'Duplicate create'}),/someone else/);
 await run(engagement,{action:'pitch-save',role_id:'r',id:saved.id,version:saved.version,content:'Revised talking points'});
 await assert.rejects(run(founder,{action:'pitch-save',role_id:'r',id:saved.id,version:saved.version,content:'Stale overwrite'}),/changed/);
 const current=await f.rec(saved.id);assert.equal(current.content,'Revised talking points');assert.equal(current.version,saved.version+1);
 await assert.rejects(run(founder,{action:'pitch-save',role_id:'r2',id:current.id,version:current.version,content:'Wrong search'}),/another search/);
 await assert.rejects(f.w.research(founder,{action:'pitch-save',role_id:'r2',content:'Inactive'},roster.map(m=>m.id==='founder'?{...m,status:'revoked'}:m)),/membership/);
 await assert.rejects(run(founder,{action:'brief-save',role_id:'r',content:'Not authorized'}),/read-only/);
 const second=await run(mapper,{action:'pitch-save',role_id:'r2',content:'Separate role pitch'});assert.notEqual(second.id,first.id);
 await assert.rejects(run(mapper,{action:'pitch-save',role_id:'r',id:current.id,version:current.version,content:'x'.repeat(20001)}),/20,000/);
 assert.equal(f.db.prepare("SELECT count(*) n FROM research_events WHERE record_id=? AND action='pitch-save'").get(first.id)?.n,2);
 assert.equal(f.db.prepare('SELECT count(*) n FROM role_publications').get()?.n,0);
 assert.equal((await f.rec(first.id)).content,'Revised talking points');f.db.close();
});
test('fit criteria can be drafted before keyword guidance and retained when guidance is added',async()=>{
 const f=fixture();
 const saved=await f.run(admin,{action:'strategy-save',role_id:'r',content:'',criteria:[{id:'scope',label:'Scope',requirement:'Multiple sites',weight:100}]});
 const draft=await f.rec(saved.id);assert.equal(draft.draft,'');assert.equal(draft.criteria[0].label,'Scope');
 await f.run(admin,{...draft,action:'strategy-save',content:'Operations AND leadership',criteria:draft.criteria});
 const updated=await f.rec(saved.id);assert.equal(updated.draft,'Operations AND leadership');assert.deepEqual(updated.criteria,draft.criteria);
});
