const ORIGIN='https://xqtiv-search-operations.xqtiv.workers.dev';
const $=id=>document.getElementById(id);
const fields={firstName:'First name',lastName:'Last name',linkedinUrl:'LinkedIn URL',currentTitle:'Current title',company:'Company',location:'Location',email:'Email',phone:'Phone'};
let context=null,tabId=null,preview=null;
for(const [id,label] of Object.entries(fields)){const l=document.createElement('label'),input=document.createElement('input');l.textContent=label;input.id=id;input.maxLength=id==='linkedinUrl'?1000:300;input.required=['firstName','lastName','linkedinUrl'].includes(id);if(id==='email')input.type='email';l.append(input);$('fields').append(l);input.addEventListener('input',()=>{invalidate();persist();});}
const values=()=>Object.fromEntries(Object.keys(fields).map(k=>[k,$(k).value.trim()]));
const report=t=>$('status').textContent=t;
const invalidate=()=>{preview=null;$('review').hidden=true;$('open').hidden=true;};
async function persist(){await chrome.storage.local.set({profileDraft:{candidate:values(),savedAt:Date.now()}});}
async function run(fn){const controls=[...document.querySelectorAll('button,input,select')];controls.forEach(e=>e.disabled=true);try{await fn();}catch(e){report(e.message);}finally{controls.forEach(e=>e.disabled=false);}}
async function api(action,body){
 if(!tabId)throw Error('Connect to XRP first.');
 const expected=context?{id:context.actor.id,workspace:context.workspace}:null;
 const [result]=await chrome.scripting.executeScript({target:{tabId},func:async(action,body,expected,origin)=>{
  if(location.origin!==origin||!['context','preview','commit'].includes(action))return {error:'Invalid XRP connection.'};
  const workspace=sessionStorage.getItem('workspace')||'xqtiv';
  if(expected&&workspace!==expected.workspace)return {error:'Workspace changed. Reconnect to XRP.'};
  try{
   const response=await fetch('/api/profile-import/'+action,{method:action==='context'?'GET':'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json','X-Workspace':workspace,...(expected?{'X-Expected-User':expected.id}:{})},...(action==='context'?{}:{body:JSON.stringify(body)})});
   const data=await response.json();if(!response.ok)return {error:data.error||'Sign in to XRP and reconnect.'};return {data};
  }catch{return {error:'Unable to reach XRP. Keep an XRP tab open and reconnect.'};}
 },args:[action,body||{},expected,ORIGIN]});
 if(result?.result?.error)throw Error(result.result.error);if(!result?.result?.data)throw Error('XRP did not respond. Reconnect.');return result.result.data;
}
function options(select,list,empty){select.replaceChildren();if(empty!==null)select.add(new Option(empty,''));for(const item of list)select.add(new Option(item.label,item.id));}
function searches(){const old=$('search').value,q=$('searchQuery').value.toLowerCase();options($('search'),(context?.searches||[]).filter(s=>[s.search_number,s.client,s.title].join(' ').toLowerCase().includes(q)).map(s=>({id:s.id,label:[s.search_number,s.client,s.title].filter(Boolean).join(' · ')})),'Candidate directory only');if([...$('search').options].some(o=>o.value===old))$('search').value=old;invalidate();}
async function connect(open=true){
 context=null;$('account').textContent='Not connected';invalidate();const tabs=await chrome.tabs.query({url:ORIGIN+'/*'});const tab=tabs.find(t=>t.active)||tabs[0];
 if(!tab){if(open)await chrome.tabs.create({url:ORIGIN});throw Error('Sign in to XRP, then return here and click Connect to XRP.');}
 tabId=tab.id;const data=await api('context');context=data;$('account').textContent='Connected as '+data.actor.name+' · '+data.workspace;searches();report('Connected.');
}
$('connect').onclick=()=>run(()=>connect());
$('searchQuery').oninput=searches;$('search').onchange=invalidate;
$('capture').onclick=()=>run(async()=>{
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!/^https:\/\/(www\.)?linkedin\.com\/in\//i.test(tab?.url||''))throw Error('Open an individual LinkedIn profile first.');
 report('Reading profile…');await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});const p=await chrome.tabs.sendMessage(tab.id,{type:'EXTRACT_PROFILE_V126'});if(!p||p.error)throw Error(p?.error||'Could not read this profile.');
 const parts=(p.name||'').trim().split(/\s+/),candidate={...p,firstName:parts.shift()||'',lastName:parts.join(' '),email:'',phone:''};
 for(const k of Object.keys(fields))$(k).value=candidate[k]||'';invalidate();await persist();report('Review captured details. Complete missing fields before importing.');
});
$('profile').onsubmit=e=>{e.preventDefault();run(async()=>{
 if(!context)await connect();const payload={candidate:values(),searchId:$('search').value};const result=await api('preview',payload);preview={...result,payload};
 const exact=result.matches.find(m=>m.exact);options($('candidateMatch'),result.matches.map(m=>({id:m.candidate.id,label:m.candidate.name+' · '+(m.candidate.company||'')+' — '+m.reason})),exact?null:'Create new candidate');if(exact)$('candidateMatch').value=exact.candidate.id;
 options($('companyMatch'),result.companies.map(c=>({id:c.id,label:c.name})),'Create company if needed');$('companyMatch').value=result.exactCompanyId;
 $('newCandidate').checked=false;$('newCompany').checked=false;$('review').hidden=false;
 $('matchInfo').textContent=exact?'Existing candidate will be reused. Saved profile details will not be overwritten.':result.matches.length?'Review possible duplicates.':'No matching candidate found.';report('Review the matches, then import.');
 });};
$('import').onclick=()=>run(async()=>{
 if(!preview)throw Error('Review the import first.');
 const r=await api('commit',{...preview.payload,candidateId:$('candidateMatch').value,companyId:$('companyMatch').value,confirmNewCandidate:$('newCandidate').checked,confirmNewCompany:$('newCompany').checked});
 report(r.status+'.');invalidate();$('open').href=ORIGIN+'/?candidate='+encodeURIComponent(r.candidateId);$('open').hidden=false;
});
$('clear').onclick=()=>run(async()=>{for(const k of Object.keys(fields))$(k).value='';invalidate();await chrome.storage.local.remove('profileDraft');report('Profile cleared.');});
(async()=>{await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});const {profileDraft}=await chrome.storage.local.get('profileDraft');if(profileDraft&&Date.now()-profileDraft.savedAt<86400000)for(const k of Object.keys(fields))$(k).value=profileDraft.candidate[k]||'';else await chrome.storage.local.remove('profileDraft');try{await connect(false);}catch{report('Connect to your signed-in XRP account to import.');}})();
