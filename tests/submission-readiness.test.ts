import test from 'node:test';import assert from 'node:assert/strict';
import {submissionReadiness} from '../src/submission-readiness';
test('missing and draft strategies explain the prerequisite without a null date',()=>{
 for(const strategy of [null,{}, {draft:'Saved strategy'}, {active:'Legacy strategy',cutover:null}]){
 const message=submissionReadiness(strategy,'2026-09-30');assert.match(message,/approved search strategy/);assert.doesNotMatch(message,/null|undefined/);
 }
});
test('future approved strategy shows a readable date; active strategy permits submission',()=>{
 assert.match(submissionReadiness({active:'Approved',cutover:'2026-10-01'},'2026-09-30'),/01 Oct 2026/);
 assert.equal(submissionReadiness({active:'Approved',cutover:'2026-09-30'},'2026-09-30'),'');
});
