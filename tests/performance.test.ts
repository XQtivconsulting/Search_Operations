import test from 'node:test';import assert from 'node:assert/strict';
import {researcherComparisons,performanceCandidates,performanceMetrics,performancePeriod,performanceAllocationGaps} from '../src/performance';
const base={assignments:[],entries:[],effort:[],research:{records:[]}};
const map=(id:string,status:string,staff_id='s',role_id='r')=>({id,kind:'mapping',status,partner_decision:status==='Rejected'?'Reject':status==='Approved'?'Approve':null,staff_id,role_id,team_id:'t',work_date:'2026-09-27',submitted_at:'2026-09-27T12:00:00Z'});
const effort=(days:number,search_id='r',staff_id='s')=>({search_id,staff_id,team_id:'t',work_date:'2026-09-27',days});
const filter={from:'',to:'',roles:null,team:''};
test('quality counts current partner decisions and keeps pending and drafts separate',()=>{
 const d={...base,research:{records:[map('a','Approved'),map('b','Rejected'),map('c','Peer review'),map('d','Partner review'),map('e','Hold'),map('f','Needs information'),{...map('g','Draft'),submitted_at:null}]},effort:[effort(1)]};
 const m=performanceMetrics(d,filter);assert.equal(m.mapped,7);assert.equal(m.reviewed,2);assert.equal(m.quality,.5);assert.equal(m.pending,2);assert.equal(m.returned,2);assert.equal(m.throughput,7);assert.equal(m.yield,1);assert.equal(m.approvalRatio,1/7);
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
test('performance renders definitions, separate tabs and no invented historical effort',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{Performance}=await import('../src/Performance');
 const data={...base,actor:{role:'partner'},searches:[{id:'r',client:'Client',title:'Role'}],teams:[],staff:[{id:'s',name:'Researcher'}],priorities:[],research:{records:[map('a','Approved')]}};
 const html=renderToStaticMarkup(React.createElement(Performance,{data,api:async()=>{},reload:async()=>{},onDirty:()=>{},onDecision:()=>{}}));
 assert.ok(html.includes('Search effort &amp; yield'));assert.ok(html.includes('Partner approval rate'));assert.ok(html.includes('partner-decided'));assert.ok(html.includes('Last month'));assert.ok(!html.includes('person-days (plan-based)'));assert.ok(!html.includes('work entries without allocated effort'));
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
 assert.deepEqual(performanceCandidates(data,f,['Peer review','Partner review'],true).map(r=>r.id),['old','new','draft']);
 assert.deepEqual(performanceCandidates(data,f,['Needs information'],true).map(r=>r.id),['return']);
 assert.equal(performanceCandidates(data,{...f,team:'other'},null,true).length,0);
 assert.equal(performanceCandidates(data,{...f,roles:[]},null,true).length,0);
});


test('researchers compare only within the same search and team, including zero-output members',()=>{
 const records=[...Array.from({length:6},(_,i)=>map('a'+i,'Approved')),...Array.from({length:4},(_,i)=>map('b'+i,'Partner review','s2')),map('other','Approved','s','other'),{...map('otherteam','Approved','s'),team_id:'t2'}];
 const d={...base,staff:[{id:'s',name:'One'},{id:'s2',name:'Two'},{id:'s3',name:'Three'}],team_members:[{team_id:'t',staff_id:'s'},{team_id:'t',staff_id:'s2'},{team_id:'t',staff_id:'s3'}],research:{records}};
 const group=researcherComparisons(d,filter).find(g=>g.role==='r'&&g.team==='t')!;
 assert.equal(group.total.mapped,10);assert.deepEqual(group.rows.map(r=>r.share),[.6,.4,0]);
 assert.equal(group.rows.reduce((n,r)=>n+(r.share||0),0),1);
 assert.equal(group.rows[0].quality,1);assert.equal(group.rows[0].approvalShare,1);assert.equal(group.rows[1].quality,null);
 assert.equal(researcherComparisons(d,{...filter,roles:['other']})[0].total.mapped,1);
 assert.equal(researcherComparisons(d,{...filter,from:'2026-09-28'}).length,0);
 // Filtering one person must not change the team's denominator.
 assert.equal(researcherComparisons(d,{...filter,staff:'s2'}).find(g=>g.role==='r'&&g.team==='t')!.rows[0].share,.4);
});
test('quality excludes peer rejections and reopened decisions; drafts count toward contribution',()=>{
 const d={...base,research:{records:[map('approved','Approved'),map('partnerRejected','Rejected'),{...map('peerRejected','Rejected'),partner_decision:null,peer_decision:'Reject'},{...map('reopened','Needs information'),partner_decision:'Approve'},{...map('draft','Draft'),submitted_at:null,work_date:null,created_at:'2026-09-27T12:00:00Z'}]}};
 const m=performanceMetrics(d,{...filter,from:'2026-09-27',to:'2026-09-27'});
 assert.equal(m.mapped,5);assert.equal(m.draft,1);assert.equal(m.reviewed,2);assert.equal(m.quality,.5);
 assert.equal(performanceCandidates(d,{...filter,from:'2026-09-27',to:'2026-09-27'}).length,5);
});
test('estimated hours per approval uses eight hours per person-day and no fabricated effort',()=>{
 const d={...base,research:{records:[map('a','Approved'),map('b','Approved')]},effort:[effort(3)]};
 assert.equal(performanceMetrics(d,filter).hoursPerApproved,12);
 const partial={...d,research:{records:[...d.research.records,map('unallocated','Approved','s2')]}};
 const result=performanceMetrics(partial,filter);assert.equal(result.missing,1);assert.equal(result.hoursPerApproved,8);
 assert.equal(performanceMetrics({...d,effort:[]},filter).hoursPerApproved,null);
 assert.equal(performanceMetrics({...d,research:{records:[]}},filter).hoursPerApproved,null);
 assert.equal(performanceMetrics({...d,effort:[effort(0)]},filter).hoursPerApproved,null);
});
test('dashboard shows per-search contributions without thresholds or aggregate researcher scores',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{Performance}=await import('../src/Performance');
 const data={...base,actor:{role:'partner'},searches:[{id:'r',client:'Client',title:'Role'}],teams:[],staff:[{id:'s',name:'Researcher'}],priorities:[],research:{records:[map('a','Approved')]}};
 const html=renderToStaticMarkup(React.createElement(Performance,{data,api:async()=>{},reload:async()=>{},onDirty:()=>{},onDecision:()=>{}}));
 assert.ok(html.includes('By researcher'));assert.ok(html.includes('Find researcher'));assert.ok(!html.includes('Partial effort'));assert.ok(html.includes('Throughput share'));assert.ok(html.includes('Partner approval rate'));assert.ok(html.includes('Share of approvals'));assert.ok(html.includes('This quarter'));
 assert.ok(!html.includes('threshold'));assert.ok(!html.includes('Overall'));assert.ok(!html.includes('Effort incomplete'));
});

test('visual colors distinguish percentages, relative contributions and lower effort without inventing missing values',async()=>{
 const {percentageTone,contributionTone,efficiencyTone}=await import('../src/performance');
 assert.equal(percentageTone(null),'neutral');assert.equal(percentageTone(0),'red');assert.equal(percentageTone(.6),'yellow');assert.equal(percentageTone(.9),'green');
 assert.equal(contributionTone(.4,[.4,.3,.1,0]),'green');assert.equal(contributionTone(.2,[.4,.3,.2,0]),'yellow');assert.equal(contributionTone(0,[0,0]),'neutral');
 assert.equal(efficiencyTone(8,[8,16,24]),'green');assert.equal(efficiencyTone(16,[8,16,24]),'yellow');assert.equal(efficiencyTone(24,[8,16,24]),'red');assert.equal(efficiencyTone(8,[8,8]),'neutral');
});
