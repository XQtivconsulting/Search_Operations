import test from 'node:test';
import assert from 'node:assert/strict';
import {companyColumns,companyDirectoryRows,employeeBands,revenueBands} from '../src/company-directory';
import {directoryPage} from '../src/candidate-directory';
test('company directory sorts all records before paging and combines taxonomy filters',()=>{
 const rows=Array.from({length:205},(_,i)=>({id:String(i),name:'Company '+(205-i),industries:[i%2?'Energy':'Retail'],sector:'Services'}));
 const sorted=companyDirectoryRows(rows,'',{},'name',false);assert.equal(directoryPage(sorted,0,100).rows[0].name,'Company 1');assert.equal(directoryPage(sorted,1,100).rows[0].name,'Company 101');
 const filtered=companyDirectoryRows(rows,'', {industries:['Energy'],sector:['Services']},'name',false);assert.equal(filtered.length,102);assert.ok(filtered.every(c=>c.industries[0]==='Energy'));
 assert.deepEqual(companyColumns.map(c=>c[1]),['Company','Industry','Sector','Subsector','Revenue','Company size']);
});
test('company bands have graduated ranges and sort by magnitude',()=>{
 assert.equal(employeeBands[9],'4,501–5,000');assert.equal(employeeBands[10],'5,001–6,000');assert.equal(employeeBands[15],'10,001–15,000');assert.equal(employeeBands.at(-1),'More than 50,000');
 const rows=[{id:'a',revenue_band:revenueBands[10]},{id:'b',revenue_band:revenueBands[0]},{id:'c',revenue_band:revenueBands[5]}];assert.deepEqual(companyDirectoryRows(rows,'',{},'revenue_band',false).map(c=>c.id),['b','c','a']);
});
