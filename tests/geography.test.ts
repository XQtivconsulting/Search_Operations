import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupGeography,signGeography,verifyGeographies} from '../src/geography-lookup';
import {geographyCode,geographyParents} from '../src/candidate-geography';
import {cleanTagValues,candidateSearchIndex,tagOptions} from '../src/candidate-tags';
import {directoryRows} from '../src/candidate-directory';
import {locationText,locationShard,type LocationEntry} from '../src/geography-catalog';
const labels=['Lucknow, Uttar Pradesh, India','North Caldwell, New Jersey, United States','New Jersey, United States','United States'];
const entries:LocationEntry[]=[
 [labels[0],locationText(labels[0]+' IN UP'), 'lucknow','city'],
 [labels[1],locationText(labels[1]+' US USA NJ'),'north caldwell','city'],
 [labels[2],locationText(labels[2]+' NJ US USA'),'new jersey','state','nj'],
 ['Georgia, United States','georgia united states us ga','georgia','state']
];
const loader=async(key:string)=>key==='index'?{states:entries.filter(e=>e[3]==='state'),shards:entries.filter(e=>e[3]==='city').map(e=>locationShard(e[2]))}:entries.filter(e=>e[3]==='city'&&locationShard(e[2])===key);
test('catalog recognition retains locality/state/country and matches administrative abbreviations',async()=>{
 assert.deepEqual(await lookupGeography('Lucknow',loader),[labels[0]]);
 assert.deepEqual(await lookupGeography('North Caldwell NJ',loader),[labels[1]]);
 assert.deepEqual(await lookupGeography('New Jersey',loader),[labels[2]]);
 assert.deepEqual(await lookupGeography('NJ',loader),[labels[2]]);
 assert.equal(geographyCode(labels[1]),'North Caldwell, New Jersey, US');
 assert.deepEqual(geographyParents(labels[0]),[labels[0],'Uttar Pradesh, India','India']);
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
 const records=labels.map((v,i)=>({id:String(i),kind:'candidate',tag_values:cleanTagValues({geography:[v]},[],labels)}));
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
test('catalog failures retain country selection without fabricating a city',async()=>{
 assert.deepEqual(await lookupGeography('USA',loader),['United States']);
 await assert.rejects(lookupGeography('A',loader),/2–120/);
 await assert.rejects(lookupGeography('Lucknow',async()=>{throw Error('Unavailable');}),/unavailable/);
 assert.deepEqual(await lookupGeography('France',async()=>{throw Error('Unavailable');}),['France']);
 assert.deepEqual(await lookupGeography('Nonexistent place',loader),[]);
});
test('ambiguous country/state names retain both suggestions',async()=>{
 assert.deepEqual(await lookupGeography('Georgia',loader),['Georgia','Georgia, United States']);
});
