import test from 'node:test';import assert from 'node:assert/strict';import {canTeamReview} from '../src/team-review';
test('shared UI/server predicate uses mapping team and search-specific partner, never legacy reviewer assignment',()=>{
 const mapping={team_id:'t',reviewer_id:'outsider'},search={partner_id:'partner'},roster=[{team_id:'t',staff_id:'s'}];
 assert.ok(canTeamReview({id:'member',role:'researcher',staffId:'s'},mapping,search,roster));
 assert.ok(canTeamReview({id:'partner',role:'partner'},mapping,search,roster));
 assert.ok(canTeamReview({id:'partner',role:'admin'},mapping,search,roster));
 assert.ok(canTeamReview({id:'root',role:'super_admin'},mapping,search,roster));
 assert.ok(!canTeamReview({id:'outsider',role:'researcher',staffId:'elsewhere'},mapping,search,roster));
 assert.ok(!canTeamReview({id:'member',role:'researcher',staffId:'s'},mapping,search,[]));
 for(const role of ['admin','planner','engagement','founder'])assert.ok(!canTeamReview({id:'other',role},mapping,search,roster));
});

test('unallocated directory mappings follow the latest effective search allocation, not unrelated or future teams',()=>{
 const actor={id:'researcher',role:'researcher',staffId:'person'},mapping={role_id:'r',team_id:''},search={id:'r',partner_id:'p'},roster=[{team_id:'blue',staff_id:'person'}];
 assert.equal(canTeamReview(actor,mapping,search,roster),false);
 assert.equal(canTeamReview(actor,mapping,search,roster,[{search_id:'r',team_id:'blue',work_date:'2020-01-01'}]),true);
 assert.equal(canTeamReview(actor,mapping,search,roster,[{search_id:'other',team_id:'blue',work_date:'2020-01-01'}]),false);
 assert.equal(canTeamReview(actor,mapping,search,roster,[{search_id:'r',team_id:'blue',work_date:'2999-01-01'}]),false);
 assert.equal(canTeamReview(actor,mapping,search,roster,[{search_id:'r',team_id:'blue',work_date:'2020-01-01'},{search_id:'r',team_id:'red',work_date:'2020-01-02'}]),false);
});
