import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {cleanRolePage,sectionsFromText,videoEmbed} from '../src/role-page';
import {RolePageView} from '../src/RolePageView';
import {companySuggestions} from '../src/company-enrichment';
import {planCompanyImport} from '../src/company-import';
import {sendRoleEmail} from '../src/invitation-email';
test('section extraction retains consecutive short paragraphs and rendering escapes document content',()=>{
 const input='Chief executive\n\nSynthetic client\n\nRole overview\n\nThis is a longer sentence describing the opportunity and its responsibilities.\n\nNext steps\n\nTalk to your partner.';
 const sections=sectionsFromText(input),result=sections.map(s=>s.heading+'\n'+s.body).join('\n');for(const text of input.split('\n\n'))assert.ok(result.includes(text));
 const html=renderToStaticMarkup(React.createElement(RolePageView,{brief:{title:'Synthetic role',client:'Example',page:{sections:[{heading:'Overview',body:'<script>alert(1)</script>'}]}}}));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
 assert.throws(()=>cleanRolePage({sections:[{heading:'Role',body:'Text'}],video:'https://evil.example/embed'}),/YouTube or Vimeo/);
 assert.equal(videoEmbed('https://youtube.com/watch?v=abcdefghijk'),'https://www.youtube-nocookie.com/embed/abcdefghijk');assert.equal(videoEmbed('https://youtube.com.evil.example/watch?v=abcdefghijk'),'');
});
test('company import detects identifiers split across different master records',()=>{
 assert.throws(()=>planCompanyImport([{id:'a',version:1,name:'A',website:'https://a.example'},{id:'b',version:1,name:'B',website:'https://b.example'}],[{name:'A',website:'https://b.example'}]),/different companies/);
 const result=planCompanyImport([],[{name:'A',website:'https://a.example',tags:'AI'},{name:'A alternate',website:'https://a.example/',tags:'ai,Data'}]);assert.equal(result.length,1);assert.deepEqual(result[0].tags,['AI','Data']);
});
test('public enrichment uses fixed host, handles absent fields and keeps revenue year and currency',async()=>{
 const transport=async(u:any,init:any)=>{assert.equal(new URL(u).hostname,'www.wikidata.org');assert.equal(init.redirect,'manual');return Response.json(new URL(u).searchParams.get('action')==='wbsearchentities'?{search:[{id:'Q1'}]}:{entities:{Q1:{labels:{en:{value:'Synthetic'}},claims:{P856:[{mainsnak:{datavalue:{value:'https://synthetic.example'}}}],P4264:[{mainsnak:{datavalue:{value:'synthetic'}}}],P2139:[{mainsnak:{datavalue:{value:{amount:'+1000',unit:'http://www.wikidata.org/entity/Q4917'}}},qualifiers:{P585:[{datavalue:{value:{time:'+2024-01-01T00:00:00Z'}}}]}}]}}}});};
 const rows=await companySuggestions('Synthetic',transport as any);assert.equal(rows[0].linkedin,'https://www.linkedin.com/company/synthetic');assert.equal(rows[0].revenue,'1,000 USD');assert.equal(rows[0].revenue_year,'2024');
 await assert.rejects(companySuggestions('Synthetic',(async()=>new Response(null,{status:302})) as any),/unavailable/);
});
test('candidate mail is idempotent per request and never returns provider body or verification secrets',async()=>{
 const config={RESEND_API_KEY:'synthetic',INVITATION_FROM:'invites@example.com'};const transport=async(_:any,init:any)=>{assert.equal(init.headers['Idempotency-Key'],'synthetic-request');assert.equal(init.redirect,'manual');return Response.json({id:'synthetic-message'});};
 assert.equal(await sendRoleEmail(config,'synthetic@example.com','code','123456','synthetic-request',transport as any),'accepted');assert.equal(await sendRoleEmail({},'synthetic@example.com','code','123456','request',transport as any),'not_configured');
 assert.equal(await sendRoleEmail(config,'synthetic@example.com','code','123456','request',(async()=>new Response('Sensitive provider error',{status:500})) as any),'unconfirmed');
});
