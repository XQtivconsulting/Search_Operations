import test from 'node:test';
import assert from 'node:assert/strict';
import {companySearchTerms,matchCompany} from '../src/company-search';
test('company keyword search handles conversational prefixes, plurals and any/all semantics using stored metadata',()=>{
 const terms=companySearchTerms('Show me all the companies associated with utilities and energies');assert.deepEqual(terms,['utilities','energy']);
 const energy={name:'Synthetic Renewables',industries:['Renewables'],tags:['Solar']},utility={name:'Synthetic Water',industries:['Water utilities']},unrelated={name:'Synthetic Retail',industries:['Retail']};
 assert.ok(matchCompany(energy,terms).matches);assert.ok(matchCompany(utility,terms).matches);assert.ok(!matchCompany(unrelated,terms).matches);
 assert.ok(!matchCompany(energy,terms,'all').matches);assert.ok(matchCompany({industries:['Utilities'],offerings:['Renewable energy']},terms,'all').matches);
 assert.deepEqual(companySearchTerms('Show me all companies'),[]);assert.ok(matchCompany(unrelated,[]).matches);
 assert.ok(!matchCompany({name:'Retail'},companySearchTerms('AI')).matches);assert.ok(matchCompany({specialties:['Artificial Intelligence']},['ai']).matches);
});
