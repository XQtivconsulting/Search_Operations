import test from 'node:test';import assert from 'node:assert/strict';
import {performanceCandidates,performanceMetrics,searchAge,performancePeriod,performanceAllocationGaps} from '../src/performance';
const base={assignments:[],entries:[],effort:[],research:{records:[]}};
const map=(id:string,status:string,staff_id='s',role_id='r')=>({id,kind:'mapping',status,staff_id,role_id,team_id:'t',work_date:'2026-09-27',submitted_at:'2026-09-27T12:00:00Z'});
const effort=(days:number,search_id='r',staff_id='s')=>({search_id,staff_id,team_id:'t',work_date:'2026-09-27',days});
const filter={from:'',to:'',roles:null,team:''};
test('quality excludes pending and returned work, includes final peer rejections',()=>{
 const d={...base,research:{records:[map('a','Approved'),map('b','Rejected'),map('c','Peer review'),map('d','Partner review'),map('e','Hold'),map('f','Needs information'),{...map('g','Draft'),submitted_at:null}]},effort:[effort(1)]};
 const m=performanceMetrics(d,filter);assert.equal(m.mapped,6);assert.equal(m.reviewed,2);assert.equal(m.quality,.5);assert.equal(m.pending,2);assert.equal(m.returned,2);assert.equal(m.throughput,6);assert.equal(m.yield,1);assert.equal(m.approvalRatio,1/6);
});
test('effort includes zero output and rates stay blank for incomplete effort',()=>{
 const d={...base,effort:[effort(.5),effort(.5,'r2')],research:{records:[map('a','Approved')]}};
 assert.equal(performanceMetrics(d,filter).throughput,1);assert.equal(performanceMetrics(d,{...filter,roles:['r']}).throughput,2);
 const noEffort=performanceMetrics({...d,effort:[]},filter);assert.equal(noEffort.missing,1);assert.equal(noEffort.throughput,null);assert.equal(noEffort.quality,1);
 const zero=performanceMetrics({...base,effort:[effort(1)]},filter);assert.equal(zero.throughput,0);assert.equal(zero.days,1);assert.equal(zero.quality,null);
});
test('team rates use total output and effort rather than averaging researcher ratios',()=>{
 const d={...base,effort:[effort(.25),effort(.75,'r','s2')],research:{records:[map('a','Approved'),map('b','Rejected','s2'),map('c','Rejected','s2')]}};
 const m=performanceMetrics(d,filter);assert.equal(m.throughput,3);assert.equal(m.quality,1/3);assert.equal(m.days,1);assert.equal(m.activeDays,1);assert.equal(m.hours,8);
 assert.equal(performanceMetrics(d,{...filter,roles:[]}).mapped,0);assert.equal(performanceMetrics(d,{...filter,staff:'s'}).throughput,4);
 assert.equal(performanceMetrics(d,{...filter,from:'2026-09-28'}).days,0);
});
test('planned zero-output work supplies effort without confirmation',()=>{
 const d={...base,assignments:[{id:'a',search_id:'r',team_id:'t',work_date:'2026-09-27'}],entries:[{assignment_id:'a',staff_id:'s'}]};
 assert.equal(performanceMetrics(d,filter).missing,0);assert.equal(performanceMetrics(d,filter).days,1);assert.equal(performanceMetrics(d,filter).throughput,0);
 assert.equal(performanceMetrics({...d,effort:[effort(0)]},filter).missing,0);
});
test('search aging separates role age from first mapping age and preserves unknowns',()=>{
 assert.deepEqual(searchAge({id:'r',start_date:'2026-09-01'},[map('a','Approved')],'2026-09-29'),{age:28,sinceFirst:2,first:'2026-09-27'});
 assert.equal(searchAge({id:'r'},[],'2026-09-29').age,null);
});
test('performance renders definitions, separate tabs and no invented historical effort',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{Performance}=await import('../src/Performance');
 const data={...base,actor:{role:'partner'},searches:[{id:'r',client:'Client',title:'Role'}],teams:[],staff:[{id:'s',name:'Researcher'}],priorities:[],research:{records:[map('a','Approved')]}};
 const html=renderToStaticMarkup(React.createElement(Performance,{data,api:async()=>{},reload:async()=>{},onDirty:()=>{},onDecision:()=>{}}));
 assert.ok(html.includes('Search effort &amp; yield'));assert.ok(html.includes('Allocation gaps'));assert.ok(html.includes('final decisions'));assert.ok(html.includes('Last 30 days'));assert.ok(!html.includes('person-days (plan-based)'));assert.ok(!html.includes('work entries without allocated effort'));
});

