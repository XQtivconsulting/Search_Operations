import test from 'node:test';
import assert from 'node:assert/strict';
import {geographyLabels,lookupGeography,signGeography,verifyGeographies} from '../src/geography-lookup';
import {geographyCode,geographyParents} from '../src/candidate-geography';
import {cleanTagValues,candidateSearchIndex,tagOptions} from '../src/candidate-tags';
import {directoryRows} from '../src/candidate-directory';
const locations={features:[
 {properties:{name:'Lucknow',state:'Uttar Pradesh',countrycode:'IN',type:'city'}},
 {properties:{name:'North Caldwell',state:'New Jersey',countrycode:'US',type:'city'}},
 {properties:{name:'New Jersey',state:'New Jersey',countrycode:'US',type:'state'}},
 {properties:{name:'United States of America',countrycode:'US',type:'country'}},
 {properties:{name:'North Caldwell',state:'New Jersey',countrycode:'US',type:'city'}},
 {properties:{name:'Private house',state:'New Jersey',countrycode:'US',type:'house'}},
 {properties:{name:'Unknown',countrycode:'XX',type:'city'}},
]};
test('location normalization retains locality/state/country, deduplicates and excludes addresses',()=>{
 assert.deepEqual(geographyLabels(locations),['Lucknow, Uttar Pradesh, India','North Caldwell, New Jersey, United States','New Jersey, United States','United States']);
 assert.equal(geographyCode('North Caldwell, New Jersey, United States'),'North Caldwell, New Jersey, US');
 assert.deepEqual(geographyParents('Lucknow, Uttar Pradesh, India'),['Lucknow, Uttar Pradesh, India','Uttar Pradesh, India','India']);
});
test('location selection proof is bound to session/tenant, expires and cannot be altered',async()=>{
 const choice=await signGeography('North Caldwell, New Jersey, United States','synthetic-session','tenant-a');
 assert.deepEqual(await verifyGeographies([choice],'synthetic-session','tenant-a'),[choice.label]);
 await assert.rejects(verifyGeographies([choice],'other-session','tenant-a'),/suggestions/);
 await assert.rejects(verifyGeographies([choice],'synthetic-session','tenant-b'),/suggestions/);
 await assert.rejects(verifyGeographies([{...choice,label:'Unrecognized'}],'synthetic-session','tenant-a'),/suggestions/);
 await assert.rejects(verifyGeographies([{...choice,expires:0}],'synthetic-session','tenant-a'),/expired/);
 await assert.rejects(verifyGeographies([null],'synthetic-session','tenant-a'),/expired/);
});
test('verified locations save without losing specificity and country/state filters include descendants only',()=>{
 const labels=geographyLabels(locations),records=labels.map((v,i)=>({id:String(i),kind:'candidate',tag_values:cleanTagValues({geography:[v]},[],labels)}));
 assert.throws(()=>cleanTagValues({geography:[labels[0]]},[]),/standardized/);
 assert.equal(records[0].tag_values.geography[0],labels[0]);
 assert.ok(tagOptions(records,'geography').includes('Uttar Pradesh, India'));
 const index=candidateSearchIndex(records,[]);
 const filtered=(geo:string)=>directoryRows(records,'',{'tag:geography':JSON.stringify([geo])},'tag:geography',false,new Map(),index,records).map(c=>c.id).sort();
 assert.deepEqual(filtered('India'),['0']);
 assert.deepEqual(filtered('United States'),['1','2','3']);
 assert.deepEqual(filtered('New Jersey, United States'),['1','2']);
 assert.deepEqual(filtered(labels[1]),['1']);
 assert.equal(directoryRows(records,'North Caldwell US',{},'first_name',false,new Map(),index,records).length,1);
 assert.equal(directoryRows(records,'Lucknow India',{},'first_name',false,new Map(),index,records).length,1);
});
test('lookup sends only query to fixed provider and reports provider failure without fabricated choices',async()=>{
 let calls=0;
 const transport=(async(url:any,options:any)=>{calls++;assert.equal(url.origin,'https://photon.komoot.io');assert.equal(url.searchParams.get('q'),'Lucknow');assert.equal(options.redirect,'error');return Response.json(locations);}) as typeof fetch;
 assert.deepEqual(await lookupGeography('Lucknow',transport),geographyLabels(locations));
 assert.deepEqual(await lookupGeography('USA',transport),['United States']);assert.equal(calls,1);
 await assert.rejects(lookupGeography('A',transport),/2–120/);
 await assert.rejects(lookupGeography('Lucknow',(async()=>new Response('',{status:503})) as typeof fetch),/unavailable/);
});
test('ambiguous country/state names retain both suggestions',async()=>{
 const response={features:[{properties:{name:'Georgia',state:'Georgia',countrycode:'US',type:'state'}},{properties:{name:'Georgia',countrycode:'GE',type:'country'}}]};
 assert.deepEqual(await lookupGeography('Georgia',(async()=>Response.json(response)) as typeof fetch),['Georgia, United States','Georgia']);
 assert.deepEqual(await lookupGeography('France',(async()=>new Response('',{status:503})) as typeof fetch),['France']);
});
