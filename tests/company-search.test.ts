import test from 'node:test';
import assert from 'node:assert/strict';
import {companySearchTerms,matchCompany} from '../src/company-search';
import {workflowSummary} from '../src/workflow-summary';
test('company keyword search handles conversational prefixes, plurals and any/all semantics using stored metadata',()=>{
 const terms=companySearchTerms('Show me all the companies associated with utilities and energies');assert.deepEqual(terms,['utilities','energy']);
 const energy={name:'Synthetic Renewables',industries:['Renewables'],tags:['Solar']},utility={name:'Synthetic Water',industries:['Water utilities']},unrelated={name:'Synthetic Retail',industries:['Retail']};
 assert.ok(matchCompany(energy,terms).matches);assert.ok(matchCompany(utility,terms).matches);assert.ok(!matchCompany(unrelated,terms).matches);
 assert.ok(!matchCompany(energy,terms,'all').matches);assert.ok(matchCompany({industries:['Utilities'],offerings:['Renewable energy']},terms,'all').matches);
 assert.deepEqual(companySearchTerms('Show me all companies'),[]);assert.ok(matchCompany(unrelated,[]).matches);
 assert.ok(!matchCompany({name:'Retail'},companySearchTerms('AI')).matches);assert.ok(matchCompany({specialties:['Artificial Intelligence']},['ai']).matches);
});
test('workflow summary separates company scope completion, mapped coverage and independent role review queues',()=>{
 const data={searches:[{id:'r',client:'Example',title:'Role',partner_id:'p'}],research:{records:[{kind:'strategy',role_id:'r',active:'Approved'},{kind:'target',id:'c1',role_id:'r',status:'Completed',owner_id:'u'},{kind:'target',id:'c2',role_id:'r',status:'No relevant talent',owner_id:'u'},{kind:'target',id:'c3',role_id:'r',status:'Blocked',team_id:'blue'},{kind:'mapping',role_id:'r',candidate_id:'a',target_id:'c1',status:'Approved',submitted_at:'2026-09-25',stage_at:'2026-09-25'},{kind:'mapping',role_id:'r',candidate_id:'b',target_id:'c1',status:'Peer review',submitted_at:'2026-09-26',stage_at:'2026-09-26'},{kind:'mapping',role_id:'r',candidate_id:'c',target_id:'',status:'Partner review',submitted_at:'2026-09-27',stage_at:'2026-09-27'},{kind:'mapping',role_id:'r',candidate_id:'d',target_id:'c3',status:'Draft'}]}};
 const r=workflowSummary(data,Date.parse('2026-09-28'))[0];assert.equal(r.targets,3);assert.equal(r.completed,2);assert.equal(r.withMappings,1);assert.equal(r.submitted,3);assert.equal(r.drafts,1);assert.equal(r.approved,1);assert.equal(r.direct,1);assert.equal(r.oldest,2);assert.ok(r.bottlenecks.includes('1 company needs a researcher'));assert.ok(r.bottlenecks.includes('1 company is blocked'));
});
test('workflow monitor renders search summaries without detailed company or candidate rows',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{WorkflowMonitor}=await import('../src/WorkflowMonitor');
 const html=renderToStaticMarkup(React.createElement(WorkflowMonitor,{data:{searches:[{id:'r',client:'Example Client',title:'Role'}],research:{records:[{id:'target',kind:'target',role_id:'r',name:'Detailed Company',status:'Not started'}]}},onOpen:()=>{}}));
 assert.ok(html.includes('Example Client'));assert.ok(html.includes('Company coverage'));assert.ok(html.includes('Coverage &amp; assignments'));assert.ok(!html.includes('Detailed Company'));assert.ok(!html.includes('Uncategorized'));
});
