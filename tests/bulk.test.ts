import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';
import { parseClipboard, gridCount } from '../src/grid';
import type { Actor } from '../src/domain';
// Run the actual workspace methods on SQLite; only the Cloudflare base class is substituted.
registerHooks({resolve(specifier, context, next) {
  if(specifier === 'cloudflare:workers') return {url:'data:text/javascript,export class DurableObject { constructor(ctx,env) {this.ctx=ctx;this.env=env} }',shortCircuit:true};
  return next(specifier,context);
}});
const { Workspace } = await import('../src/workspace');
const actor: Actor = {id:'admin',name:'Test',email:'codex-tests@yiaknolei.resend.app',tenant:'test',role:'admin',staffId:null};
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  const ctx = {storage: {sql: {exec(query:string,...params:any[]) {
    if(!params.length && query.includes('CREATE TABLE')) {db.exec(query); return {toArray:()=>[]};}
    return {toArray:()=>db.prepare(query).all(...params)};
  }}, transactionSync(fn:()=>any) {db.exec('BEGIN');try {const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
  const w = new Workspace(ctx as any, {});
  db.exec("INSERT INTO teams VALUES('t','Blue'); INSERT INTO staff VALUES('s','Researcher'); INSERT INTO searches(id,client,title) VALUES('r','Synthetic','Test role'); INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('a','r','t','2026-09-27'); INSERT INTO entries(id,assignment_id,staff_id) VALUES('e','a','s'); INSERT INTO staff VALUES('s2','Other'); INSERT INTO entries(id,assignment_id,staff_id) VALUES('e2','a','s2');");
  return {db,w,ctx};
}
test('Excel clipboard preserves quoted tabs, newlines and empty cells',()=>{
  assert.deepEqual(parseClipboard('10\t"two\twords"\r\n0\t"line\none"\r\n'),[['10','two\twords'],['0','line\none']]);
  assert.deepEqual(parseClipboard('\t\n'),[['','']]);
  assert.equal(gridCount(''),null); assert.equal(gridCount('0',true),0);
  assert.throws(()=>gridCount('',true)); assert.throws(()=>gridCount('2.5'));
});
test('bulk writes persist all rows and audit each change',async()=>{
  const {db,w}=fixture();
  await w.bulk(actor,[{kind:'entry',id:'e',version:1,mapped:12,notes:'A'},{kind:'entry',id:'e2',version:1,mapped:8,notes:'B'}]);
  assert.equal(db.prepare('SELECT SUM(mapped) n FROM entries').get()?.n,20);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get()?.n,2); db.close();
});
test('stale second row rolls back first row and audit',async()=>{
  const {db,w}=fixture();
  await assert.rejects(w.bulk(actor,[{kind:'entry',id:'e',version:1,mapped:12},{kind:'entry',id:'e2',version:99,mapped:8}]),/No rows were saved/);
  assert.equal(db.prepare("SELECT mapped FROM entries WHERE id='e'").get()?.mapped,null);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get()?.n,0); db.close();
});
test('bulk cannot bypass ownership or planning permissions',async()=>{
  const {db,w}=fixture(); const researcher = {...actor,role:'researcher' as const,staffId:'s'};
  await assert.rejects(w.bulk(researcher,[{kind:'entry',id:'e2',version:1,mapped:5}]),/own sourcing/);
  await assert.rejects(w.bulk(researcher,[{kind:'assignment-edit',id:'a',version:1,target:5}]),/Planning permission/);
  await assert.rejects(w.bulk(actor,[{kind:'entry',id:'foreign-workspace-record',version:1,mapped:5}]),/not found/); db.close();
});
test('review zero is completed, history is retained and output locks',async()=>{
  const {db,w}=fixture();
  await w.bulk(actor,[{kind:'entry',id:'e',version:1,mapped:10}]);
  await w.bulk(actor,[{kind:'review',stage:'peer',id:'e',version:2,approved:0}]);
  await w.bulk(actor,[{kind:'review',stage:'partner',id:'e',version:3,approved:0}]);
  await assert.rejects(w.bulk(actor,[{kind:'entry',id:'e',version:4,mapped:20}]),/reopened/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM reviews').get()?.n,2); db.close();
});
test('targets use assignment versions and duplicate batches are rejected',async()=>{
  const {db,w}=fixture();
  await w.mutate(actor,'decision',{search_id:'r',week:'2026-09-21',disposition:'Continue',version:0});
  await w.bulk(actor,[{kind:'assignment-edit',id:'a',version:1,target:30,notes:'Priority'}]);
  assert.equal(db.prepare("SELECT target FROM assignments WHERE id='a'").get()?.target,30);
  await assert.rejects(w.bulk(actor,[{kind:'assignment-edit',id:'a',version:1,target:20}]),/changed this assignment/);
  await assert.rejects(w.bulk(actor,[{kind:'entry',id:'e',version:1,mapped:5},{kind:'entry',id:'e',version:1,mapped:7}]),/only once/); db.close();
});
test('CRM preview never overwrites searches until applied and stale edits abort',async()=>{
  const {db,w}=fixture();
  db.exec("UPDATE searches SET external_id='1' WHERE id='r'");
  await w.stageCRM(actor,[{external_id:'1',title:'Updated role',status:'On Hold',company_slug:'c',company_name:'CRM Company'}]);
  assert.equal(db.prepare("SELECT title FROM searches WHERE id='r'").get()?.title,'Test role');
  const snapshot=await w.crmState(actor),job=snapshot.jobs[0];
  await assert.rejects(w.applyCRM(actor,[{...job,search_id:'r',version:99}]),/local search changed/);
  await w.applyCRM(actor,[{...job,search_id:'r',version:1}]);
  assert.equal(db.prepare("SELECT title FROM searches WHERE id='r'").get()?.title,'Updated role');
  assert.equal(db.prepare("SELECT client FROM searches WHERE id='r'").get()?.client,'CRM Company');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM entries').get()?.n,2);db.close();
});

test('CRM company names create clients and missing names preserve existing clients',async()=>{
 const {db,w}=fixture();
 await w.stageCRM(actor,[{external_id:'new',title:'New',status:'Open',company_slug:'co',company_name:'Imported Company'}]);
 let job=(await w.crmState(actor)).jobs[0];await w.applyCRM(actor,[job]);
 const search=db.prepare("SELECT * FROM searches WHERE external_id='new'").get()!;
 assert.equal(search.client,'Imported Company');
 await w.stageCRM(actor,[{external_id:'new',title:'New',status:'Closed',company_slug:'co'}]);
 job=(await w.crmState(actor)).jobs[0];await w.applyCRM(actor,[{...job,search_id:search.id,version:search.version}]);
 assert.equal(db.prepare("SELECT client FROM searches WHERE external_id='new'").get()?.client,'Imported Company');
 db.close();
});

const {weekDays,weekStart}=await import('../src/planning');
async function roster(w:any,ids=['s','s2'],version=0) {await w.mutate(actor,'team-members',{id:'t',version,staff_ids:ids});}
async function plan(w:any,overrides:any={}) {
 if(!w.sourcingDecision('r','2026-09-28')) await w.mutate(actor,'decision',{search_id:'r',week:'2026-09-21',disposition:'Continue',version:0,notes:'Synthetic allocation setup'});
 const state=await w.state(actor),week='2026-09-28';
 return {week,search_id:'r',team_id:'t',roster_version:state.teams[0].roster_version,
  days:weekDays(week).map(date=>{const old=state.assignments.find((a:any)=>a.search_id==='r'&&a.team_id==='t'&&a.work_date===date);return {date,id:old?.id,version:old?.version,enabled:!!old,target:old?.target??10,notes:old?.notes||''};}),...overrides};
}
test('seven-day plans include weekends, use team members, and reject duplicate submissions',async()=>{
 const {db,w}=fixture();await roster(w);
 const p=await plan(w);p.days.forEach((d:any)=>d.enabled=true);
 await w.mutate(actor,'week-plan',p);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM assignments WHERE work_date>='2026-09-28'").get()?.n,7);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM entries').get()?.n,16);
 await assert.rejects(w.mutate(actor,'week-plan',p),/plan changed/);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM assignments WHERE work_date>='2026-09-28'").get()?.n,7);
 assert.equal(weekStart('2026-10-04'),'2026-09-28');db.close();
});
test('planning rolls back earlier days and audits when a later day is invalid',async()=>{
 const {db,w}=fixture();await roster(w);const p=await plan(w);p.days.forEach((d:any)=>d.enabled=true);p.days[6].target=-1;
 const audit=db.prepare('SELECT COUNT(*) n FROM audit').get()?.n;
 await assert.rejects(w.mutate(actor,'week-plan',p),/whole number/);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM assignments').get()?.n,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get()?.n,audit);db.close();
});
test('roster changes preserve old assignment members and stale roster writes fail',async()=>{
 const {db,w}=fixture();await roster(w);const p=await plan(w);p.days[0].enabled=true;await w.mutate(actor,'week-plan',p);
 await roster(w,['s2'],1);await assert.rejects(roster(w,['s'],1),/roster changed/);
 await assert.rejects(w.mutate(actor,'week-plan',p),/roster changed/);
 const next=await plan(w);next.days[0].target=20;next.days[1].enabled=true;await w.mutate(actor,'week-plan',next);
 const rows=db.prepare("SELECT a.work_date,COUNT(e.id) n FROM assignments a JOIN entries e ON e.assignment_id=a.id WHERE a.work_date>='2026-09-28' GROUP BY a.id ORDER BY a.work_date").all();
 assert.deepEqual(rows.map(r=>r.n),[2,1]);db.close();
});
test('plans can remove unstarted work but cannot erase recorded zero output',async()=>{
 const {db,w}=fixture();await roster(w);const p=await plan(w);p.days[0].enabled=true;p.days[1].enabled=true;await w.mutate(actor,'week-plan',p);
 const next=await plan(w);const id=next.days[1].id;
 db.prepare('UPDATE entries SET mapped=0 WHERE assignment_id=?').run(id);
 next.days[0].enabled=false;next.days[1].enabled=false;
 await assert.rejects(w.mutate(actor,'week-plan',next),/already been recorded/);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM assignments WHERE work_date>='2026-09-28'").get()?.n,2);
 next.days[1].enabled=true;await w.mutate(actor,'week-plan',next);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM assignments WHERE work_date>='2026-09-28'").get()?.n,1);db.close();
});
test('weekly priorities update one current record, retain history, and reject stale writes',async()=>{
 const {db,w}=fixture();const p={search_id:'r',week:'2026-09-30',disposition:'Start',version:0,notes:'Initial'};
 await w.mutate(actor,'decision',p);await assert.rejects(w.mutate(actor,'decision',p),/already exists/);
 await w.mutate(actor,'decision',{...p,week:'2026-10-04',version:1,disposition:'Pause'});
 const rows=db.prepare('SELECT * FROM weekly_priorities').all();assert.equal(rows.length,1);assert.equal(rows[0].week,'2026-09-28');assert.equal(rows[0].disposition,'Pause');assert.equal(rows[0].version,2);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM weekly_decisions').get()?.n,2);db.close();
});
test('planning and team management enforce permissions and reject unknown records',async()=>{
 const {db,w}=fixture();await roster(w);const p=await plan(w);p.days[0].enabled=true;
 await assert.rejects(w.mutate({...actor,role:'researcher'},'week-plan',p),/permission/);
 await assert.rejects(w.mutate({...actor,role:'researcher'},'team-members',{id:'t',version:1,staff_ids:['s']}),/permission/);
 await assert.rejects(w.mutate(actor,'week-plan',{...p,team_id:'foreign'}),/existing search and team/);
 await assert.rejects(w.mutate(actor,'team-members',{id:'t',version:1,staff_ids:['foreign']}),/Unknown researcher/);
 await assert.rejects(w.mutate(actor,'week-plan',{...p,days:p.days.slice(1)}),/seven days/);db.close();
});
test('role partner edits use versions and do not change daily assignments',async()=>{
 const {db,w}=fixture();await w.mutate(actor,'search-owner',{id:'r',version:1,partner_id:'synthetic-partner',partner:'Synthetic Partner'});
 assert.equal(db.prepare("SELECT partner FROM searches WHERE id='r'").get()?.partner,'Synthetic Partner');
 await assert.rejects(w.mutate(actor,'search-owner',{id:'r',version:1,partner_id:''}),/search changed/);
 assert.equal(db.prepare("SELECT partner FROM assignments WHERE id='a'").get()?.partner,null);db.close();
});

test('legacy duplicate decisions migrate to one current weekly priority without deleting history',async()=>{
 const {db,ctx}=fixture();
 db.exec("DELETE FROM settings WHERE key='planning_v2'; INSERT INTO weekly_decisions VALUES('d1','r','2026-09-28','Start','First','admin','2026-09-28T00:00:00Z'); INSERT INTO weekly_decisions VALUES('d2','r','2026-09-28','Continue','Latest','admin','2026-09-28T01:00:00Z'); INSERT INTO weekly_decisions VALUES('d3','r','2026-09-30','Pause','Wednesday','admin','2026-09-28T02:00:00Z');");
 const w=new Workspace(ctx as any,{});
 const state=await w.state(actor);assert.equal(state.priorities.length,1);assert.equal(state.priorities[0].disposition,'Pause');assert.equal(state.priorities[0].week,'2026-09-28');assert.equal(state.decisions.length,3);
 await w.mutate(actor,'decision',{search_id:'r',week:'2026-09-28',disposition:'Continue',version:1});
 const again=new Workspace(ctx as any,{});assert.equal((await again.state(actor)).priorities[0].version,2);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM assignments').get()?.n,1);db.close();
});

test('CRM imports save explicit engagement partners and preserve ownership on ordinary refresh',async()=>{
 const {db,w}=fixture();await w.stageCRM(actor,[{external_id:'99',title:'Role',status:'Open',company_slug:'co',company_name:'Company'}]);
 const job=(await w.crmState(actor)).jobs[0];await w.applyCRM(actor,[{...job,partner_id:'p',partner:'Partner One'}]);
 let search=db.prepare("SELECT * FROM searches WHERE external_id='99'").get()!;
 assert.equal(search.partner_id,'p');assert.equal(search.partner,'Partner One');
 await w.applyCRM(actor,[{...job,search_id:search.id,version:search.version,partner:'Injected name without ID'}]);
 search=db.prepare("SELECT * FROM searches WHERE external_id='99'").get()!;assert.equal(search.partner,'Partner One');
 await w.applyCRM(actor,[{...job,search_id:search.id,version:search.version,partner_id:'',partner:''}]);
 assert.equal(db.prepare("SELECT partner FROM searches WHERE external_id='99'").get()?.partner,'');db.close();
});

test('researcher edits preserve references, enforce versions and audit atomically',async()=>{
 const {db,w}=fixture();await roster(w);
 await w.mutate(actor,'staff-edit',{id:'s',version:0,name:'Corrected Researcher',email:'NEW@example.com'});
 const state=await w.state(actor),person=state.staff.find((s:any)=>s.id==='s');
 assert.equal(person?.name,'Corrected Researcher');assert.equal(person?.email,'new@example.com');assert.equal(person?.version,1);
 assert.equal(state.entries[0].staff_id,'s');assert.ok(state.team_members.some((m:any)=>m.staff_id==='s'));
 await assert.rejects(w.mutate(actor,'staff-edit',{id:'s',version:0,name:'Stale',email:''}),/changed/);
 await assert.rejects(w.mutate(actor,'staff-edit',{id:'s',version:1,name:'Other',email:''}),/already/);
 await assert.rejects(w.mutate({...actor,role:'researcher'},'staff-edit',{id:'s',version:1,name:'No',email:''}),/Administrator/);
 await assert.rejects(w.mutate(actor,'staff-edit',{id:'foreign',version:0,name:'No',email:''}),/not found/);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM audit WHERE action='staff-edit'").get()?.n,1);
 assert.ok(!JSON.stringify((await w.state({...actor,role:'researcher'})).staff).includes('new@example.com'));db.close();
});
test('archive removes future roster membership, bumps roster versions, preserves work and supports restore',async()=>{
 const {db,w}=fixture();await roster(w);
 await w.mutate(actor,'staff-archive',{id:'s',version:0,archived:true});
 let state=await w.state(actor);assert.equal(state.staff.find((s:any)=>s.id==='s')?.archived,1);assert.equal(state.entries.length,2);assert.equal(state.teams[0].roster_version,2);assert.ok(!state.team_members.some((m:any)=>m.staff_id==='s'));
 await assert.rejects(w.mutate(actor,'team-members',{id:'t',version:2,staff_ids:['s']}),/active researcher/);
 await assert.rejects(w.mutate(actor,'team-members',{id:'t',version:1,staff_ids:['s2']}),/roster changed/);
 await w.mutate(actor,'staff-archive',{id:'s',version:1,archived:false});state=await w.state(actor);assert.equal(state.staff.find((s:any)=>s.id==='s')?.archived,0);assert.equal(state.entries.length,2);db.close();
});

test('planners can maintain teams without gaining people administration',async()=>{
 const {db,w}=fixture(),planner={...actor,role:'planner' as const};await w.mutate(planner,'team-members',{id:'t',version:0,staff_ids:['s']});
 const added=await w.mutate(planner,'team',{name:'New planning team'});assert.ok(added.id);
 await assert.rejects(w.mutate(planner,'staff',{name:'Unauthorized person'}),/permission/);
 await assert.rejects(w.mutate(planner,'staff-edit',{id:'s',version:0,name:'Changed'}),/permission/);db.close();
});

function transferFixture(){const f=fixture();f.db.exec("INSERT INTO weekly_priorities(search_id,week,disposition,notes) VALUES('r','2026-09-21','Continue','Synthetic setup'); INSERT INTO teams VALUES('red','Red'); INSERT INTO team_members(team_id,staff_id) VALUES('red','s2'); INSERT INTO assignments(id,search_id,team_id,work_date,target,notes) VALUES('b','r','t','2026-09-26',12,'Keep target'); INSERT INTO entries(id,assignment_id,staff_id) VALUES('eb','b','s');");return f;}
const transferBody={operation:'move',week:'2026-09-21',search_id:'r',team_id:'t',destination_team_id:'red',roster_version:0,items:[{id:'a',version:1},{id:'b',version:1}]};
test('weekly move preserves targets and notes, replaces blank roster and audits each day',async()=>{const {db,w}=transferFixture();await w.mutate(actor,'plan-transfer',transferBody);const rows=db.prepare('SELECT * FROM assignments ORDER BY id').all();assert.ok(rows.every(r=>r.team_id==='red'&&r.version===2));assert.equal(rows[1].target,12);assert.equal(rows[1].notes,'Keep target');assert.deepEqual(db.prepare('SELECT staff_id FROM entries').all().map(r=>r.staff_id),['s2','s2']);assert.equal(db.prepare("SELECT COUNT(*) n FROM audit WHERE action='plan-move'").get()?.n,2);db.close();});
test('weekly unassign only removes selected unstarted days',async()=>{const {db,w}=transferFixture();await w.mutate(actor,'plan-transfer',{...transferBody,operation:'unassign',items:[{id:'b',version:1}]});assert.equal(db.prepare('SELECT id FROM assignments').get()?.id,'a');assert.equal(db.prepare("SELECT COUNT(*) n FROM entries WHERE assignment_id='a'").get()?.n,2);db.close();});
test('weekly transfer rolls back all days on recorded zero, stale version or destination collision',async()=>{for(const failure of ['zero','version','collision']){const {db,w}=transferFixture();const body=structuredClone(transferBody);if(failure==='zero')db.exec("UPDATE entries SET mapped=0 WHERE id='eb'");if(failure==='version')body.items[1].version=9;if(failure==='collision')db.exec("INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('conflict','r','red','2026-09-26')");await assert.rejects(w.mutate(actor,'plan-transfer',body));assert.equal(db.prepare("SELECT team_id FROM assignments WHERE id='a'").get()?.team_id,'t');assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get()?.n,0);db.close();}});
test('weekly transfer checks permissions and destination roster version',async()=>{const {db,w}=transferFixture();await assert.rejects(w.mutate({...actor,role:'researcher'},'plan-transfer',transferBody),/permission/);await assert.rejects(w.mutate(actor,'plan-transfer',{...transferBody,roster_version:99}),/roster changed/);assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get()?.n,0);db.close();});

