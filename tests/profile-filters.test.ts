import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeTranscript} from '../src/transcript-summary';
import {matchesSearchStatus,searchStatusOptions} from '../src/SearchFilters';
test('automatic transcript summaries are bounded source excerpts, never invented conclusions',()=>{
 const source=Array.from({length:30},(_,i)=>`Speaker ${i}: We discussed the search and the candidate's experience on project ${i}.`).join('\n');
 const result=summarizeTranscript(source);assert.equal(result.length,5);for(const line of result)assert.ok(source.includes(line));assert.deepEqual(summarizeTranscript(''),[]);assert.deepEqual(summarizeTranscript('Short note'),['Short note']);assert.ok(summarizeTranscript('x'.repeat(5000))[0].length<=481);
});
test('search status filter includes CRM extensions, aliases and explicit all',()=>{
 const searches=[{status:'Opened'},{status:'Canceled'},{status:'On hold'},{status:'Closed'}];
 assert.ok(matchesSearchStatus(searches[0],'open'));assert.ok(matchesSearchStatus(searches[1],'cancelled'));assert.ok(!matchesSearchStatus(searches[3],'open'));assert.ok(matchesSearchStatus(searches[3],'all'));assert.ok(searchStatusOptions(searches).some(([key])=>key==='on hold'));assert.equal(searchStatusOptions(searches).filter(([key])=>key==='open').length,1);
});
