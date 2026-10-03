import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {conversionSchema,startConversion,saveConversionDetails,conversionPreview,applyConversionItem,candidateMatch} from '../src/crm-conversion';
import {researchSchema,researchState,derivedEntries} from '../src/research';
import {engagementRows} from '../src/engagement-domain';
import {crmList,crmCandidateDetails} from '../src/crm-candidates';
const actor:any={id:'admin',role:'admin',tenant:'synthetic'};
function fixture(){const sql=new DatabaseSync(':memory:');sql.exec(researchSchema+conversionSchema+"CREATE TABLE searches(id TEXT PRIMARY KEY);INSERT INTO searches VALUES('job1'),('job2');");const db={rows:(q:string,...p:any[])=>sql.prepare(q).all(...p) as any[],audit:()=>{}};const apply=(id:string,stages:any)=>{sql.exec('BEGIN');try{const r=applyConversionItem(db,actor,id,stages);sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}};return{sql,db,apply};}
const source={candidate:{slug:'candidate1',first_name:'Synthetic',last_name:'Person',email:'candidate@example.test',linkedin:'https://www.linkedin.com/in/synthetic-import',created_on:'2020-01-01T00:00:00Z'},status:{status_id:9,label:'Placed'},stage_date:'2025-02-01T00:00:00Z'};
const details={notes:[{id:7,description:'<p>Historical note</p>',created_by:'8',created_on:'2024-01-02T12:00:00Z',updated_on:'2024-01-02T12:00:00Z',related_to:'candidate1',related_to_type:'candidate',associated_jobs:[]}],history:[{status:{status_id:1,label:'Assigned'},stage_date:'2024-01-01T00:00:00Z',updated_by:'8',remark:'Initial assignment'},{status:{status_id:9,label:'Placed'},stage_date:'2025-02-01T00:00:00Z',updated_by:'8',remark:'Placed'}]};
function stage(f:ReturnType<typeof fixture>,role='job1',row:any=source){const id=startConversion(f.db,actor,role,'crm-'+role,[row],{'8':'Historical Author'});saveConversionDetails(f.db,actor,id,row.candidate.slug,details);return id;}
test('job-scoped conversion preserves stage age, author and dates; repeat imports and shared candidates are idempotent',()=>{
 const f=fixture(),id=stage(f);assert.equal(conversionPreview(f.db,actor,id).status,'Ready');const p=f.apply(id,{'9':'placed'});assert.equal(p.status,'Completed');
 let state=researchState(f.db),mapping=state.records.find(r=>r.kind==='mapping')!,journey=state.records.find(r=>r.kind==='engagement')!,note=state.records.find(r=>r.kind==='candidate-activity'&&r.type==='Note')!;
 assert.equal(mapping.status,'Imported');assert.equal(mapping.partner_decision,undefined);assert.equal(mapping.submitted_at,undefined);assert.equal(journey.stage_at,'2025-02-01T00:00:00.000Z');assert.equal(journey.stage_id,'placed');assert.equal(note.actor_name,'Historical Author');assert.equal(note.occurred_on,'2024-01-02');assert.ok(note.notes.includes('Historical note'));assert.ok(!note.notes.includes('<p>'));assert.equal(engagementRows(state.records)[0].approved,true);
 const before=state.records.length;f.apply(id,{'9':'placed'});assert.equal(researchState(f.db).records.length,before);
 const retry=stage(f);f.apply(retry,{'9':'assigned'});assert.equal(researchState(f.db).records.length,before);assert.equal(engagementRows(researchState(f.db).records)[0].stage_id,'placed');
 const second=stage(f,'job2');f.apply(second,{'9':'placed'});state=researchState(f.db);assert.equal(state.records.filter(r=>r.kind==='candidate').length,1);assert.equal(state.records.filter(r=>r.kind==='mapping').length,2);assert.equal(state.records.filter(r=>r.kind==='candidate-activity'&&r.type==='Note').length,1);f.sql.close();
});
test('unknown stages, missing notes, unauthorized callers and identity conflicts block import without writes',()=>{
 const f=fixture();assert.throws(()=>startConversion(f.db,{...actor,role:'researcher'},'job1','crm-job1',[source]),/permission/);
 const id=startConversion(f.db,actor,'job1','crm-job1',[source]);assert.throws(()=>f.apply(id,{'9':'placed'}),/Finish fetching/);saveConversionDetails(f.db,actor,id,'candidate1',details);assert.throws(()=>f.apply(id,{'9':'missing'}),/Map every/);assert.equal(researchState(f.db).records.length,0);
 assert.ok(candidateMatch(source.candidate,[{id:'a',url:source.candidate.linkedin},{id:'b',email:source.candidate.email}]).conflict);
 assert.equal(candidateMatch({...source.candidate,linkedin:''},[]).profile.url,'');
 f.sql.exec("DELETE FROM searches WHERE id='job1'");assert.throws(()=>f.apply(id,{'9':'placed'}),/no longer exists/);f.sql.close();
});
test('existing local mapping remains unchanged and missing stage date stays unknown for new imported journey',()=>{
 const f=fixture(),id=stage(f,'job1',{...source,stage_date:null});f.apply(id,{'9':'placed'});const state=researchState(f.db);assert.equal(state.records.find(r=>r.kind==='engagement')!.stage_at,null);const m=state.records.find(r=>r.kind==='mapping')!;
 f.db.rows('UPDATE research_records SET data=? WHERE id=?',JSON.stringify({...m,status:'Partner review',source:undefined}),m.id);
 const again=stage(f);f.apply(again,{'9':'assigned'});assert.equal(researchState(f.db).records.find(r=>r.id===m.id)!.status,'Partner review');f.sql.close();
});
test('pagination never forwards tokens off origin or drops candidate scope; upstream failure does not become empty history',async()=>{
 let calls=0;const evil:any=async()=>{calls++;return Response.json({data:[],next_page_url:'https://evil.test/v1/notes/search'});};await assert.rejects(crmList('secret','notes/search',{related_to:'c',related_to_type:'candidate'},evil),/unsafe/);assert.equal(calls,1);
 const unscoped:any=async()=>Response.json({data:[],next_page_url:'https://api.recruitcrm.io/v1/notes/search?page=2'});await assert.rejects(crmList('secret','notes/search',{related_to:'c',related_to_type:'candidate'},unscoped),/unscoped/);
 const fail:any=async()=>new Response('',{status:429});await assert.rejects(crmCandidateDetails('secret','j','c',fail),/rate limit/);
 const foreign:any=async()=>Response.json({data:[{related_to:'other',related_to_type:'candidate'}]});await assert.rejects(crmCandidateDetails('secret','j','c',foreign),/different candidate/);
});
