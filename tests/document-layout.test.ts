import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {layoutDocument,pdfLines,freshDocumentPage,DocumentLine} from '../src/document-layout';
import {cleanRolePage} from '../src/role-page';
import {RolePageView} from '../src/RolePageView';
import {RoleBriefEditor} from '../src/RoleBriefEditor';
import {matchCompanyHeaders,companyColumns} from '../src/company-columns';
import readWorkbook from 'read-excel-file/node';
const line=(text:string,y:number,size=12,x=50,width=470):DocumentLine=>({text,y,size,x,width,bold:size>12,page:1});
const source=[line('Synthetic Alpha',790,14),line('Head of Research',745,30),line('Role overview',680,18),line('Lead a research team supporting international clients.',650),line('Build an evidence-based research practice.',635),line('Responsibilities',590,18),line('• Develop research strategies.',560),line('• Coach researchers and review their work.',535),line('• Own client communication.',510),line('• Measure quality and delivery.',485)];
test('document layout preserves words, unwraps body lines and distinguishes title, headings and bullets',()=>{
 const d=layoutDocument(source);assert.equal(d.title,'Head of Research');assert.equal(d.sections[0].heading,'Role overview');assert.equal(d.sections[0].body,'Lead a research team supporting international clients. Build an evidence-based research practice.');assert.match(d.sections[1].body,/strategies\.\n\n• Coach/);
 for(const l of source)assert.ok([d.title,d.subtitle,...d.sections.flatMap(s=>[s.heading,s.body])].join(' ').includes(l.text));
 const p=freshDocumentPage(d,'alpha.pdf','a'.repeat(64));assert.doesNotThrow(()=>cleanRolePage(p));assert.equal(p.partner_name,'');assert.equal(p.client,'');assert.equal(p.video,'');
 const html=renderToStaticMarkup(React.createElement(RolePageView,{preview:true,brief:{title:'Unrelated beta role',client:'Unrelated beta client',page:p}}));assert.ok(!html.includes('Unrelated beta'));assert.ok(html.includes('Synthetic Alpha'));assert.ok(html.includes('role-list-grid'));assert.ok(!html.includes('THE OPPORTUNITY'));
 assert.throws(()=>cleanRolePage({...p,subtitle:'Invented content from another role'}),/only wording/);
});
test('PDF fragments merge into lines without merging widely separated columns',()=>{
 const item=(str:string,x:number,y:number,width:number)=>({str,transform:[12,0,0,12,x,y],width,height:12,fontName:'font'});
 const lines=pdfLines([item('Left',50,700,24),item(' text',74,700,30),item('Right text',340,700,80)],{},1);assert.equal(lines.length,2);assert.equal(lines[0].text,'Left text');assert.equal(lines[1].text,'Right text');
});
test('two-column document reads down each column with source text intact',()=>{
 const left=[0,1,2,3].map(i=>line('Left paragraph '+i,700-i*24,12,50,190));const right=[0,1,2,3].map(i=>line('Right paragraph '+i,700-i*24,12,340,190));const d=layoutDocument([line('Role title',760,28),...left,...right].sort((a,b)=>b.y-a.y||a.x-b.x));assert.ok(d.source_text.indexOf('Left paragraph 3')<d.source_text.indexOf('Right paragraph 0'));assert.doesNotThrow(()=>cleanRolePage(freshDocumentPage(d,'two-columns.pdf','b'.repeat(64))));
});
test('original upload is independent of optional web publishing',()=>{
 const html=renderToStaticMarkup(React.createElement(RoleBriefEditor,{data:{searches:[{id:'r',title:'Other role',client:'Other client'}],research:{records:[],events:[]}},role:'r',manager:true,api:async()=>[],reload:async()=>{},onDirty:()=>{}}));for(const label of ['Save original PDF / Word','Optional: create / edit webpage'])assert.ok(html.toLowerCase().includes(label.toLowerCase()));
});
test('downloadable Excel template is blank and all headers map correctly',async()=>{
 const sheets=await readWorkbook('public/templates/xqtiv-company-import.xlsx');assert.equal(sheets[0].sheet,'Companies');const rows=sheets[0].data;const mapping=matchCompanyHeaders(rows[0]);for(const [key] of companyColumns)assert.equal(typeof mapping[key],'number');assert.ok(rows.slice(1).every(row=>row.every(v=>v===null||v==='')));assert.ok(sheets.find(s=>s.sheet==='Instructions'));
 const old=matchCompanyHeaders(['','','Company','Relevant Tags']);assert.equal(old.name,2);assert.equal(old.tags,3);
});
test('wrapped large titles are kept together without losing document words',()=>{
 const d=layoutDocument([line('Vice President',740,28),line('Research and Analytics',706,28),line('Responsibilities',650,18),line('Lead a research team supporting international clients.',620)]);assert.equal(d.title,'Vice President Research and Analytics');assert.equal(d.sections[0].heading,'Responsibilities');assert.doesNotThrow(()=>cleanRolePage(freshDocumentPage(d,'wrapped.pdf','d'.repeat(64))));
});
