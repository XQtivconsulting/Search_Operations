import test from 'node:test';
import assert from 'node:assert/strict';
import read from 'read-excel-file/node';
import {candidateRows} from '../src/candidate-import';
import {workbookSearchRows,searchCandidateRows} from '../src/search-import';
test('shared workbook has compatible search and candidate headers without example data',async()=>{
 const wb=await read('public/templates/xqtiv-search-candidate-import.xlsx');
 const searches=wb.find(s=>s.sheet==='Searches')!.data,candidates=wb.find(s=>s.sheet==='Candidates')!.data;
 assert.deepEqual(workbookSearchRows(searches),[]);assert.deepEqual(searchCandidateRows(candidates),[]);
 const grid=[candidates[0],[201,'Alex','Example','linkedin.com/in/example']];
 assert.deepEqual(candidateRows(grid),searchCandidateRows(grid));
 assert.equal(candidateRows(grid)[0].search_number,'201');
 assert.equal(workbookSearchRows([searches[0],[201,'Example role','Example client','Closed']])[0].title,'Example role');
});
