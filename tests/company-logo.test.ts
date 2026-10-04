import test from 'node:test';
import assert from 'node:assert/strict';
import {companyLogo} from '../src/company-logo';
test('company icons use fixed remote host and reject unsafe image responses',async()=>{
 const fetcher:any=async(url:string,opts:any)=>{assert.equal(url,'https://icons.duckduckgo.com/ip3/example.com.ico');assert.equal(opts.redirect,'manual');return new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/png'}});};
 assert.equal((await companyLogo('example.com',fetcher)).status,200);
 await assert.rejects(companyLogo('localhost',fetcher));await assert.rejects(companyLogo('example.com/../../secret',fetcher));await assert.rejects(companyLogo('example.com',async()=>new Response('<script/>',{headers:{'Content-Type':'image/svg+xml'}})));
});
