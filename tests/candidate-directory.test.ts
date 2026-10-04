import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryRows,directoryPage,candidateRoleCounts} from '../src/candidate-directory';
const candidates=[
 {id:'a',first_name:'Anika',last_name:'Shah',company:'Acme',url:'https://linkedin.com/in/z-user',title:'VP',phone:'555123'},
 {id:'b',first_name:'Arjun',last_name:'Goel',company:'Beta',url:'https://linkedin.com/in/a-user',title:'Director'},
 {id:'c',first_name:'Ben',last_name:'Shah',company:'Acme',url:'https://linkedin.com/in/b-user',title:'VP'},
];
test('directory filters combine typed fields and query; all visible identity columns sort independently',()=>{
 assert.deepEqual(directoryRows(candidates,'ACME',{first_name:'ani',last_name:'SHA'},'first_name',false,new Map()).map(r=>r.id),['a']);
 assert.equal(directoryRows(candidates,'555123',{},'first_name',false,new Map())[0].id,'a');
 assert.deepEqual(directoryRows(candidates,'',{},'url',false,new Map()).map(r=>r.id),['b','c','a']);
 assert.deepEqual(directoryRows(candidates,'',{},'company',true,new Map()).map(r=>r.id),['b','a','c']);
});
test('directory pages thousands of matches and clamps stale pages after filtering',()=>{
 const rows=Array.from({length:3001},(_,i)=>({id:String(i)}));
 const first=directoryPage(rows,0,25),last=directoryPage(rows,120,25);
 assert.equal(first.rows.length,25);assert.equal(first.pages,121);
 assert.equal(last.rows.length,1);assert.equal(last.start,3001);assert.equal(last.end,3001);
 assert.equal(directoryPage(rows.slice(0,3),120,25).page,0);
 assert.deepEqual(directoryPage([],0,25),{rows:[],page:0,pages:1,start:0,end:0});
});
test('role counts count distinct roles, not mapping records or researchers',()=>{
 const counts=candidateRoleCounts([{kind:'mapping',candidate_id:'a',role_id:'r1'},{kind:'mapping',candidate_id:'a',role_id:'r1'},{kind:'mapping',candidate_id:'a',role_id:'r2'},{kind:'candidate',id:'b'}]);
 assert.equal(counts.get('a'),2);assert.equal(counts.has('b'),false);
 assert.equal(directoryRows(candidates,'',{},'roles',true,counts)[0].id,'a');
});


test('directory searches notes and past company snapshots with combined tags and unmapped filter before paging',async()=>{
 const {candidateSearchIndex}=await import('../src/candidate-tags');
 const cs=[{id:'x',name:'Synthetic One',company:'NewCo',tag_values:{industry:['Technology'],geography:['India']}},{id:'y',name:'Synthetic Two',company:'Other'}];
 const records=[...cs.map(c=>({...c,kind:'candidate'})),{id:'map',kind:'mapping',candidate_id:'x',role_id:'s',company:'Infosys',rationale:'Cloud leadership'},{id:'note',kind:'candidate-activity',candidate_id:'x',notes:'Productionalization expertise'}];
 const index=candidateSearchIndex(records,[{id:'s',client:'Example',title:'AI Leader'}]),counts=candidateRoleCounts(records);
 assert.deepEqual(directoryRows(cs,'productionalization cloud',{'company':'infosys','tag:industry':'["Technology"]'},'name',false,counts,index,records).map(c=>c.id),['x']);
 assert.deepEqual(directoryRows(cs,'',{'unmapped':'yes'},'name',false,counts,index,records).map(c=>c.id),['y']);
 assert.equal(directoryRows(cs,'',{'tag:geography':'["Canada"]'},'name',false,counts,index,records).length,0);
 const many=Array.from({length:201},(_,i)=>({id:String(i),first_name:String(i).padStart(3,'0')}));assert.equal(directoryPage(directoryRows(many,'',{},'first_name',true,new Map()),0,100).rows[0].id,'200');
});

test('tag columns sort all candidates before paging and combine per-category selections',()=>{
 const cs=Array.from({length:125},(_,i)=>({id:String(i),first_name:'Person '+i,tag_values:{industry:[i<100?'Technology':'Life Sciences'],geography:['US West'],expertise:['Zeta','AI']}}));
 cs.push({id:'blank',first_name:'No tags',tag_values:{} as any});
 const rows=directoryRows(cs,'',{},'tag:industry',false,new Map());
 assert.equal(directoryPage(rows,0,25).rows.every(c=>c.tag_values.industry[0]==='Life Sciences'),true);
 assert.equal(rows.at(-1)?.id,'blank');
 assert.equal(directoryRows(cs,'',{},'tag:industry',true,new Map()).at(-1)?.id,'blank');
 assert.equal(directoryRows(cs,'',{'tag:industry':'["Life Sciences"]','tag:geography':'["US West"]'},'last_name',false,new Map()).length,25);
 assert.deepEqual(directoryRows(cs,'',{'tag:industry':'[""]'},'first_name',false,new Map()).map(c=>c.id),['blank']);
 assert.equal(directoryRows(cs,'',{'tag:industry':'[]'},'first_name',false,new Map()).length,0);
});

test('geography uses country names for storage/filtering and compact codes for display and search',async()=>{
 const {cleanTagValues,candidateSearchIndex}=await import('../src/candidate-tags');
 const {geographyFullName,geographyCode,geographySearchText}=await import('../src/candidate-geography');
 const {candidateTagDisplay,candidateTagText}=await import('../src/candidate-directory');
 const tags=cleanTagValues({geography:['US','USA','UK','GB','FR','DE','GE']},[]);
 assert.deepEqual(tags.geography,['United States','United Kingdom','France','Germany','Georgia']);
 assert.equal(geographyCode('Germany'),'DE');assert.equal(geographyCode('Georgia'),'GE');
 assert.equal(geographyFullName('US Northeast'),'United States — Northeast');assert.equal(geographyCode('US Northeast'),'US Northeast');
 assert.match(geographySearchText('United Kingdom'),/UK/);
 assert.throws(()=>cleanTagValues({geography:['some random place']},[]),/standardized/);
 const c={id:'c',kind:'candidate',tag_values:{geography:['Germany'],compensation:[]},compensation_details:'Current total USD 450k; minimum next role USD 500k'};
 assert.equal(candidateTagDisplay(c,'geography'),'DE');assert.equal(candidateTagText(c,'geography'),'Germany');
 const index=candidateSearchIndex([c],[]);
 assert.equal(directoryRows([c],'DE',{},'tag:geography',false,new Map(),index,[c]).length,1);
 assert.equal(directoryRows([c],'minimum 500k',{'tag:geography':'["Germany"]'},'tag:geography',false,new Map(),index,[c]).length,1);
 assert.equal(c.tag_values.compensation.length,0);
});