test('weekly plans select individual researchers and protect recorded allocations',async()=>{
 const {db,w}=fixture();await roster(w);const p=await plan(w);p.days[0].enabled=true;p.days[0].staff_ids=['s'];await w.mutate(actor,'week-plan',p);let next=await plan(w);const id=next.days[0].id;assert.deepEqual(db.prepare('SELECT staff_id FROM entries WHERE assignment_id=?').all(id).map(r=>r.staff_id),['s']);
 next.days[0].staff_ids=['s2'];await w.mutate(actor,'week-plan',next);assert.deepEqual(db.prepare('SELECT staff_id FROM entries WHERE assignment_id=?').all(id).map(r=>r.staff_id),['s2']);
 next=await plan(w);next.days[0].staff_ids=['foreign'];await assert.rejects(w.mutate(actor,'week-plan',next),/selected team/);
 db.prepare('UPDATE entries SET mapped=0 WHERE assignment_id=?').run(id);next.days[0].staff_ids=['s'];await assert.rejects(w.mutate(actor,'week-plan',next),/Recorded work/);assert.deepEqual(db.prepare('SELECT staff_id FROM entries WHERE assignment_id=?').all(id).map(r=>r.staff_id),['s2']);db.close();
});

test('saved CRM engagement partners do not activate a role and survive preview refresh',async()=>{
 const {db,w}=fixture();const job={external_id:'new-job',title:'New role',status:'Open',company_slug:'co',company_name:'Synthetic'};
 await w.stageCRM(actor,[job]);
 await w.mutate(actor,'crm-owner',{external_id:'new-job',version:0,partner_id:'partner',partner:'Partner'});
 assert.equal(db.prepare("SELECT count(*) n FROM searches WHERE external_id='new-job'").get()?.n,0);
 await w.stageCRM(actor,[{...job,status:'Closed'}]);
 const saved=(await w.crmState(actor)).jobs[0];assert.equal(saved.saved_partner_id,'partner');assert.equal(saved.partner_version,1);
 await assert.rejects(w.mutate(actor,'crm-owner',{external_id:'new-job',version:0,partner_id:''}),/changed/);
 await assert.rejects(w.mutate({...actor,role:'researcher'},'crm-owner',{external_id:'new-job',version:1,partner_id:''}),/permission/);
 await assert.rejects(w.applyCRM(actor,[{...saved,partner_version:0}]),/saved partner changed/);
 await w.applyCRM(actor,[{...saved,partner_version:1}]);
 const imported=db.prepare("SELECT * FROM searches WHERE external_id='new-job'").get()!;assert.equal(imported.partner_id,'partner');assert.equal(imported.status,'Closed');
 await w.stageCRM(actor,[{...job,status:'Abandoned'}]);assert.equal((await w.state(actor)).searches.find(s=>s.external_id==='new-job')?.status,'Abandoned');
 await assert.rejects(w.mutate(actor,'crm-owner',{external_id:'new-job',version:1,partner_id:''}),/now in the repository/);
 db.close();
});
test('mistaken empty roles can be removed with version and permission checks; research and planning history are protected',async()=>{
 const {db,w}=fixture();db.exec("INSERT INTO searches(id,external_id,client,title,partner_id,partner) VALUES('empty','crm-empty','Synthetic','Mistake','p','Partner')");
 await assert.rejects(w.mutate({...actor,role:'researcher'},'search-remove',{id:'empty',version:1}),/permission/);
 await assert.rejects(w.mutate(actor,'search-remove',{id:'empty',version:2}),/changed/);
 await assert.rejects(w.mutate(actor,'search-remove',{id:'r',version:1}),/history/);
 await w.mutate(actor,'search-remove',{id:'empty',version:1});
 assert.equal(db.prepare("SELECT * FROM searches WHERE id='empty'").get(),undefined);
 assert.equal(db.prepare("SELECT partner_id FROM crm_partners WHERE external_id='crm-empty'").get()?.partner_id,'p');
 assert.equal(db.prepare("SELECT count(*) n FROM audit WHERE action='search-remove'").get()?.n,1);
 db.exec("INSERT INTO searches(id,client,title) VALUES('research','Synthetic','History');INSERT INTO research_records(id,kind,role_id,record_key,data) VALUES('doc','brief','research','brief:research','{}')");
 await assert.rejects(w.mutate(actor,'search-remove',{id:'research',version:1}),/history/);db.close();
});

