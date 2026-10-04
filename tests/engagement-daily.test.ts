import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyEngagementRows,nextActivity} from '../src/engagement-daily';
import {defaultPipeline,normalizeStages,pipelineStages,resolvedStage,stageDays} from '../src/engagement-pipeline';
const stages=normalizeStages(defaultPipeline),step=(id:string)=>stages.find(s=>s.id===id)!;
test('daily activities follow configured outreach order and never infer a response',()=>{
 assert.equal(nextActivity(step('assigned'),stages).target,'linkedin');
 assert.deepEqual(nextActivity(step('linkedin'),stages),{label:'Send SalesNav message',target:'salesnav'});
 assert.equal(nextActivity(step('salesnav'),stages).target,'email1');
 assert.equal(nextActivity(step('closing'),stages).target,'');
 assert.match(nextActivity(step('closing'),stages).label,/decide outreach outcome/);
 const custom={id:'custom',label:'Custom message sent',action_label:'Send custom message',group:'Outreach',threshold:2};
 const changed=[...stages.slice(0,2),custom,...stages.slice(2)];
 assert.deepEqual(nextActivity(step('linkedin'),changed),{label:'Send custom message',target:'custom'});
 for(const id of ['engaged-linkedin','engaged-email','engaged-phone'])assert.deepEqual(nextActivity(step(id),stages),{label:'Arrange initial screening call',target:''});
 assert.match(nextActivity(step('screening'),stages).label,/shortlist/);
 assert.equal(nextActivity(step('shortlist'),stages).target,'recommended');
 assert.match(nextActivity(step('recommended'),stages).label,/client/);
 assert.equal(nextActivity(step('interviews'),stages).target,'');
 assert.equal(nextActivity(step('placed'),stages).label,'Placement completed');
});
const start='2026-10-01T12:00:00Z',searches=[{id:'r',status:'Open'}];
function records(id='linkedin',threshold=1):Record<string,any>[]{return [
 {kind:'engagement-pipeline',stages:stages.map(s=>({...s,threshold:s.id===id?threshold:0}))},
 {kind:'mapping',id:'m',role_id:'r',candidate_id:'c',status:'Approved',version:3},
 {kind:'engagement',id:'e',mapping_id:'m',stage_id:id,stage_at:start,handoff_at:start},
 {kind:'engagement-assignment',role_id:'r',member_ids:['engager']}
 ];}
test('threshold boundary, later days, disabled thresholds and unknown history are distinct',()=>{
 const rec=records(),row=(iso:string)=>dailyEngagementRows(rec,searches,Date.parse(iso))[0];
 assert.equal(row('2026-10-02T11:59:59Z').due,false);
 assert.equal(row('2026-10-02T12:00:00Z').due,true);
 assert.equal(row('2026-10-02T12:00:00Z').overdue,false);
 assert.equal(row('2026-10-03T12:00:00Z').overdue,true);
 assert.equal(row('2026-10-03T12:00:00Z').due,false);
 assert.equal(row('2026-10-03T11:59:59Z').due,true);
 assert.equal(row('2026-10-01T13:00:00Z').newToday,true);
 assert.equal(row('2026-10-02T12:00:00Z').newToday,false);
 assert.equal(row('2026-10-02T12:00:00Z').due_at,'2026-10-02T12:00:00.000Z');
 assert.deepEqual(row('2026-10-02T12:00:00Z').members,['engager']);
 assert.equal(dailyEngagementRows(records('linkedin',0),searches,Date.parse('2026-12-01'))[0].due,false);
 const unknown=records();unknown[2].stage_at=null;unknown[2].handoff_at='invalid';
 const u=dailyEngagementRows(unknown,searches)[0];assert.equal(u.days,null);assert.equal(u.due,false);assert.equal(u.newToday,false);
});
test('response switches the activity, client aging persists, and terminal outcomes never schedule',()=>{
 const now=Date.parse('2026-12-01'),engaged=dailyEngagementRows(records('engaged-phone',2),searches,now)[0];
 assert.equal(engaged.label,'Arrange initial screening call');assert.equal(engaged.target,'');assert.equal(engaged.due,false);assert.equal(engaged.overdue,true);
 const client=dailyEngagementRows(records('interviews',5),searches,now)[0];assert.equal(client.overdue,true);assert.equal(client.target,'');
 for(const id of ['placed','unresponsive']){const row=dailyEngagementRows(records(id,2),searches,now)[0];assert.equal(row.active,false);assert.equal(row.due,false);assert.equal(row.threshold,0);assert.equal(row.due_at,null);}
 assert.equal(dailyEngagementRows(records(),[{id:'r',status:'Cancelled'}],now).length,0);
 assert.equal(dailyEngagementRows(records('placed',2),[{id:'r',status:'Placed'}],now)[0].group,'Placed');
 const reopened=records();reopened[1].status='Draft';assert.equal(dailyEngagementRows(reopened,searches,now).length,0);
});
test('legacy Ready aliases Assigned without rewriting records or stage timestamps',()=>{
 const old={kind:'engagement-pipeline',stages:[{id:'ready',label:'Ready for outreach',group:'Top Funnel',threshold:2},...stages]};
 const config=pipelineStages([old]);assert.equal(config[0].id,'assigned');assert.equal(config.some(s=>s.id==='ready'),false);
 const record={stage_id:'ready',stage:'Ready for outreach',stage_at:start};
 assert.equal(resolvedStage(record,config).id,'assigned');assert.equal(stageDays(record,Date.parse('2026-10-04T12:00:00Z')),3);
 assert.equal(record.stage_id,'ready');assert.equal(record.stage_at,start);
});
