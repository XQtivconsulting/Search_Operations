import test from 'node:test';
import assert from 'node:assert/strict';
import {mappingReviewAction,partnerReviewConflict} from '../src/mapping-review';
test('partner action detects linked staff self-review even with a different account ID',()=>{
 const mapping={status:'Partner review',mapper_id:'former-account',staff_id:'same-person'},search={partner_id:'new-account'},actor={id:'new-account',staffId:'same-person',role:'super_admin'};
 assert.equal(mappingReviewAction(actor,mapping,search,[]).allowed,false);
 assert.ok(partnerReviewConflict(mapping,search,[{id:'new-account',staff_id:'same-person'}]));
 assert.equal(mappingReviewAction({...actor,staffId:'other-person'},mapping,search,[]).allowed,true);
 assert.equal(mappingReviewAction(actor,{...mapping,status:'Approved'},search,[]).label,'');
});