test('carried Pause/Stop block new work and moves; decision changes preserve existing completed work',async()=>{
 const {db,w}=fixture();await roster(w);let p=await plan(w);p.days[0].enabled=true;await w.mutate(actor,'week-plan',p);
 const existing=db.prepare("SELECT * FROM assignments WHERE work_date='2026-09-28'").get()!;
 db.prepare('UPDATE entries SET mapped=0 WHERE assignment_id=?').run(existing.id);
 await w.mutate(actor,'decision',{search_id:'r',week:'2026-09-28',disposition:'Pause',version:0});
 assert.equal(db.prepare('SELECT id FROM assignments WHERE id=?').get(existing.id)?.id,existing.id);
 p=await plan(w);p.days[1].enabled=true;await assert.rejects(w.mutate(actor,'week-plan',p),/Search Decisions/);
 assert.equal(db.prepare("SELECT count(*) n FROM assignments WHERE work_date='2026-09-29'").get()?.n,0);
 await assert.rejects(w.mutate(actor,'assignment',{search_id:'r',team_id:'t',work_date:'2026-10-06',target:2,staff_ids:['s']}),/Search Decisions/);
 await w.mutate(actor,'decision',{search_id:'r',week:'2026-10-05',disposition:'Recalibrate',version:0});
 await w.mutate(actor,'assignment',{search_id:'r',team_id:'t',work_date:'2026-10-06',target:2,staff_ids:['s']});
 await w.mutate(actor,'decision',{search_id:'r',week:'2026-10-05',disposition:'Stop',version:1});
 db.close();
 const f=transferFixture();await f.w.mutate(actor,'decision',{search_id:'r',week:'2026-09-21',disposition:'Stop',version:1});
 await assert.rejects(f.w.mutate(actor,'plan-transfer',transferBody),/Search Decisions/);
 await f.w.mutate(actor,'plan-transfer',{...transferBody,operation:'unassign'});assert.equal(f.db.prepare('SELECT count(*) n FROM assignments').get()?.n,0);f.db.close();
});
test('undecided roles cannot be allocated and stale carried decisions cannot be overwritten',async()=>{
 const {db,w}=fixture();await assert.rejects(w.mutate(actor,'assignment',{search_id:'r',team_id:'t',work_date:'2026-10-01',target:3,staff_ids:[]}),/Search Decisions/);
 await w.mutate(actor,'decision',{search_id:'r',week:'2026-09-21',disposition:'Start',version:0});
 await w.mutate(actor,'decision',{search_id:'r',week:'2026-09-21',disposition:'Pause',version:1});
 await assert.rejects(w.mutate(actor,'decision',{search_id:'r',week:'2026-09-28',disposition:'Continue',version:0,base_week:'2026-09-21',base_version:1}),/carried decision changed/);
 assert.equal(w.sourcingDecision('r','2026-10-01').disposition,'Pause');assert.equal(db.prepare("SELECT count(*) n FROM weekly_priorities WHERE week='2026-09-28'").get()?.n,0);db.close();
});

