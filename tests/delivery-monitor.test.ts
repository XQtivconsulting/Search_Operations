import test from 'node:test';
import assert from 'node:assert/strict';
const data={actor:{role:'planner'},searches:[{id:'r',client:'Client',title:'Role'}],teams:[{id:'t',name:'Team'}],staff:[{id:'s',name:'Person'}],assignments:[{id:'a',search_id:'r',team_id:'t',work_date:'2026-09-28',target:5}],entries:[{assignment_id:'a',search_id:'r',team_id:'t',staff_id:'s',work_date:'2026-09-28',mapped:2,peer:0,partner:0}],research:{records:[{id:'m',kind:'mapping',role_id:'r',team_id:'t',staff_id:'s',work_date:'2026-09-28',status:'Peer review'},{id:'old',kind:'mapping',role_id:'r',work_date:'2026-08-01',status:'Hold'},{id:'done',kind:'mapping',role_id:'r',status:'Approved'}]}};
test('cumulative monitor opens a daily search drilldown without pipeline navigation',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{DeliveryMonitor}=await import('../src/DeliveryMonitor');
 const html=renderToStaticMarkup(React.createElement(DeliveryMonitor,{data,onOpen:()=>{},onCandidate:()=>{},onAllocate:()=>{}}));
 for(const text of ['Find search','Approval target to date','Effort hours','Days since first map','Throughput','Quality','Daily progress for Role'])assert.ok(html.includes(text),text);
 const detail=renderToStaticMarkup(React.createElement(DeliveryMonitor,{data,initialState:{searchId:'r',period:'all'},onOpen:()=>{},onCandidate:()=>{}}));
 for(const text of ['Cumulative approvals against plan','Daily mapping and approval results','Daily quality','Researchers · selected period','Share of approvals','Mapping date'])assert.ok(detail.includes(text),text);
 for(const text of ['Candidate reviews','All outstanding','Adjust allocation','delivery-summary','This week'])assert.ok(!html.includes(text),text);
});
