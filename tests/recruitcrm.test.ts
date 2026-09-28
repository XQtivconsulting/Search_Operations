import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJobs, normalizeJob, readCRMToken } from '../src/recruitcrm';
test('CRM adapter paginates and projects only required job fields',async()=>{
 let calls=0;
 const transport=(async(url:any,init:any)=>{assert.equal(init.headers.Authorization,'Bearer synthetic');if(String(url).includes('/companies')) return Response.json({data:[{slug:'co',company_name:'Example client'}],next_page_url:null});calls++;return Response.json({data:[{id:calls,name:'Test',company_slug:'co',job_status:{label:'Open'},private_note:'not imported'}],next_page_url:calls===1?'https://api.recruitcrm.io/v1/jobs?page=2':null});}) as typeof fetch;
 const jobs=await fetchJobs('synthetic',transport);assert.equal(jobs.length,2);assert.equal(jobs[0].company_name,'Example client');assert.equal('private_note' in jobs[0],false);
});
test('CRM configuration accepts JSON and plain tokens without sharing plain tokens across tenants',()=>{
 assert.equal(readCRMToken(' synthetic ','xqtiv'),'synthetic');
 assert.equal(readCRMToken('Bearer synthetic','xqtiv'),'synthetic');
 assert.equal(readCRMToken('{"xqtiv":" synthetic "}','xqtiv'),'synthetic');
 assert.equal(readCRMToken('synthetic','other'),null);
 assert.equal(readCRMToken('{"xqtiv":"synthetic"}','other'),null);
 assert.equal(readCRMToken(undefined,'xqtiv'),null);
 assert.throws(()=>readCRMToken('{broken','xqtiv'),/not valid JSON/);
 assert.throws(()=>readCRMToken('{"xqtiv":123}','xqtiv'),/must be text/);
 assert.throws(()=>readCRMToken('synthetic\nsecond-line','xqtiv'),/line breaks/);
});
test('CRM transport failures give actionable errors without reflecting secrets or provider bodies',async()=>{
 for(const [transport,pattern] of [
   [async()=>{throw new TypeError('secret-in-transport-error');},/CRM_NETWORK/],
   [async()=>{throw Object.assign(new Error('private'),{name:'TimeoutError'});},/30 seconds/],
   [async()=>new Response('private provider page'),/CRM_RESPONSE/],
   [async()=>new Response('private',{status:401}),/rejected access/],
 ] as const) {
   await assert.rejects(fetchJobs('synthetic',transport as typeof fetch),(e:any)=>{
     assert.match(e.message,pattern);assert.equal(e.status,502);
     assert.doesNotMatch(e.message,/secret-in|private/);return true;
   });
 }
});
test('CRM adapter refuses off-origin pagination before sending a token',async()=>{
 let calls=0;const transport=(async()=>{calls++;return Response.json({data:[],next_page_url:'https://untrusted.example/v1/jobs'});}) as typeof fetch;
 await assert.rejects(fetchJobs('synthetic',transport),/unexpected pagination/);assert.equal(calls,1);
});
test('CRM adapter handles invalid payloads and rate limits',async()=>{
 assert.throws(()=>normalizeJob({id:1}),/without a name/);
 await assert.rejects(fetchJobs('synthetic',(async()=>new Response('',{status:429})) as typeof fetch),/rate limit/);
 await assert.rejects(fetchJobs('synthetic',(async()=>Response.json({not_data:[]})) as typeof fetch),/unexpected response/);
});

test('CRM company pagination matches exact slugs and rejects unsafe next pages',async()=>{
 const calls:string[]=[];
 const transport=(async(url:any)=>{calls.push(String(url));
  if(String(url).includes('/jobs')) return Response.json({data:[{id:1,name:'Role',company_slug:'c2'},{id:2,name:'Missing',company_slug:'missing'}]});
  return Response.json(String(url).includes('page=2')?{data:[{slug:'c2',company_name:'Second Company'}]}:{data:[{slug:'c1',company_name:'First Company'}],next_page_url:'https://api.recruitcrm.io/v1/companies?page=2'});
 }) as typeof fetch;
 const jobs=await fetchJobs('synthetic',transport);
 assert.equal(jobs[0].company_name,'Second Company');assert.equal(jobs[1].company_name,'');assert.equal(calls.length,3);
 let count=0;
 await assert.rejects(fetchJobs('synthetic',(async()=>{count++;return Response.json(count===1?{data:[{id:1,name:'Role',company_slug:'c'}]}:{data:[],next_page_url:'https://untrusted.example/v1/companies'});}) as typeof fetch),/unexpected pagination/);
 assert.equal(count,2);
});
