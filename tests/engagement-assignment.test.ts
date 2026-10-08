import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EngagementAssignmentGrid} from '../src/EngagementAssignmentGrid';
import {canReceiveEngagementAssignment,unavailableEngagementAssignments} from '../src/engagement-assignment';
const eligible={id:'current',name:'Synthetic Current',status:'active',permissions:['engagement.work']};
const former={id:'former',name:'Synthetic Former',status:'active',role:'engagement',permissions:[]};
test('assignment eligibility follows current permissions, custom roles and account status',()=>{
 assert.equal(canReceiveEngagementAssignment(eligible),true);
 assert.equal(canReceiveEngagementAssignment({...eligible,permissions:['engagement.interviews']}),true);
 assert.equal(canReceiveEngagementAssignment(former),false);
 assert.equal(canReceiveEngagementAssignment({...eligible,status:'revoked'}),false);
 assert.equal(canReceiveEngagementAssignment({...eligible,permissions:['engagement.view']}),false);
 assert.deepEqual(unavailableEngagementAssignments([eligible,former],['current','former','deleted','former']),[{id:'former',name:'Synthetic Former'},{id:'deleted',name:'Former or unavailable member'}]);
});
test('previously hidden selections remain visible and removable without silently discarding them',()=>{
 const html=renderToStaticMarkup(React.createElement(EngagementAssignmentGrid,{people:[eligible,former],assignments:['current','former','deleted'],onChange:()=>{}}));
 assert.match(html,/3 selected/);assert.match(html,/Remove assignment for Synthetic Former/);assert.match(html,/Remove assignment for Former or unavailable member/);assert.match(html,/Remove unavailable assignments before saving/);
 assert.equal((html.match(/type="checkbox"/g)||[]).length,1);assert.match(html,/checked=""/);
 const cleaned=renderToStaticMarkup(React.createElement(EngagementAssignmentGrid,{people:[eligible,former],assignments:['current'],onChange:()=>{}}));assert.match(cleaned,/1 selected/);assert.doesNotMatch(cleaned,/Synthetic Former|Remove unavailable assignments/);
});
