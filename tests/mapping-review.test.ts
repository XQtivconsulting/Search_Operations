import test from 'node:test';
import assert from 'node:assert/strict';
import {mappingReviewAction} from '../src/mapping-review';
test('assigned partner self-review supports shared staff identity and still requires assignment and permission',()=>{
 const mapping={status:'Partner review',mapper_id:'former-account',staff_id:'same-person'},search={partner_id:'new-account'},actor={id:'new-account',staffId:'same-person',role:'super_admin'};
 assert.equal(mappingReviewAction(actor,mapping,search,[]).allowed,true);
 assert.equal(mappingReviewAction({...actor,id:'former-account'},mapping,search,[]).allowed,false);
 assert.equal(mappingReviewAction({...actor,role:'researcher'},mapping,search,[]).allowed,false);
 assert.equal(mappingReviewAction({...actor,id:'another-partner',role:'partner'},mapping,search,[]).allowed,false);
 assert.equal(mappingReviewAction(actor,{...mapping,status:'Approved'},search,[]).label,'');
});
