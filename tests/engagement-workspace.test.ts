import test from 'node:test';
import assert from 'node:assert/strict';
import {searchEngagementRows,searchEngagementActivity} from '../src/engagement-workspace';
import {defaultPipeline} from '../src/engagement-pipeline';
import {recordVisit,emptyHistory,travelHistory} from '../src/navigation-history';
const searches=[{id:'s1',status:'Open'},{id:'s2',status:'Closed'}];
const mappings=[{id:'m1',kind:'mapping',role_id:'s1',candidate_id:'c1',status:'Draft'},{id:'m2',kind:'mapping',role_id:'s1',candidate_id:'c2',status:'Approved'},{id:'m3',kind:'mapping',role_id:'s1',candidate_id:'c3',status:'Draft'},{id:'m4',kind:'mapping',role_id:'s2',candidate_id:'c4',status:'Approved'}];
test('search workspace includes pre-handoff mappings without allowing engagement or counting them active',()=>{
 const rows=searchEngagementRows(mappings,searches);
 assert.equal(rows.length,4);assert.equal(rows[0].pending,true);assert.equal(rows[0].approved,false);assert.equal(rows[0].active,false);assert.equal(rows[0].stage,'Awaiting sourcing approval');
 assert.equal(rows[1].approved,true);assert.equal(rows[1].stage_id,'assigned');assert.equal(rows[1].active,true);
 assert.equal(rows[3].active,false);assert.match(rows[3].next_action,/Search closed/);
});
test('reopened and completed candidates retain their stage without active work or false attention',()=>{
 const records=[...mappings,{kind:'engagement',mapping_id:'m3',stage_id:'linkedin',stage_at:'2026-01-01'},{kind:'engagement',mapping_id:'m2',stage_id:'placed',stage_at:'2026-01-01'}];
 const rows=searchEngagementRows(records,searches,Date.parse('2026-10-01'));
 assert.equal(rows[2].stage_id,'linkedin');assert.equal(rows[2].pending,false);assert.equal(rows[2].attention,false);assert.match(rows[2].next_action,/reopened/);
 assert.equal(rows[1].group,'Placed');assert.equal(rows[1].active,false);assert.equal(rows[1].attention,false);
});
test('all previous funnel assignees become search resources while attention still follows stage',()=>{
 const records=[...mappings,{kind:'engagement-pipeline',stages:defaultPipeline.map(s=>({...s,threshold:2}))},{kind:'engagement',mapping_id:'m2',stage_id:'linkedin',stage_at:'2026-01-01'},{kind:'engagement-assignment',role_id:'s1',group_member_ids:{Outreach:['p1'],Screening:['p2']}}];
 const row=searchEngagementRows(records,searches,Date.parse('2026-10-01'))[1];assert.deepEqual(row.members,['p1','p2']);assert.equal(row.attention,true);
});
test('search activity excludes other searches and unscoped notes, with newest dates first',()=>{
 const records=[{id:'a1',kind:'candidate-activity',role_id:'s1',candidate_id:'c1',occurred_on:'2026-01-01'},{id:'a2',kind:'candidate-activity',role_id:'s1',candidate_id:'c2',occurred_on:'2026-02-01'},{id:'a3',kind:'candidate-activity',role_id:'s2',candidate_id:'c1'},{id:'a4',kind:'candidate-activity',role_id:'',candidate_id:'c1'}];
 assert.deepEqual(searchEngagementActivity(records,'s1').map(r=>r.id),['a2','a1']);assert.deepEqual(searchEngagementActivity(records,'s1','c1').map(r=>r.id),['a1']);
});
test('back and forward distinguish engagement searches and restore candidate focus and filters',()=>{
 const visit=(role:string,extra={})=>({page:'Pipeline',candidateId:'',viewStates:{Pipeline:{'Engagement.role':role,...extra}}});
 let h=recordVisit(emptyHistory(),visit(''));h=recordVisit(h,visit('s1',{'Engagement.focus':'m1','Engagement.group':'Outreach'}));h=recordVisit(h,visit('s2'));
 assert.equal(travelHistory(h,'back').present?.viewStates.Pipeline['Engagement.role'],'s1');assert.equal(travelHistory(h,'back').present?.viewStates.Pipeline['Engagement.focus'],'m1');assert.equal(travelHistory(travelHistory(h,'back'),'back').present?.viewStates.Pipeline['Engagement.role'],'');assert.equal(travelHistory(travelHistory(h,'back'),'forward').present?.viewStates.Pipeline['Engagement.role'],'s2');
});
test('search workspace renders the full candidate list and preserves the read-only handoff boundary',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{Engagement}=await import('../src/Engagement');
 const data={actor:{id:'viewer',roles:[]},people:[],searches:[{id:'s1',title:'Synthetic search',client:'Example',status:'Open'}],research:{records:[...mappings,{kind:'candidate',id:'c1',name:'Sample One'},{kind:'candidate',id:'c2',name:'Sample Two'}]}};
 const html=renderToStaticMarkup(React.createElement(Engagement,{data,initialRole:'s1',onDirty:()=>{},onCandidate:()=>{},api:async()=>({}),reload:async()=>{}}));
 assert.match(html,/Sample One/);assert.match(html,/Sample Two/);assert.match(html,/Awaiting sourcing approval/);assert.match(html,/Next action/);assert.match(html,/Kanban/);assert.match(html,/Find candidate/);assert.doesNotMatch(html,/engagement-context-bar|engagement-workspace-tabs/);assert.doesNotMatch(html,/Save update/);
});
test('awaiting recommendation expands interview tracker only to the to-be-recommended stage',async()=>{
 const {matchesInterviewTracker}=await import('../src/interviews');
 assert.equal(matchesInterviewTracker({stage_id:'shortlist'},'Shortlist',false),false);
 assert.equal(matchesInterviewTracker({stage_id:'shortlist'},'Shortlist',true),true);
 for(const id of ['assigned','linkedin','screening','engaged-email','xqtiv-rejected'])assert.equal(matchesInterviewTracker({stage_id:id},'Outreach',true),false);
 assert.equal(matchesInterviewTracker({stage_id:'recommended'},'Shortlist',false),true);
 assert.equal(matchesInterviewTracker({stage_id:'client-rejected',recommended_on:'2026-01-01'},'Exited',true),true);
});


