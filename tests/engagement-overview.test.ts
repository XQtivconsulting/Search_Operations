import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {engagementOverviewRows,engagementBuckets,engagementCounts,engagementSearchScope,groupEngagementRows,matchesEngagementBucket} from '../src/engagement-overview';
import {normalizeEngagementVisit,visitKey,emptyHistory,recordVisit,travelHistory} from '../src/navigation-history';
import {defaultPipeline} from '../src/engagement-pipeline';
import {EngagementSearchWorkspace} from '../src/EngagementSearchWorkspace';
import {ViewStateProvider} from '../src/ViewState';
type R=Record<string,any>;
const now=Date.parse('2026-10-08T14:00:00Z');
const searches=[{id:'s1',search_number:101,title:'First Search',client:'Example A',status:'Open',partner_id:'partner'}, {id:'s2',search_number:102,title:'Second Search',client:'Example B',status:'Open'}, {id:'s3',search_number:103,title:'Closed Search',client:'Example C',status:'Closed'}];
const records:R[]=[{kind:'engagement-pipeline',stages:defaultPipeline.map(s=>({...s,threshold:2}))},
 {kind:'engagement-assignment',role_id:'s1',member_ids:['worker']},
 {kind:'engagement-assignment',role_id:'s2',group_member_ids:{Outreach:['other'],Screening:['worker']}}];
