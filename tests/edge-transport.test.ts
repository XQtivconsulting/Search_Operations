import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';

test('CRM and invitation request options work in the Cloudflare runtime and reject redirects', async()=>{
  const bundle = await build({bundle:true,write:false,format:'esm',platform:'browser',stdin:{
    resolveDir:process.cwd(),sourcefile:'edge-transport-probe.ts',loader:'ts',contents:`
      import {fetchJobs} from './src/recruitcrm';
      import {sendInvitationEmail} from './src/invitation-email';
      export default {async fetch() {
        const modes=[];
        const transport=async(url,init)=>{
          // Real workerd Request validation, with synthetic responses and no external traffic.
          const request=new Request(url,init); modes.push(request.redirect);
          return Response.json(url.includes('recruitcrm')
            ? {data:[{id:1,name:'Synthetic role',job_status:{label:'Open'}}],next_page_url:null}
            : {id:'synthetic-message'});
        };
        const jobs=await fetchJobs('synthetic',transport);
        const mail=await sendInvitationEmail({RESEND_API_KEY:'synthetic',INVITATION_FROM:'invites@example.com'},'user@example.com','https://app.example.com/join/synthetic',transport);
        let redirectCalls=0,redirectError='';
        const redirect=async(url,init)=>{new Request(url,init);redirectCalls++;return new Response(null,{status:302,headers:{Location:'https://other.example.com/'}});};
        try {await fetchJobs('synthetic',redirect);}catch(e){redirectError=e.message;}
        const redirectedMail=await sendInvitationEmail({RESEND_API_KEY:'synthetic',INVITATION_FROM:'invites@example.com'},'user@example.com','https://app.example.com/join/synthetic',redirect);
        return Response.json({jobs:jobs.length,mail,modes,redirectCalls,redirectError,redirectedMail});
      }};
    `,
  }});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-09-25',script:bundle.outputFiles[0].text}));
  try {
    const response=await mf.dispatchFetch('http://localhost');
    assert.equal(response.status,200);
    const result=await response.json() as any;
    assert.equal(result.jobs,1);
    assert.equal(result.mail,'accepted');
    assert.deepEqual(result.modes,['manual','manual']);
    assert.equal(result.redirectCalls,2);
    assert.match(result.redirectError,/CRM_REDIRECT/);
    assert.equal(result.redirectedMail,'unconfirmed');
  } finally {await mf.dispose();}
});

test('candidate token cryptography and role email options work inside workerd',async()=>{
 const bundle=await build({bundle:true,write:false,format:'esm',platform:'browser',external:['node:crypto'],stdin:{resolveDir:process.cwd(),sourcefile:'candidate-edge-probe.ts',loader:'ts',contents:`
 import {createHash,randomBytes,randomInt} from 'node:crypto';
 import {sendRoleEmail} from './src/invitation-email';
 export default {async fetch(){const token=Buffer.from(randomBytes(32)).toString('hex'),code=String(randomInt(100000,1000000));const mail=await sendRoleEmail({RESEND_API_KEY:'synthetic',INVITATION_FROM:'invites@example.com'},'synthetic@example.com','code',code,'synthetic-id',async(url,init)=>{const r=new Request(url,init);if(r.redirect!=='manual'||r.headers.get('Idempotency-Key')!=='synthetic-id')throw new Error('Invalid request');return Response.json({id:'synthetic'});});return Response.json({tokenLength:token.length,codeLength:code.length,digestLength:createHash('sha256').update(token).digest('hex').length,mail});}};`}});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-09-25',compatibilityFlags:['nodejs_compat'],script:bundle.outputFiles[0].text}));try{const response=await mf.dispatchFetch('http://localhost');assert.equal(response.status,200);assert.deepEqual(await response.json(),{tokenLength:64,codeLength:6,digestLength:64,mail:'accepted'});}finally{await mf.dispose();}
});
