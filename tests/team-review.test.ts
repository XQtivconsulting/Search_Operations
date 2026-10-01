import test from 'node:test';import assert from 'node:assert/strict';import {canTeamReview} from '../src/team-review';
test('shared UI/server predicate uses mapping team and search-specific partner, never legacy reviewer assignment',()=>{
 const mapping={team_id:'t',reviewer_id:'outsider'},search={partner_id:'partner'},roster=[{team_id:'t',staff_id:'s'}];
 assert.ok(canTeamReview({id:'member',role:'researcher',staffId:'s'},mapping,search,roster));
 assert.ok(canTeamReview({id:'partner',role:'partner'},mapping,search,roster));
 assert.ok(canTeamReview({id:'root',role:'super_admin'},mapping,search,roster));
 assert.ok(!canTeamReview({id:'outsider',role:'researcher',staffId:'elsewhere'},mapping,search,roster));
 assert.ok(!canTeamReview({id:'member',role:'researcher',staffId:'s'},mapping,search,[]));
 for(const role of ['admin','planner','engagement','founder'])assert.ok(!canTeamReview({id:'other',role},mapping,search,roster));
});