test('reporting presets always resolve to explicit bounded dates',()=>{
 assert.deepEqual(performancePeriod('30','2026-10-05','2026-01-01'),{from:'2026-09-06',to:'2026-10-05'});
 assert.deepEqual(performancePeriod('previous','2026-10-05','2026-01-01'),{from:'2026-09-28',to:'2026-10-04'});
 assert.deepEqual(performancePeriod('all','2026-10-05','2026-01-01'),{from:'2026-01-01',to:'2026-10-05'});
 assert.deepEqual(performancePeriod('custom','2026-10-05','2026-01-01','2026-10-01','2026-12-01'),{from:'2026-10-01',to:'2026-10-05'});
 assert.deepEqual(performancePeriod('custom','2026-10-05','2026-01-01','',''),{from:'2026-10-05',to:'2026-10-05'});
});
test('allocation gap drilldown matches metric groups, filters and PTO rather than inventing effort',()=>{
 const d={...base,research:{records:[map('a','Approved'),map('b','Partner review'),map('c','Approved','s2'),map('d','Approved','s3'),{...map('e','Draft'),submitted_at:null}]},effort:[effort(1,'r','s2'),effort(0,'r','s3')],timeOff:[{staff_id:'s',work_date:'2026-09-27',pto:true}]};
 const gaps=performanceAllocationGaps(d,filter);
 assert.equal(gaps.length,performanceMetrics(d,filter).missing);assert.equal(gaps.length,2);
 assert.equal(gaps.find(g=>g.staff_id==='s')?.mapped,2);assert.equal(gaps.find(g=>g.staff_id==='s')?.reason,'PTO recorded');assert.equal(gaps.find(g=>g.staff_id==='s3')?.reason,'Recorded effort is zero');
 assert.equal(performanceAllocationGaps(d,{...filter,team:'other'}).length,0);assert.equal(performanceAllocationGaps(d,{...filter,from:'2026-09-28'}).length,0);assert.equal(performanceAllocationGaps(d,{...filter,roles:[]}).length,0);
 assert.equal(performanceAllocationGaps({...base,research:{records:[map('a','Approved')]}},filter)[0].reason,'No matching allocation');
});


test('current action queues retain old pending work but respect search, team and researcher scope',()=>{
 const data={research:{records:[map('old','Peer review'),{...map('new','Partner review'),work_date:'2026-10-05'},map('other','Peer review','other','other'),map('return','Needs information'),map('hold','Hold'),{...map('draft','Peer review'),submitted_at:null}]}};
 const f={from:'2026-10-01',to:'2026-10-05',roles:['r'],team:'t',staff:'s'};
 assert.deepEqual(performanceCandidates(data,f,['Peer review','Partner review']).map(r=>r.id),['new']);
 assert.deepEqual(performanceCandidates(data,f,['Peer review','Partner review'],true).map(r=>r.id),['old','new']);
 assert.deepEqual(performanceCandidates(data,f,['Needs information'],true).map(r=>r.id),['return']);
 assert.equal(performanceCandidates(data,{...f,team:'other'},null,true).length,0);
 assert.equal(performanceCandidates(data,{...f,roles:[]},null,true).length,0);
});
