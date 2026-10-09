import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../extensions/profile-mapper/content.js',import.meta.url),'utf8');
function parser(){const context=vm.createContext({chrome:{runtime:{onMessage:{addListener(){}}}},URL});vm.runInContext(source,context);return context;}
test('profile extraction pairs the title and company from the same current experience entry',async()=>{
 const context=parser();
 vm.runInContext(`globalThis.document={querySelector:()=>({})};globalThis.locationHref=()=> 'https://www.linkedin.com/in/test/?tracking=1';
 globalThis.extractStructuredProfile=()=>({});globalThis.extractName=()=> 'Test Person';globalThis.extractLocation=()=> 'Test City';
 const current={querySelectorAll:()=>[{textContent:'Sales Director'},{textContent:'Example Systems · Full-time'},{textContent:'Jan 2024 - Present'}]};
 globalThis.findCurrentExperienceItem=()=>current;
 globalThis.extractCompanyFromExperienceItem=item=>{if(item!==current)throw Error('Wrong entry');return 'Example Systems';};`,context);
 const result=await vm.runInContext('extractProfile()',context);assert.equal(result.company,'Example Systems');assert.equal(result.currentTitle,'Sales Director');assert.equal(result.linkedinUrl,'https://www.linkedin.com/in/test/');
 vm.runInContext('globalThis.findCurrentExperienceItem=()=>null',context);const missing=await vm.runInContext('extractProfile()',context);assert.equal(missing.company,'');assert.equal(missing.currentTitle,'');
});
test('extension has only the XRP host grant and no cookie, clipboard or broad site permissions',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../extensions/profile-mapper/manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.host_permissions,['https://xqtiv-search-operations.xqtiv.workers.dev/*']);assert.deepEqual(manifest.permissions,['activeTab','scripting','storage']);assert.equal(manifest.externally_connectable,undefined);
 for(const file of ['content.js','popup.js'])new vm.Script(readFileSync(new URL('../extensions/profile-mapper/'+file,import.meta.url),'utf8'));
});
