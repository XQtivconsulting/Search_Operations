import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHistory,recordVisit,travelHistory} from '../src/navigation-history';
const visit=(page:string,extra:Record<string,any>={}):{page:string;candidateId:string;[key:string]:any}=>({page,candidateId:'',...extra});
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
test('search tabs and profiles preserve repository view, filters and pagination on return',()=>{
 let h=recordVisit(emptyHistory(),visit('Search repository',{selected:'r',repoTab:'Candidate mappings',repoState:{mappingPage:3,mappingView:'all',mappedBy:['person']}}));
 h=recordVisit(h,visit('Candidates',{candidateId:'c'}));const back=travelHistory(h,'back');assert.equal(back.present?.selected,'r');assert.equal(back.present?.repoState.mappingPage,3);assert.deepEqual(back.present?.repoState.mappedBy,['person']);
 h=recordVisit(back,visit('Search repository',{selected:'r',repoTab:'Target companies'}));assert.equal(travelHistory(h,'back').present?.repoTab,'Candidate mappings');
});
test('navigation snapshots retain weekly plan, directory pages and table sorting across repeated round trips',()=>{
 const weekly=visit('Weekly plan',{selected:'r',viewStates:{'Weekly plan':{'WeeklyPlanner.week':'2026-09-28','WeeklyPlanner.view':'allocation','WeeklyPlanner.roles':['r']}}});
 const search=visit('Search repository',{selected:'r',repoTab:'Target companies',viewStates:{...weekly.viewStates,'Search repository':{'ResearchPanel.table1':{column:1,descending:true}}}});
 const candidate=visit('Candidates',{candidateId:'c',viewStates:search.viewStates});
 let history=recordVisit(recordVisit(recordVisit(emptyHistory(),weekly),search),candidate);
 for(let i=0;i<5;i++){history=travelHistory(history,'back');assert.deepEqual(history.present,search);history=travelHistory(history,'back');assert.deepEqual(history.present,weekly);history=travelHistory(history,'forward');history=travelHistory(history,'forward');assert.deepEqual(history.present,candidate);}
 const restored=JSON.parse(JSON.stringify(history));assert.deepEqual(travelHistory(restored,'back').present,search);
});
