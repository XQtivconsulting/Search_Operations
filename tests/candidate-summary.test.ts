import test from 'node:test';
import assert from 'node:assert/strict';
import {profileSuggestions} from '../src/candidate-summary';
test('summary suggestions keep source evidence and do not infer sensitive or compensation tags',()=>{
 const result=profileSuggestions([{name:'Interview.txt',text:'I lead enterprise sales and account management for healthcare clients. I have never worked in banking. Interviewer: Are you interested in marketing?\nI have delivered complex customer programmes and built a team of twenty people.'}],[]);
 assert.ok(result.summary.includes('enterprise sales'));assert.ok(result.suggestions.some(s=>s.value==='Healthcare'));assert.ok(result.suggestions.some(s=>s.value==='Enterprise Sales'));
 assert.ok(!result.suggestions.some(s=>s.value==='Banking & Financial Services'||s.value==='Marketing'||s.category==='compensation'||s.category==='geography'));
 assert.ok(result.suggestions.every(s=>s.source==='Interview.txt'&&s.evidence));
});