function add(id:string,role:string,status:string,stage:string,start:string|null,extra:R={}){
 records.push({kind:'candidate',id:'c'+id,name:'Example '+id}, {kind:'mapping',id,role_id:role,candidate_id:'c'+id,status,version:3});
 if(stage)records.push({kind:'engagement',id:'e'+id,mapping_id:id,role_id:role,candidate_id:'c'+id,stage_id:stage,stage_at:start,handoff_at:start,version:5,...extra});
}
add('overdue','s1','Approved','linkedin','2026-10-01T14:00:00Z');
add('due','s2','Approved','linkedin','2026-10-06T14:00:00Z');
add('new','s1','Approved','assigned','2026-10-08T14:00:00Z');
add('unknown','s2','Approved','assigned',null);
add('pending','s1','Partner review','',null);
add('draft','s1','Draft','',null);
add('paused','s1','Partner review','linkedin','2026-10-01T14:00:00Z');
add('placed','s3','Approved','placed','2026-10-01T14:00:00Z');
add('closed','s3','Approved','linkedin','2026-10-01T14:00:00Z');
add('exited','s1','Approved','unresponsive','2026-10-01T14:00:00Z');
// The same person in a second search must remain a separate mapping/activity context.
records.push({kind:'mapping',id:'shared',role_id:'s2',candidate_id:'coverdue',status:'Approved',version:1});
const rows=()=>engagementOverviewRows(records,searches,now);
test('unified counts exactly reconcile to candidate cohorts and per-search totals',()=>{
 const all=rows(),counts=engagementCounts(all);
 assert.equal(all.length,11);assert.equal(counts.overdue,1);assert.equal(counts.due,1);assert.equal(counts.new,1);assert.equal(counts.coming,1);assert.equal(counts.unscheduled,2);assert.equal(counts.placed,1);assert.equal(counts.active,5);
 const bySearch=groupEngagementRows(all);
 for(const bucket of engagementBuckets){assert.equal(counts[bucket.id],all.filter(r=>matchesEngagementBucket(r,bucket.id)).length);assert.equal(counts[bucket.id],[...bySearch.values()].reduce((sum,group)=>sum+engagementCounts(group)[bucket.id],0));}
 assert.equal(all.find(r=>r.mapping_id==='overdue')?.mapping_version,3);
 assert.equal(all.find(r=>r.mapping_id==='overdue')?.version,5);
 for(const id of ['pending','draft','paused','placed','closed','exited'])assert.equal(matchesEngagementBucket(all.find(r=>r.mapping_id===id)!,'active'),false);
 assert.equal(all.filter(r=>r.candidate_id==='coverdue').length,2);
});
test('ownership includes direct resources, legacy resources and search partner without making all searches mine',()=>{
 assert.deepEqual(engagementSearchScope(searches,records,'worker','open','mine').map(s=>s.id),['s1','s2']);
 assert.deepEqual(engagementSearchScope(searches,records,'partner','all','mine').map(s=>s.id),['s1']);
 assert.deepEqual(engagementSearchScope(searches,records,'viewer','open','mine'),[]);
 assert.equal(engagementSearchScope(searches,records,'viewer','open','all').length,2);
});
const data={searches,research:{records},people:[],actor:{id:'viewer',roles:[]}};
const render=(layout:string,bucket='all',role='',extra:R={},override=data)=>renderToStaticMarkup(React.createElement(ViewStateProvider,{state:{'Engagement.unifiedLayout':layout,'Engagement.queueBucket':bucket,...extra},change:()=>{},children:React.createElement(EngagementSearchWorkspace,{data:override,role,setRole:()=>{},mine:false,now,canWork:()=>false,open:()=>{},onCandidate:()=>{},onAssignments:()=>{}})}));
test('List and Kanban retain the same cross-search priority filter and read-only actions',()=>{
 for(const layout of ['List','Kanban']){
  const html=render(layout,'overdue');
  assert.match(html,/Example overdue/);assert.doesNotMatch(html,/Example due/);assert.doesNotMatch(html,/Example closed/);
  assert.match(html,/Overdue: 1/);assert.match(html,/Due today: 1/);assert.match(html,/First Search/);assert.match(html,/101/);
  assert.match(html,/View activity for Example overdue/);assert.doesNotMatch(html,/Record activity for Example overdue/);
  assert.doesNotMatch(html,/Back to queue|Engagement dashboard|Engagement Queue/);
 }
 const pending=render('List','coming');assert.match(pending,/Example pending/);assert.doesNotMatch(pending,/Example paused/);assert.match(pending,/Complete sourcing approval/);
 const scoped=render('Kanban','all','s2');assert.match(scoped,/Example due/);assert.doesNotMatch(scoped,/Example new/);
});
test('search summary and filtered views share counts, including empty and no-owner views',()=>{
 const html=render('Searches','overdue');assert.match(html,/Overdue for First Search: 1/);assert.doesNotMatch(html,/Overdue for Second Search/);
 const empty=render('List','overdue','',{'Engagement.scope':'mine'});assert.match(empty,/Overdue: 0/);assert.match(empty,/No candidates match/);
 const find=render('List','all','',{'Engagement.candidateQuery':'Example due'});assert.match(find,/Example due/);assert.doesNotMatch(find,/Example new/);
});
test('large lists are paged and Kanban stages load incrementally while counts stay complete',()=>{
 const many:R[]=Array.from({length:180},(_,i)=>({kind:'mapping',id:'map'+i,candidate_id:'person'+i,role_id:'s1',status:'Approved'}));
 const large={...data,research:{records:[...many,...many.map((m,i)=>({kind:'candidate',id:m.candidate_id,name:'Synthetic Person '+i}))]}};
 const list=render('List','all','',{},large);assert.equal((list.match(/aria-label="View activity for/g)||[]).length,75);assert.match(list,/1–75 of 180/);assert.match(list,/All candidates: 180/);
 const board=render('Kanban','all','',{},large);assert.equal((board.match(/aria-label="View activity for/g)||[]).length,50);assert.match(board,/Show more · 130 remaining/);
});
test('legacy queue history resolves to Engagement and preserves status/scope, while new view changes stay in place',()=>{
 const old={page:'Daily Work',candidateId:'',viewStates:{'Daily Work':{'EngagementDaily.status':'closed','EngagementDaily.scope':'mine'},Pipeline:{'Engagement.role':'s1'}}};
 const migrated=normalizeEngagementVisit(old);assert.equal(migrated.page,'Pipeline');assert.equal(migrated.viewStates.Pipeline['Engagement.role'],'');
 assert.equal((migrated.viewStates.Pipeline as R)['Engagement.searchStatus'],'closed');assert.equal((migrated.viewStates.Pipeline as R)['Engagement.scope'],'mine');assert.equal(visitKey(old),visitKey(migrated));
 assert.equal(old.page,'Daily Work');
 const visit=(role:string,layout:string)=>({page:'Pipeline',candidateId:'',viewStates:{Pipeline:{'Engagement.role':role,'Engagement.unifiedLayout':layout,'Engagement.queueBucket':'overdue'}}});
 let h=recordVisit(emptyHistory(),visit('','Searches'));h=recordVisit(h,visit('','Kanban'));assert.equal(h.past.length,0);
 h=recordVisit(h,visit('s1','List'));const back=travelHistory(h,'back');assert.equal(back.present?.viewStates.Pipeline['Engagement.unifiedLayout'],'Kanban');assert.equal(back.present?.viewStates.Pipeline['Engagement.queueBucket'],'overdue');
});
test('candidate table keeps headers, columns and row cells aligned in both scopes',()=>{
 for(const role of ['','s1']){
  const html=render('List','all',role),table=html.match(/<table[^>]*engagement-candidate-table[\s\S]*?<\/table>/)![0];
  const expected=role?6:8;
  assert.equal((table.match(/<col(?=[\s/>])/g)||[]).length,expected);
  assert.equal((table.match(/<thead>[\s\S]*?<\/thead>/)![0].match(/<th[ >]/g)||[]).length,expected);
  for(const row of table.match(/<tbody>[\s\S]*?<\/tbody>/)![0].match(/<tr[\s\S]*?<\/tr>/g)||[])assert.equal((row.match(/<td[ >]/g)||[]).length,expected);
  assert.match(html,/Find candidate/);assert.doesNotMatch(html,/Find candidate or search|engagement-results-context|candidate-identity-actions/);
  assert.match(html,/engagement-stage-filter/);
 }
 assert.match(render('List','all','',{'Engagement.candidateQuery':'102'}),/No candidates match/);
});