test('confirmed effort includes zero-output days, splits days and audits corrections atomically',async()=>{
 const {db,w}=fixture();db.exec("INSERT INTO searches(id,client,title) VALUES('r2','Synthetic','Second role')");
 await w.mutate(actor,'effort',{staff_id:'s',work_date:'2026-09-27',version:0,items:[{search_id:'r',team_id:'t',days:.5},{search_id:'r2',team_id:'t',days:.5}]});
 let state=await w.state(actor);assert.equal(state.effort.reduce((n,r)=>n+r.days,0),1);assert.equal(state.effortDays[0].version,1);
 assert.equal(state.assignments[0].has_work,true);
 await assert.rejects(w.mutate(actor,'plan-transfer',{operation:'unassign',search_id:'r',team_id:'t',week:'2026-09-21',items:[{id:'a',version:1}]}),/Work is recorded/);
 await assert.rejects(w.mutate(actor,'week-plan',{search_id:'r',team_id:'t',week:'2026-09-21',roster_version:0,days:weekDays('2026-09-21').map(date=>({date,enabled:false,...(date==='2026-09-27'?{id:'a',version:1}:{})}))}),/Confirmed effort/);
 await assert.rejects(w.mutate(actor,'effort',{staff_id:'s',work_date:'2026-09-27',version:1,items:[{search_id:'r',team_id:'t',days:.75},{search_id:'r2',team_id:'t',days:.5}]}),/cannot exceed/);
 assert.equal((await w.state(actor)).effortDays[0].version,1);
 await assert.rejects(w.mutate(actor,'effort',{staff_id:'s',work_date:'2026-09-27',version:0,items:[{search_id:'r',team_id:'t',days:1}]}),/changed/);
 await w.mutate(actor,'effort',{staff_id:'s',work_date:'2026-09-27',version:1,items:[{search_id:'r',team_id:'t',days:0},{search_id:'r2',team_id:'t',days:1}]});
 assert.equal(db.prepare("SELECT count(*) n FROM audit WHERE action='effort-confirm'").get()?.n,2);
 assert.equal((await w.state(actor)).effortDays[0].version,2);db.close();
});
test('effort checks identity, scope, future dates, unknown references and duplicates',async()=>{
 const {db,w}=fixture();const researcher={...actor,id:'researcher',role:'researcher' as const,staffId:'s'},body={staff_id:'s',work_date:'2026-09-27',version:0,items:[{search_id:'r',team_id:'t',days:1}]};
 await assert.rejects(w.mutate(researcher,'effort',{...body,staff_id:'s2'}),/own effort/);
 await assert.rejects(w.mutate({...researcher,role:'partner'},'effort',body),/own effort/);
 await assert.rejects(w.mutate(actor,'effort',{...body,work_date:'2099-01-01'}),/past date/);
 await assert.rejects(w.mutate(actor,'effort',{...body,items:[{search_id:'foreign',team_id:'t',days:1}]}),/not found/);
 await assert.rejects(w.mutate(actor,'effort',{...body,items:[...body.items,...body.items]}),/only once/);
 await assert.rejects(w.mutate(actor,'effort',{...body,items:[{...body.items[0],days:.123}]}),/two decimals/);
 db.exec("INSERT INTO searches(id,client,title) VALUES('unassigned','Synthetic','Unassigned')");
 await assert.rejects(w.mutate(researcher,'effort',{...body,items:[{search_id:'unassigned',team_id:'t',days:1}]}),/assigned search/);
 await w.mutate(researcher,'effort',body);assert.equal((await w.state(actor)).effort[0].days,1);db.close();
});

