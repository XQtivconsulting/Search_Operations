import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CompanyProfile} from '../src/CompanyProfile';
import {exactCompanyWebsite} from '../src/company-website-match';
test('website autofill requires one exact named HTTPS match and refuses ambiguity',()=>{
 const row={name:'Example Company',website:'https://example.com/'};
 assert.equal(exactCompanyWebsite(' example company ',[row]),row);
 for(const rows of [[{...row,name:'Example Company Holdings'}],[row,row],[{...row,website:'javascript:alert(1)'}],[{...row,website:'https://user:secret@example.com'}]])assert.equal(exactCompanyWebsite('Example Company',rows),undefined);
});
test('company profile contains only the agreed editable fields and supports read-only viewing',()=>{
 const props={edit:{id:'synthetic',name:'Example Company',website:'https://example.com'},setEdit:()=>{},records:[],api:async()=>[],busy:false,error:'',onSave:()=>{},onClose:()=>{}};
 const html=renderToStaticMarkup(React.createElement(CompanyProfile,props));
 for(const label of ['Company name','Industry','Sector','Subsector','Revenue (USD)','Company size','Website'])assert.ok(html.includes(label),label);
 for(const label of ['Other company details','Known aliases','Revenue year','Service offerings','Specialties','LinkedIn'])assert.ok(!html.includes(label),label);
 const readOnly=renderToStaticMarkup(React.createElement(CompanyProfile,{...props,readOnly:true}));assert.ok(readOnly.includes('fieldset disabled'));assert.ok(!readOnly.includes('Save company'));
});
