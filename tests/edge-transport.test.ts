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

test('mapping preview and import cross the real Worker/SQLite RPC boundary with normalized locations',async()=>{
 const bundle=await build({bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers','node:crypto'],stdin:{resolveDir:process.cwd(),sourcefile:'mapping-rpc-probe.ts',loader:'ts',contents:`
 import worker from './src/worker';
 import {Workspace} from './src/workspace';
 export class ImportWorkspace extends Workspace {async seed(){this.rows("INSERT INTO searches(id,client,title,search_number) VALUES('r','Synthetic','Leader',107)");this.rows("INSERT INTO staff VALUES('s','Synthetic Researcher')");}}
 export default {async fetch(req,env){
  const w=env.WORKSPACE.getByName('test');await w.seed();
  const actor={id:'admin',role:'admin',tenant:'test',name:'Admin'},members=[{...actor,status:'active'}];
  const runtime={...env,IDENTITY:{getByName:()=>({authenticate:async()=>actor,members:async()=>members})},ASSETS:{fetch:async req=>Response.json(new URL(req.url).pathname.endsWith('/index.json')?{states:[],shards:['64-61']}:[['Dallas, Texas, United States','dallas texas united states tx us','dallas','city']])}};
  const rows=[{row:2,search_number:'107',mapped_by:'Synthetic Researcher',mapped_on:'2026-09-01',name:'Example Person',url:'https://linkedin.com/in/synthetic-rpc-import',location:'Dallas TX'}];
  const send=body=>worker.fetch(new Request('https://app.example.com/api/research',{method:'POST',headers:{Origin:'https://app.example.com'},body:JSON.stringify({action:'historical-mapping-import',rows,...body})}),runtime);
  const preview=await send({preview:true});const plan=await preview.json();if(preview.status!==200)return Response.json({step:'preview',status:preview.status,plan});
  const applied=await send({signature:plan.signature});const result=await applied.json();
  const again=await send({preview:true});return Response.json({previewStatus:preview.status,location:plan.plan[0].data.location,first:plan.plan[0].data.first_name,last:plan.plan[0].data.last_name,staff:plan.plan[0].data.staff_id,applyStatus:applied.status,result,repeat:await again.json()});
 }};`}});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-09-25',compatibilityFlags:['nodejs_compat'],script:bundle.outputFiles[0].text,durableObjects:{WORKSPACE:{className:'ImportWorkspace',useSQLite:true}}}));
 try{const response=await mf.dispatchFetch('http://localhost');const result=await response.json() as any;assert.equal(result.previewStatus,200,JSON.stringify(result));assert.equal(result.applyStatus,200,JSON.stringify(result));assert.equal(result.location,'Dallas, Texas, United States');assert.equal(result.first,'Example');assert.equal(result.last,'Person');assert.equal(result.staff,'s');assert.equal(result.result.mapped,1);assert.equal(result.result.created,1);assert.match(result.repeat.plan[0].result,/Existing mapping/);}finally{await mf.dispose();}
});
