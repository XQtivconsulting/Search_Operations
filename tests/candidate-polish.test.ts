import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {linkedin,candidateMatches,sameLinkedin} from '../src/candidate-identity';
import {SortableTable} from '../src/SortableTable';
import {ViewStateProvider} from '../src/ViewState';
import {LinkedInIcon} from '../src/LinkedInIcon';
import {MappingForm} from '../src/Candidates';
const h=React.createElement;
test('LinkedIn identity ignores scheme, www, whitespace, tracking, case and trailing slash',()=>{
 const expected='https://www.linkedin.com/in/synthetic-person';
 for(const input of ['www.linkedin.com/in/Synthetic-Person','linkedin.com/in/synthetic-person/','http://linkedin.com/in/synthetic-person?trk=test',' https://www.linkedin.com /in/synthetic- person ','https://m.linkedin.com/in/synthetic-person#about','https://linkedin.com/in/synthetic-%20person'])assert.equal(linkedin(input),expected);
 for(const input of ['https://linkedin.com.evil.test/in/example','https://evil.test/in/example','https://name:secret@linkedin.com/in/example','https://linkedin.com/company/example','javascript:alert(1)','https://linkedin.com/in/a%2Fb'])assert.throws(()=>linkedin(input));
 assert.equal(sameLinkedin('linkedin.com/in/a-person','https://www.linkedin.com/in/a-person/'),true);
 assert.equal(sameLinkedin('',''),false);
});
test('similar people are suggestions, never exact identity matches',()=>{
 const records=[{id:'1',name:'Alex Sample',first_name:'Alex',last_name:'Sample',url:'https://linkedin.com/in/alex-sample'},{id:'2',name:'Alex Sample',first_name:'Alex',last_name:'Sample',url:'https://linkedin.com/in/alex-other'}];
 const names=candidateMatches(records,{first_name:'Alex',last_name:'Sampel'});assert.equal(names.length,2);
 const similar=candidateMatches(records,{first_name:'Alex',last_name:'Sample',url:'linkedin.com/in/alex-sampl'});assert.equal(similar.length,2);assert.ok(similar.every(m=>!m.exact));
 assert.equal(candidateMatches(records,{url:'www.linkedin.com/in/ALEX-SAMPLE '})[0].candidate.id,'1');assert.equal(candidateMatches(records,{url:'www.linkedin.com/in/ALEX-SAMPLE '})[0].exact,true);
 assert.equal(candidateMatches(records,{first_name:'Al',last_name:''}).length,0);
});
function table(rows:any[],column:number,descending:boolean,page=0){return renderToStaticMarkup(h(ViewStateProvider,{state:{test:{column,descending}},change:()=>{},children:h(SortableTable,{stateKey:'test',page,pageSize:25},h('thead',null,h('tr',null,h('th',null,'Name'),h('th',null,'Score'),h('th',null,'Actions'))),h('tbody',null,rows.map(r=>h('tr',{key:r.id},h('td',null,r.name),h('td',{'data-sort-value':r.score},r.score??'—'),h('td',null,h('button',null,'Open'))))))}));}
test('table headers sort the full dataset before pagination, numerically and with blanks last',()=>{
 const rows=Array.from({length:61},(_,i)=>({id:i,name:'Candidate '+i,score:i===0?null:i}));
 const first=table(rows,1,true),second=table(rows,1,true,1),last=table(rows,1,true,2);
 assert.ok(first.indexOf('Candidate 60')<first.indexOf('Candidate 59'));assert.ok(!first.includes('Candidate 35<'));assert.ok(second.includes('Candidate 35<'));assert.ok(!second.includes('Candidate 60<'));assert.ok(last.includes('Candidate 0<'));
 assert.match(first,/aria-sort="descending"/);assert.ok(!first.includes('>Actions <span'));
 const alphabetical=table(rows,0,false);assert.ok(alphabetical.indexOf('Candidate 2<')<alphabetical.indexOf('Candidate 10<'));
});
test('LinkedIn links are icon-only, accessible and normalized',()=>{
 const html=renderToStaticMarkup(h(LinkedInIcon,{url:'linkedin.com/in/synthetic-person',name:'Synthetic Person'}));assert.ok(html.includes('<svg'));assert.ok(html.includes('aria-label="Open Synthetic Person on LinkedIn"'));assert.ok(!html.includes('>LinkedIn profile<'));assert.ok(html.includes('href="https://www.linkedin.com/in/synthetic-person"'));
});
test('candidate entry automatically uses a single team and only asks when several are available',()=>{
 const data:any={actor:{id:'me',staffId:'staff'},searches:[{id:'r',title:'Synthetic search'}],teams:[{id:'t',name:'Team One'}],team_members:[{team_id:'t',staff_id:'staff'}],research:{records:[]}};
 const render=()=>renderToStaticMarkup(h(MappingForm,{data,api:async()=>({}),reload:async()=>{},onClose:()=>{},initialRole:'r'}));
 assert.ok(!render().includes('Research team'));
 data.teams.push({id:'t2',name:'Team Two'});data.team_members.push({team_id:'t2',staff_id:'staff'});assert.ok(render().includes('Research team'));
});
