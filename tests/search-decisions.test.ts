import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveDecision,isWorkingDecision,sourcingEvidence} from '../src/search-decisions';
test('decisions carry forward by role without borrowing future decisions or resetting Start',()=>{
 const rows=[{search_id:'r',week:'2026-09-07',disposition:'Start',version:1},{search_id:'r',week:'2026-09-21',disposition:'Pause',version:1},{search_id:'r',week:'2026-10-05',disposition:'Recalibrate',version:1},{search_id:'other',week:'2026-09-28',disposition:'Stop'}];
 assert.equal(effectiveDecision(rows,'r','2026-09-14')?.disposition,'Start');
 assert.equal(effectiveDecision(rows,'r','2026-09-28')?.week,'2026-09-21');
 assert.equal(effectiveDecision(rows,'r','2026-09-01'),undefined);
 assert.equal(effectiveDecision(rows,'r','2026-10-12')?.disposition,'Recalibrate');
 assert.equal(isWorkingDecision(effectiveDecision(rows,'r','2026-09-28')),false);assert.equal(isWorkingDecision(),false);
});
test('decision evidence uses current mappings, independent approval state, and Eastern creation dates for last week',()=>{
 const records=[{kind:'strategy',role_id:'r',cutover:'2026-09-14'},...[
 ['2026-09-21T03:00:00Z','Draft'],['2026-09-22T12:00:00Z','Approved'],['2026-09-28T03:00:00Z','Peer review'],['2026-09-28T12:00:00Z','Partner review']
 ].map(([created_at,status])=>({kind:'mapping',role_id:'r',created_at,status})),{kind:'mapping',role_id:'other',status:'Approved'}];
 assert.deepEqual(sourcingEvidence(records,{id:'r'},'2026-09-28','2026-09-28'),{mapped:4,approved:1,pending:2,lastWeek:2,started:'2026-09-14',weeks:2});
});

test('weekly evidence drilldowns use the same complete cohorts as their counts',async()=>{
 const {evidenceMappings}=await import('../src/search-decisions');
 const records=[
 {id:'draft',kind:'mapping',role_id:'r',status:'Draft',created_at:'2026-09-28T04:00:00Z'},
 {id:'approved',kind:'mapping',role_id:'r',status:'Approved',created_at:'2026-10-05T03:59:59Z'},
 {id:'peer',kind:'mapping',role_id:'r',status:'Peer review',created_at:'2026-10-05T04:00:00Z'},
 {id:'partner',kind:'mapping',role_id:'r',status:'Partner review',created_at:'2026-09-28T03:59:59Z'},
 {id:'other',kind:'mapping',role_id:'other',status:'Approved',created_at:'2026-10-01T12:00:00Z'}];
 const counts=sourcingEvidence(records,{id:'r'},'2026-10-05','2026-10-05');
 for(const group of ['mapped','approved','pending','lastWeek'] as const)assert.equal(evidenceMappings(records,'r','2026-10-05',group).length,counts[group]);
 assert.deepEqual(evidenceMappings(records,'r','2026-10-05','lastWeek').map(r=>r.id),['draft','approved']);
 assert.deepEqual(evidenceMappings(records,'r','2026-10-05','pending').map(r=>r.id),['peer','partner']);
});
