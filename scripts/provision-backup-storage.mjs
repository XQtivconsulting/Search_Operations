// Runs only in the owner's deployment workflow. Never logs tokens or response bodies.
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const bucket='xqtiv-search-operations-private-backups';
let configPath='wrangler.jsonc', previouslyConnected=null;
try {
 if(!account||!token)throw Error('Cloudflare deployment credentials are unavailable');
 const endpoint=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/r2/buckets`;
 const call=async(url,init={})=>{const r=await fetch(url,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});const body=await r.json();if(!r.ok||!body.success)throw Error(`Private backup storage API denied or unavailable (${r.status})`);return body.result;};
 const current=await call(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/scripts/xqtiv-search-operations/settings`);
 if(!Array.isArray(current.bindings))throw Error('Unexpected Worker settings response');
 previouslyConnected=!!current.bindings.some(b=>b.name==='BACKUPS');
 const all=await call(endpoint);if(!Array.isArray(all.buckets))throw Error('Unexpected bucket listing response');if(!all.buckets.some(b=>b.name===bucket))await call(endpoint,{method:'POST',body:JSON.stringify({name:bucket})});
 const access=await call(`${endpoint}/${bucket}/domains/managed`);if(access.enabled!==false)throw Error('Backup bucket public access must be disabled by the owner');
 const domains=await call(`${endpoint}/${bucket}/domains/custom`);if(!Array.isArray(domains.domains)||domains.domains.some(d=>d.enabled!==false))throw Error('Backup bucket must not have public custom domains');
 const config=JSON.parse((await readFile('wrangler.jsonc','utf8')).replace(/,\s*([}\]])/g,'$1'));
 config.r2_buckets=[{binding:'BACKUPS',bucket_name:bucket}];configPath='.wrangler-backups.json';await writeFile(configPath,JSON.stringify(config,null,2));
 console.log('Private backup bucket verified; deployment will connect weekly business backups.');
} catch(e){if(previouslyConnected!==false)throw Error('Cannot safely verify existing backup binding; deployment stopped without changing production.');console.log(`::warning::Weekly backups are NOT connected: ${e.message}. On-demand export remains available.`);}
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`config=${configPath}\n`);
