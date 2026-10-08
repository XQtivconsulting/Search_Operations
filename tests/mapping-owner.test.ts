import test from 'node:test';
import assert from 'node:assert/strict';
import {mappingNextOwner} from '../src/mapping-owner';
test('mapping owners follow saved assignments and custom permissions, including unassignment',()=>{
 const data:any={people:[{id:'a',name:'Example A',status:'active',roles:['custom'],permissions:['engagement.work']},{id:'b',name:'Example B',status:'active',permissions:['engagement.interviews']}],searches:[{id:'s',partner_id:'b'}],research:{records:[{kind:'engagement-assignment',role_id:'s',member_ids:['a','b']}]}};
 const mapping={role_id:'s',status:'Imported'};
 assert.equal(mappingNextOwner(mapping,data),'Example A, Example B');
 data.research.records[0].member_ids=['b'];assert.equal(mappingNextOwner(mapping,data),'Example B');
 data.people[1].status='revoked';assert.equal(mappingNextOwner(mapping,data),'Unassigned');
 data.research.records[0].member_ids=[];assert.equal(mappingNextOwner(mapping,data),'Unassigned');
 data.people[1].status='active';assert.equal(mappingNextOwner({...mapping,status:'Partner review'},data),'Example B');
 assert.equal(mappingNextOwner({...mapping,status:'Approved'},data),'—');
});
test('team review owners derive from current permission and search allocation',()=>{
 const data:any={people:[{id:'a',name:'Example reviewer',status:'active',staff_id:'staff-a',permissions:['reviews.team']},{id:'b',name:'Unrelated',status:'active',staff_id:'staff-b',permissions:['reviews.team']}],searches:[{id:'s'}],team_members:[{team_id:'t',staff_id:'staff-a'}],assignments:[]};
 assert.equal(mappingNextOwner({role_id:'s',status:'Peer review',team_id:'t'},data),'Example reviewer');
 data.people[0].permissions=[];assert.equal(mappingNextOwner({role_id:'s',status:'Peer review',team_id:'t'},data),'Unassigned');
});
