import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Candidate360} from '../src/Candidate360';
import {belongsToNoteGroup,candidateEngagementState} from '../src/candidate-profile';
test('candidate notes separate interviews, general notes and real transitions without guessing old transcripts',()=>{
 for(const type of ['Interview','Interview · R2','Screening call'])assert.ok(belongsToNoteGroup({type},'Interview notes'));
 assert.ok(belongsToNoteGroup({type:'Transcript',note_group:'Interview notes'},'Interview notes'));
 assert.ok(belongsToNoteGroup({type:'Transcript'},'General notes'));
 assert.ok(!belongsToNoteGroup({type:'Assessment link'},'General notes'));
 const transition={type:'Interview · R2',interview:{number:2},from_stage_id:'interviews',to_stage_id:'client-rejected'};
 assert.ok(belongsToNoteGroup(transition,'Interview notes'));
 assert.ok(belongsToNoteGroup(transition,'Stage updates'));
 assert.ok(!belongsToNoteGroup(transition,'General notes'));
 assert.ok(!belongsToNoteGroup({type:'Note',from_stage_id:'interviews',to_stage_id:'interviews'},'Stage updates'));
});
test('engagement status distinguishes sourcing prerequisite, reopened review, terminal outcome and overall closure',()=>{
 for(const status of ['Draft','Peer review','Team review','Partner review','Needs information'])assert.deepEqual(candidateEngagementState({status}),{label:'Not started',detail:'Awaiting sourcing partner approval',tone:'neutral'});
 assert.match(candidateEngagementState({status:'Rejected'}).detail,/Not approved/);
 assert.match(candidateEngagementState({status:'Approved'}).detail,/handoff pending/);
 assert.equal(candidateEngagementState({status:'Approved'},{approved:true,stage:'Rejected by Client',funnel_group:'Exited',search_closed:true}).label,'Rejected by Client');
 assert.match(candidateEngagementState({},{approved:false,stage:'Email 1'}).detail,/Sourcing review reopened/);
});
test('candidate overview renders bounded note previews and explicit sourcing/engagement cards',()=>{
 const candidate={id:'c',tags:['Synthetic tag']};
 const notes=Array.from({length:20},(_,i)=>({id:'n'+i,kind:'candidate-activity',candidate_id:'c',type:'Note',notes:'General note '+i,occurred_on:'2026-10-01',created_at:'2026-10-01',actor_id:'u'}));
 const data={actor:{id:'u',role:'researcher'},people:[{id:'u',name:'Test author'}],searches:[{id:'s',title:'Synthetic Search',client:'Client',status:'Open'}],research:{records:[...notes,{id:'m',kind:'mapping',candidate_id:'c',role_id:'s',status:'Peer review'}],events:[]}};
 const html=renderToStaticMarkup(React.createElement(Candidate360,{candidate,data,api:async()=>[],reload:async()=>{},onDirty:()=>{}}));
 for(const text of ['Interview notes','General notes','Stage updates','Documents','Assessments','Not started','Awaiting sourcing partner approval','Team review','Test author'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/class="note-preview"/g)||[]).length,2);
 assert.ok(html.includes('View all 20'));
 assert.ok(!html.includes('General note 19'));
});