test('PTO is versioned, audited and limited to self or planner',async()=>{
 const {db,w}=fixture(),researcher={...actor,id:'self',role:'researcher' as const,staffId:'s'},body={staff_id:'s',work_date:'2026-09-27',pto:true,version:0};
 await assert.rejects(w.mutate(researcher,'pto',{...body,staff_id:'s2'}),/own PTO/);
 await assert.rejects(w.mutate({...researcher,role:'partner'},'pto',body),/own PTO/);
 await assert.rejects(w.mutate(actor,'pto',{...body,staff_id:'foreign'}),/active researcher/);
 await w.mutate(researcher,'pto',body);assert.equal((await w.state(actor)).timeOff[0].pto,1);
 await assert.rejects(w.mutate(actor,'pto',{...body,pto:false}),/changed/);
 await w.mutate(actor,'pto',{...body,pto:false,version:1});assert.equal((await w.state(actor)).timeOff[0].pto,0);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM audit WHERE action='pto'").get()?.n,2);db.close();
});

test('full workspace reset atomically archives data, clears dependencies and CRM selections, retains audit',async()=>{
 const {db,w}=fixture();const owner={...actor,roles:['super_admin'] as any};
 db.exec("INSERT INTO reviews VALUES('review','e','peer',2,'admin','2026-09-29','test'); INSERT INTO team_members VALUES('t','s'); INSERT INTO team_rosters VALUES('t',1); INSERT INTO crm_partners VALUES('crm','partner','Partner',1); INSERT INTO time_off VALUES('s','2026-09-29',1,1); INSERT INTO effort_records VALUES('s','2026-09-29','r','t',1); INSERT INTO research_records VALUES('candidate','candidate','','candidate','{}',1);");
 w.audit(owner,'test','e',null,{test:true});
 const preview=await w.previewReset(owner);assert.equal(preview.counts.searches,1);
 const result=await w.resetWorkspace(owner,{signature:preview.signature},{keep:{id:owner.id},members:[{id:owner.id}]});
 for(const table of ['searches','teams','staff','entries','assignments','reviews','crm_partners','time_off','effort_records','research_records'])assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get()?.n,0,table);
 const backup=await w.resetBackup(owner,result.backupId);assert.equal(backup.tables.entries.length,2);assert.equal(backup.tables.reviews.length,1);assert.equal(backup.tables.crm_partners.length,1);assert.equal(backup.people.keep.id,owner.id);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get()?.n,2);
 assert.equal((await w.resetBackups(owner)).length,1);db.close();
});
test('reset rejects ordinary admins and stale snapshots without clearing or backing up',async()=>{
 const {db,w}=fixture();const owner={...actor,roles:['super_admin'] as any};
 await assert.rejects(w.previewReset(actor),/permission/);
 const preview=await w.previewReset(owner);db.exec("UPDATE searches SET title='Changed' WHERE id='r'");
 await assert.rejects(w.resetWorkspace(owner,{signature:preview.signature},{}),/Workspace changed/);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM entries').get()?.n,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM reset_backups').get()?.n,0);db.close();
});
test('reset rolls back deletions and snapshot when a dependency prevents deletion',async()=>{
 const {db,w}=fixture();const owner={...actor,roles:['super_admin'] as any};
 db.exec("CREATE TABLE future_dependency(id TEXT REFERENCES searches(id)); INSERT INTO future_dependency VALUES('r')");
 const preview=await w.previewReset(owner);
 await assert.rejects(w.resetWorkspace(owner,{signature:preview.signature},{}),/FOREIGN KEY/);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM entries').get()?.n,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM reset_backups').get()?.n,0);db.close();
});

test('clean baseline refuses operational data and then saves an immutable non-destructive owner checkpoint',async()=>{
 const {db,w}=fixture();const owner={...actor,roles:['super_admin'] as any},people={keep:{id:actor.id},remove:[],invitations:0,members:[{id:actor.id,staff_id:'s'}]};
 await assert.rejects(w.saveCleanBaseline(owner,people),/operational data/);
 const preview=await w.previewReset(owner);await w.resetWorkspace(owner,{signature:preview.signature},people);
 db.exec("INSERT INTO staff VALUES('s','Owner')");
 const saved=await w.saveCleanBaseline(owner,people);const backup=await w.resetBackup(owner,saved.baselineId);
 assert.equal(backup.label,'Clean baseline');assert.equal(backup.counts.searches,0);assert.equal(backup.tables.staff[0].id,'s');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM staff').get()?.n,1);
 assert.equal((await w.saveCleanBaseline(owner,people)).baselineId,saved.baselineId);
 await assert.rejects(w.saveCleanBaseline(actor,people),/permission/);db.close();
});
