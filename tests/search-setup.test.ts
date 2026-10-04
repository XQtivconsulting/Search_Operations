import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryRows,candidateColumns} from '../src/candidate-directory';
import {companyChildOptions} from '../src/company-taxonomy';
import {matchesAge} from '../src/candidate-demographics';
test('age and gender filters combine without becoming candidate table columns',()=>{
 const rows=[{id:'1',age:29,gender:'Female'},{id:'2',age:30,gender:'Female'},{id:'3',age:39,gender:'Male'},{id:'4',age:40},{id:'5'}];
 assert.deepEqual(directoryRows(rows,'',{age:'30–39',gender:'Female'},'id',false,new Map()).map(r=>r.id),['2']);
 assert.deepEqual(directoryRows(rows,'',{age:'Not recorded',gender:'Not recorded'},'id',false,new Map()).map(r=>r.id),['5']);
 assert.equal(matchesAge(59,'50–59'),true);assert.equal(matchesAge(60,'50–59'),false);assert.equal(matchesAge(60,'60+'),true);assert.equal(matchesAge(null,'Under 30'),false);
 assert.ok(!candidateColumns.some(([key])=>['age','gender'].includes(key)));
});
test('company classification cascades by industry then sector',()=>{
 const records=[{kind:'company',industries:['Technology'],sector:'Software',subsector:'SaaS'},{kind:'company',industries:['Technology'],sector:'Hardware',subsector:'Chips'},{kind:'company',industries:['Healthcare'],sector:'Providers',subsector:'Hospitals'}];
 assert.deepEqual(companyChildOptions(records,[]),{sectors:[],subsectors:[]});
 assert.deepEqual(companyChildOptions(records,['technology'],'Software'),{sectors:['Hardware','Software'],subsectors:['SaaS']});
 assert.deepEqual(companyChildOptions(records,['Healthcare'],'Providers'),{sectors:['Providers'],subsectors:['Hospitals']});
});

test('assigned search view uses company/task ownership and planned person allocations',async()=>{
 const {assignedSearchIds}=await import('../src/repository-views');
 const ids=assignedSearchIds({actor:{id:'me',staffId:'s',role:'researcher'},searches:[],assignments:[{id:'a',search_id:'planned'},{id:'b',search_id:'others'}],entries:[{assignment_id:'a',staff_id:'s'},{assignment_id:'b',staff_id:'x'}],research:{records:[{kind:'target',role_id:'company',owner_id:'me'},{kind:'task',role_id:'task',owner_id:'me'},{kind:'mapping',role_id:'mapped-only',mapper_id:'me'},{kind:'target',role_id:'other-company',owner_id:'someone'}]}});
 assert.deepEqual([...ids].sort(),['company','planned','task']);
});
test('coverage flags completed mismatches and need-help, not normal unfinished work',async()=>{
 const {coverageAlert}=await import('../src/company-coverage');const t={id:'t',company_id:'c',role_id:'r',status:'In progress',expected:2};
 assert.equal(coverageAlert(t,[]),'');assert.match(coverageAlert({...t,status:'Completed'},[]),/0 approved \/ 2 planned/);assert.match(coverageAlert({...t,status:'Need help'},[]),/Need help/);assert.match(coverageAlert({...t,coverage_flag:true},[]),/mismatch/);assert.equal(coverageAlert({...t,status:'Completed',expected:0},[]),'');assert.equal(coverageAlert({...t,status:'Completed',expected:null},[]),'');
});
test('repository starts compact and entry is a company-aware dialog',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');const {ResearchPanel}=await import('../src/ResearchPanel'),{MappingForm}=await import('../src/Candidates');
 const data={actor:{id:'me',role:'researcher',staffId:'s'},searches:[{id:'r',title:'Synthetic Search',status:'Open'}],teams:[{id:'t',name:'Team'}],team_members:[{team_id:'t',staff_id:'s'}],assignments:[],entries:[],people:[],research:{records:[{id:'target',kind:'target',role_id:'r',company_id:'co',name:'Synthetic Co',team_id:'t',owner_id:'me',status:'In progress'},{id:'co',kind:'company',name:'Synthetic Co'},{id:'c',kind:'candidate',name:'Synthetic Candidate',url:'https://linkedin.com/in/synthetic'},{id:'m',kind:'mapping',role_id:'r',candidate_id:'c',name:'Synthetic Candidate',mapper_id:'me',status:'Draft'}],events:[]}};
 const common={data,api:async()=>({}),reload:async()=>{},onDirty:()=>{}};
 const html=renderToStaticMarkup(React.createElement(ResearchPanel,{...common,view:'Search repository',initialRole:'r'}));assert.ok(html.includes('My mappings'));assert.ok(html.includes('All candidates'));assert.ok(html.includes('Open Synthetic Candidate on LinkedIn'));assert.ok(!html.includes('Minimum total'));assert.ok(!html.includes('Candidate filters'));assert.ok(!html.includes('Search ID:'));
 const form=renderToStaticMarkup(React.createElement(MappingForm,{...common,initialRole:'r',targetId:'target',onClose:()=>{}}));assert.ok(form.includes('role="dialog"'));assert.ok(form.includes('aria-label="Add candidates"'));assert.ok(form.includes('value="Synthetic Co"'));
});
