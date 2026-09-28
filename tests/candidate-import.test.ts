import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateRows,planCandidates} from '../src/candidate-import';
test('spreadsheet headers and row validation are explicit',()=>{const rows=candidateRows([['First Name','Last Name','LinkedIn URL','Phone'],['Test','Person','https://linkedin.com/in/test','0123']]);assert.equal(rows[0].phone,'0123');assert.equal(planCandidates(rows,[])[0].status,'Create new');assert.throws(()=>candidateRows([['Name'],['Person']]),/Required columns/);assert.throws(()=>candidateRows([['First Name','Last Name','LinkedIn URL','URL'],['T','P','x','x']]),/duplicate columns/);assert.throws(()=>planCandidates([{first_name:'T',last_name:'P',url:'https://linkedin.com/in/test',email:'bad'}],[]),/Row 2/);});
