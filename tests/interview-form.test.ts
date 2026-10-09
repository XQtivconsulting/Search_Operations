import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {InterviewRoundFields} from '../src/InterviewRoundFields';
test('interview form only asks for fields relevant to the selected status',()=>{
 const render=(status:string)=>renderToStaticMarkup(React.createElement(InterviewRoundFields,{round:{status,outcome:'Pending',date:'',interviewer:'Example Interviewer'},onChange:()=>{}}));
 for(const status of ['Not started','Scheduled','Cancelled','Completed']){
  const html=render(status);assert.match(html,/Interview status/);assert.match(html,/Interview date/);assert.match(html,/Interviewer\(s\)/);assert.match(html,/value="Example Interviewer"/);assert.doesNotMatch(html,/Note date|Outcome date|Engagement stage|recommended/);
  assert.equal(html.includes('Date cancelled'),status==='Cancelled');assert.equal(html.includes('Interview outcome'),status==='Completed');
 }
});
