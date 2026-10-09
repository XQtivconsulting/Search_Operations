const ORIGIN='https://xqtiv-search-operations.xqtiv.workers.dev';
const $=id=>document.getElementById(id);
const windowParams=new URLSearchParams(location.search),sourceWindow=Number(windowParams.get('sourceWindow'));
const detached=windowParams.get('detached')==='1';let initialSearch=windowParams.get('search')||'';
if(detached){document.body.classList.add('detached');$('detach').hidden=true;if(windowParams.get('mode')==='directory')$('destinationMode').value='directory';}
const fields={firstName:'First name',lastName:'Last name',linkedinUrl:'LinkedIn URL',currentTitle:'Current title',company:'Company',location:'Location',email:'Email',phone:'Phone'};
let context=null,tabId=null,preview=null,busy=false,previewTimer=null,revision=0;
async function bounded(promise,ms,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}}
for(const [id,label] of Object.entries(fields)){const l=document.createElement('label'),input=document.createElement('input');l.textContent=label;input.id=id;input.maxLength=id==='linkedinUrl'?1000:300;input.required=['firstName','lastName','linkedinUrl'].includes(id);if(id==='email')input.type='email';l.append(input);$(id==='email'||id==='phone'?'contacts':'fields').append(l);input.addEventListener('input',()=>{invalidate();persist();schedulePreview();});}
const values=()=>Object.fromEntries(Object.keys(fields).map(k=>[k,$(k).value.trim()]));
const report=t=>$('status').textContent=t;
const invalidate=()=>{revision++;preview=null;$('review').hidden=true;$('open').hidden=true;};
async function persist(){await chrome.storage.local.set({profileDraft:{candidate:values(),savedAt:Date.now()}});}
async function run(fn){if(busy)return;busy=true;const controls=[...document.querySelectorAll('button,input,select')];controls.forEach(e=>e.disabled=true);try{await fn();}catch(e){report(e.message);}finally{busy=false;controls.forEach(e=>e.disabled=false);}}
async function api(action,body){
 if(!tabId)throw Error('Connect to XRP first.');
 const expected=context?{id:context.actor.id,workspace:context.workspace}:null;
 const deadline=Date.now()+15000;
 const timeoutMessage=action==='commit'?'Import response timed out. Review and retry the same profile/search to check whether it saved.':'XRP connection timed out. Open or refresh your XRP tab, then reconnect.';
 const [result]=await bounded(chrome.scripting.executeScript({target:{tabId},injectImmediately:true,func:async(action,body,expected,origin,deadline)=>{
  if(Date.now()>=deadline)return {error:'Connection expired. Reconnect to XRP.'};
  if(location.origin!==origin||!['context','preview','commit'].includes(action))return {error:'Invalid XRP connection.'};
  const workspace=sessionStorage.getItem('workspace')||'xqtiv';
  if(expected&&workspace!==expected.workspace)return {error:'Workspace changed. Reconnect to XRP.'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1,deadline-Date.now()));
  try{
   const response=await fetch('/api/profile-import/'+action,{method:action==='context'?'GET':'POST',credentials:'same-origin',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json','X-Workspace':workspace,...(expected?{'X-Expected-User':expected.id}:{})},...(action==='context'?{}:{body:JSON.stringify(body)})});
   const data=await response.json();if(!response.ok)return {error:data.error||'Sign in to XRP and reconnect.'};return {data};
  }catch(e){return {error:e.name==='AbortError'?(action==='commit'?'Import response timed out. Review and retry the same profile/search to check whether it saved.':'XRP connection timed out. Open or refresh your XRP tab, then reconnect.'):'Unable to reach XRP. Open or refresh your XRP tab and reconnect.'};}finally{clearTimeout(timer);}
 },args:[action,body||{},expected,ORIGIN,deadline]}),17000,timeoutMessage);
 if(result?.result?.error)throw Error(result.result.error);if(!result?.result?.data)throw Error('XRP did not respond. Reconnect.');return result.result.data;
}
function options(select,list,empty){select.replaceChildren();if(empty!==null)select.add(new Option(empty,''));for(const item of list)select.add(new Option(item.label,item.id));}
function searchLabel(s){return [s.search_number,s.client,s.title].filter(Boolean).join(' · ');}
function searches(){
 const old=$('search').value||initialSearch,q=$('searchQuery').value.trim().toLowerCase();
 const all=context?.searches||[],tokens=q.split(/\s+/).filter(Boolean);
 const matches=all.filter(s=>tokens.every(t=>searchLabel(s).toLowerCase().includes(t)));
 options($('search'),all.map(s=>({id:s.id,label:searchLabel(s)})),'Choose a search…');
 $('search').value=all.some(s=>s.id===old)?old:'';initialSearch='';
 destinationChanged();$('searchResults').replaceChildren();
 if(!context){$('searchResults').textContent='Connect to XRP to load searches.';return;}
 if(!matches.length){$('searchResults').textContent=all.length?'No matching open searches. Try the name or clear the filter.':'No authorized open searches available.';return;}
 for(const s of matches){const button=document.createElement('button');button.type='button';button.className='search-result';button.textContent=searchLabel(s);button.title=button.textContent;button.setAttribute('aria-pressed',String(s.id===$('search').value));button.onclick=()=>{$('search').value=s.id;$('searchQuery').value=searchLabel(s);destinationChanged();$('searchResults').replaceChildren();report('');schedulePreview();};$('searchResults').append(button);}
}
function destination(){
 if($('destinationMode').value==='directory')return {searchId:'',label:'Candidate directory only'};
 const search=context?.searches.find(s=>s.id===$('search').value);
 if(!search)throw Error('Select the search you want to import into.');
 return {searchId:search.id,label:[search.search_number,search.client,search.title].filter(Boolean).join(' · ')};
}
function destinationChanged(){
 invalidate();const directory=$('destinationMode').value==='directory';$('searchDestination').hidden=directory;
 try{$('destinationSummary').textContent=directory?'Candidate directory only':'Search: '+destination().label;}
 catch{$('destinationSummary').textContent=context&&!context.searches.length?'No assigned open searches available.':'Choose a search before importing.';}
}
async function connect(open=true){
 context=null;tabId=null;$('account').textContent='Not connected';report('Connecting to XRP…');invalidate();const tabs=await bounded(chrome.tabs.query({url:ORIGIN+'/*'}),5000,'Could not find your XRP tab. Open XRP and retry.');const tab=tabs.filter(t=>!t.discarded&&!t.frozen).sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0];
 if(tabs.length&&!tab)throw Error('Your XRP tab is sleeping. Open it, then return here and reconnect.');
 if(!tab){if(open)await chrome.tabs.create({url:ORIGIN});throw Error('Sign in to XRP, then return here and click Connect to XRP.');}
 tabId=tab.id;const data=await api('context');context=data;$('account').textContent='Connected as '+data.actor.name+' · '+data.workspace;searches();report('Connected.');
}
$('connect').onclick=()=>run(async()=>{await connect();await checkMatches();});
$('searchQuery').oninput=()=>{$('search').value='';searches();};$('searchQuery').onfocus=searches;$('search').onchange=destinationChanged;$('destinationMode').onchange=()=>{destinationChanged();schedulePreview();};
$('detach').onclick=()=>run(async()=>{
 const [source]=await chrome.tabs.query({active:true,currentWindow:true});await persist();
 const params=new URLSearchParams({detached:'1',sourceWindow:String(source.windowId),mode:$('destinationMode').value,search:$('search').value});
 await chrome.windows.create({url:chrome.runtime.getURL('popup.html')+'?'+params,type:'popup',width:540,height:640});window.close();
});
$('capture').onclick=()=>run(async()=>{
 if(detached){const granted=await chrome.permissions.request({origins:['https://www.linkedin.com/*','https://linkedin.com/*']});if(!granted)throw Error('Allow LinkedIn access to capture from this window, or use the toolbar popup.');}
 const [tab]=await chrome.tabs.query(detached&&Number.isInteger(sourceWindow)&&sourceWindow>0?{active:true,windowId:sourceWindow}:{active:true,currentWindow:true});if(!/^https:\/\/(www\.)?linkedin\.com\/in\//i.test(tab?.url||''))throw Error('Open an individual LinkedIn profile first.');
 report('Reading profile…');await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});const p=await chrome.tabs.sendMessage(tab.id,{type:'EXTRACT_PROFILE_V128'});if(!p||p.error)throw Error(p?.error||'Could not read this profile.');
 const parts=(p.name||'').trim().split(/\s+/),candidate={...p,firstName:parts.shift()||'',lastName:parts.join(' '),email:'',phone:''};
 for(const k of Object.keys(fields))$(k).value=candidate[k]||'';invalidate();await persist();const missing=['currentTitle','company'].filter(k=>!candidate[k]).map(k=>fields[k]);report(missing.length?missing.join(' and ')+' not found. Expand Experience and capture again, or enter manually.':'');await checkMatches();
});
function schedulePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(()=>run(checkMatches),450);}
async function checkMatches(){
 const candidate=values();if(!candidate.firstName||!candidate.lastName||!candidate.linkedinUrl)return;
 if(!context)await connect();
 let target;try{target=destination();}catch{target={searchId:'',label:'Choose a search to import'};}
 const currentRevision=revision,payload={candidate,searchId:target.searchId};
 $('matchInfo').textContent='Checking existing candidates…';$('review').hidden=false;$('import').hidden=true;
 let result;try{result=await api('preview',payload);}catch(e){if(currentRevision===revision)$('review').hidden=true;throw e;}if(currentRevision!==revision)return;
 preview={...result,payload,target};$('reviewDestination').textContent=target.searchId?'Search: '+target.label:target.label;$('import').textContent=target.searchId?'Import into selected search':'Import';$('import').hidden=false;
 const exact=result.matches.find(m=>m.exact);options($('candidateMatch'),result.matches.map(m=>({id:m.candidate.id,label:m.candidate.name+' · '+(m.candidate.company||'')+' — '+m.reason})),exact?null:'Create new candidate');if(exact)$('candidateMatch').value=exact.candidate.id;
 options($('companyMatch'),result.companies.map(c=>({id:c.id,label:c.name})),'Create company if needed');$('companyMatch').value=result.exactCompanyId;
 $('newCandidate').checked=false;$('newCompany').checked=false;
 $('candidateMatch').parentElement.hidden=!result.matches.length||!!exact;$('newCandidate').parentElement.hidden=!result.matches.length||!!exact;
 $('companyMatch').parentElement.hidden=!!exact||!result.companies.length;$('newCompany').parentElement.hidden=!!exact||!result.companies.length||!!result.exactCompanyId;
 $('matchInfo').textContent=exact?'Already in XRP: '+exact.candidate.name+'. Existing profile will be reused.':result.matches.length?'Possible duplicates—choose an existing candidate or confirm a new one.':'No matching candidate found.';
}
$('profile').onsubmit=e=>e.preventDefault();
$('import').onclick=()=>run(async()=>{
 if(!preview)throw Error('Review the import first.');
 if(destination().searchId!==preview.payload.searchId)throw Error('Destination changed. Review the import again.');
 const r=await api('commit',{...preview.payload,candidateId:$('candidateMatch').value,companyId:$('companyMatch').value,confirmNewCandidate:$('newCandidate').checked,confirmNewCompany:$('newCompany').checked});
 report(r.status+' · '+preview.target.label);invalidate();$('open').href=ORIGIN+'/?candidate='+encodeURIComponent(r.candidateId);$('open').hidden=false;
});
$('clear').onclick=()=>run(async()=>{for(const k of Object.keys(fields))$(k).value='';invalidate();await chrome.storage.local.remove('profileDraft');report('Profile cleared.');});
destinationChanged();
(async()=>{try{await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});const {profileDraft}=await chrome.storage.local.get('profileDraft');if(profileDraft&&Date.now()-profileDraft.savedAt<86400000)for(const k of Object.keys(fields))$(k).value=profileDraft.candidate[k]||'';else await chrome.storage.local.remove('profileDraft');}catch{report('Could not restore the saved profile. You can still capture and connect.');}})();