test('priority filters stay inside the unified engagement workspace',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{EngagementSearchWorkspace}=await import('../src/EngagementSearchWorkspace'),{ViewStateProvider}=await import('../src/ViewState');
 const now=Date.parse('2026-10-08T12:00:00Z'),records=[...mappings,{kind:'candidate',id:'c2',name:'Overdue Example'},{kind:'engagement',mapping_id:'m2',role_id:'s1',candidate_id:'c2',stage_id:'linkedin',stage_at:'2026-01-01'},{kind:'engagement-pipeline',stages:defaultPipeline.map(s=>({...s,threshold:2}))}];
 const props={data:{research:{records},searches,people:[],actor:{id:'viewer',roles:[]}},role:'s1',setRole:()=>{},mine:false,now,canWork:()=>false,open:()=>{},onCandidate:()=>{},onAssignments:()=>{}};
 const render=(bucket:string)=>renderToStaticMarkup(React.createElement(ViewStateProvider,{state:{'Engagement.queueBucket':bucket},change:()=>{},children:React.createElement(EngagementSearchWorkspace,props)}));
 assert.match(render('overdue'),/Overdue Example/);assert.doesNotMatch(render('overdue'),/Back to queue/);assert.match(render('overdue'),/Filter engagement priorities/);assert.doesNotMatch(render('due'),/Overdue Example/);assert.match(render('due'),/No candidates match/);
});
