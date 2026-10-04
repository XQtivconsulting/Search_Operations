import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHistory,recordVisit,travelHistory} from '../src/navigation-history';
const visit=(page:string,extra={})=>({page,candidateId:'',...extra});
test('back restores latest monitor filters and forward restores specific mapping',()=>{
 let h=recordVisit(emptyHistory(),visit('Delivery Monitor',{deliveryStart:{view:'daily'}}));
 h=recordVisit(h,visit('Delivery Monitor',{deliveryStart:{view:'pipeline',query:'Anjali',stage:'Peer review'}}));
 assert.equal(h.past.length,0);
 h=recordVisit(h,visit('Search repository',{selected:'search1',mappingStart:'mapping1'}));
 const back=travelHistory(h,'back');
 assert.deepEqual(back.present?.deliveryStart,{view:'pipeline',query:'Anjali',stage:'Peer review'});
 assert.equal(travelHistory(back,'forward').present?.mappingStart,'mapping1');
});
test('candidate profiles are separate visits and a new branch clears forward history',()=>{
 let h=recordVisit(emptyHistory(),visit('Candidates'));
 h=recordVisit(h,visit('Candidates',{candidateId:'c1'}));
 assert.equal(h.past.length,1);
 h=recordVisit(travelHistory(h,'back'),visit('Teams'));
 assert.equal(h.future.length,0);
 assert.equal(travelHistory(h,'back').present?.page,'Candidates');
 assert.deepEqual(recordVisit(h,visit('')),emptyHistory());
 assert.deepEqual(travelHistory(emptyHistory(),'back'),emptyHistory());
});
