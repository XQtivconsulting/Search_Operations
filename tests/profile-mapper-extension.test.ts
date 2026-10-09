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
 vm.runInContext("globalThis.findCurrentExperienceItem=()=>null;globalThis.extractHeaderJob=()=>({company:'',currentTitle:''})",context);const missing=await vm.runInContext('extractProfile()',context);assert.equal(missing.company,'');assert.equal(missing.currentTitle,'');
});
test('extension has only the XRP host grant and no cookie, clipboard or broad site permissions',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../extensions/profile-mapper/manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.host_permissions,['https://xqtiv-search-operations.xqtiv.workers.dev/*']);assert.deepEqual(manifest.permissions,['activeTab','scripting','storage']);assert.equal(manifest.externally_connectable,undefined);
 for(const file of ['content.js','popup.js'])new vm.Script(readFileSync(new URL('../extensions/profile-mapper/'+file,import.meta.url),'utf8'));
});

function popupHarness(search=""){
 const elements=new Map<string,any>(),timers=new Map<number,{fn:()=>void,ms:number}>();let timer=0;
 const element=(id='')=>({id,value:'',textContent:'',disabled:false,hidden:false,parentElement:{hidden:false},options:[] as any[],children:[] as any[],append(child:any){this.children.push(child);},setAttribute(){},addEventListener(){},replaceChildren(){this.options=[];this.children=[];},add(o:any){this.options.push(o);}});
 const get=(id:string)=>{if(!elements.has(id))elements.set(id,element(id));return elements.get(id);};
 let injected:any,reply:any={actor:{id:'member',name:'Member'},workspace:'xqtiv',searches:[]};let hang=true;
 const context=vm.createContext({location:{search},URLSearchParams,document:{body:{classList:{add(){}}},getElementById:get,createElement:()=>element(),querySelectorAll:()=>[...elements.values()]},Option:function(label:string,id:string){return {label,value:id};},Date,Error,AbortController,
 setTimeout:(fn:()=>void,ms:number)=>{const id=++timer;timers.set(id,{fn,ms});return id;},clearTimeout:(id:number)=>timers.delete(id),
 chrome:{storage:{local:{setAccessLevel:async()=>{},get:async()=>({}),remove:async()=>{}}},tabs:{query:async()=>[{id:10,lastAccessed:100}]},scripting:{executeScript:async(spec:any)=>{injected=spec;return hang?new Promise(()=>{}):[{result:{data:reply}}];}}}});
 vm.runInContext(readFileSync(new URL('../extensions/profile-mapper/popup.js',import.meta.url),'utf8'),context);
 return {context,get,timers,injected:()=>injected,succeed:()=>{hang=false;},tick:async()=>{for(let i=0;i<10;i++)await Promise.resolve();}};
}
test('Connect recovers from hung browser injection, prevents overlapping connects and retries successfully',async()=>{
 const h=popupHarness();await h.tick();assert.equal(h.injected(),undefined,'opening popup must not start a second automatic connection');
 const first=h.get('connect').onclick();await h.tick();assert.match(h.get('status').textContent,/Connecting/);assert.equal(h.get('connect').disabled,true);assert.equal(h.injected().injectImmediately,true);
 await h.get('connect').onclick();assert.equal(h.get('connect').disabled,true);
 [...h.timers.values()].find(t=>t.ms===17000)!.fn();await first;assert.equal(h.get('connect').disabled,false);assert.match(h.get('status').textContent,/timed out/);
 h.succeed();await h.get('connect').onclick();assert.match(h.get('account').textContent,/Connected as Member/);assert.equal(h.get('connect').disabled,false);
});
test('injected connection rejects late execution, aborts stalled fetch and preserves pinned identity',async()=>{
 const h=popupHarness();h.succeed();await h.get('connect').onclick();const spec=h.injected();let fetches=0;
 const origin='https://xqtiv-search-operations.xqtiv.workers.dev';
 h.context.location={origin};h.context.sessionStorage={getItem:()=> 'xqtiv'};
 h.context.fetch=async()=>{fetches++;return {ok:true,json:async()=>({})};};
 let r=await spec.func('commit',{},null,origin,0);assert.match(r.error,/expired/);assert.equal(fetches,0);
 r=await spec.func('context',{}, {id:'member',workspace:'other'},origin,Date.now()+15000);assert.match(r.error,/Workspace changed/);assert.equal(fetches,0);
 h.context.fetch=async(_url:string,opts:any)=>new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'}))));
 const pending=spec.func('context',{},null,origin,Date.now()+15000);[...h.timers.values()].at(-1)!.fn();r=await pending;assert.match(r.error,/timed out/);
});

test('header fallback captures title and numeric-link company when Experience is not loaded',()=>{
 const c=parser();vm.runInContext(`
 const employer={innerText:'Example Systems',textContent:'Example Systems',querySelector:()=>null,querySelectorAll:()=>[],getAttribute:()=>null,href:'https://www.linkedin.com/company/12345/'};
 const header={querySelector:s=>s.includes('headline')?{textContent:'Business Development Executive'}:s.startsWith('a[href')?employer:null};
 globalThis.findProfileHeader=()=>header;
 globalThis.main={querySelector:()=>({})};`,c);
 const result=vm.runInContext('extractHeaderJob(main)',c);assert.equal(result.currentTitle,'Business Development Executive');assert.equal(result.company,'Example Systems');
});
test('modern paragraph Experience finds current entry without list-item classes',()=>{
 const c=parser();vm.runInContext(`
 const texts=['Sales Director','Example Systems · Full-time','Jan 2024 - Present'];
 const card={innerText:texts.join('\\n'),textContent:texts.join(' '),querySelectorAll:()=>texts.map(textContent=>({textContent}))};
 const date={textContent:texts[2],parentElement:card};
 const section={querySelectorAll:s=>s.startsWith('p,')?[date]:[]};card.parentElement=section;
 const heading={textContent:'Experience',closest:()=>section};
 const root={querySelectorAll:()=>[heading],querySelector:()=>null};
 globalThis.found=findCurrentExperienceItem(root);globalThis.expected=card;`,c);
 assert.equal(vm.runInContext('found===expected',c),true);
});

test('search import requires an explicit destination and directory mode never carries a search',()=>{
 const h=popupHarness();h.get('destinationMode').value='search';
 assert.throws(()=>vm.runInContext('destination()',h.context),/Select the search/);
 vm.runInContext("context={searches:[{id:'s1',search_number:108,client:'Example',title:'Sales Hunter'}]}",h.context);
 h.get('search').value='s1';let target=vm.runInContext('destination()',h.context);assert.equal(target.searchId,'s1');assert.match(target.label,/108.*Sales Hunter/);
 vm.runInContext('preview={payload:{searchId:"s1"}}',h.context);h.get('destinationMode').value='directory';h.get('destinationMode').onchange();
 target=vm.runInContext('destination()',h.context);assert.equal(target.searchId,'');assert.equal(target.label,'Candidate directory only');assert.equal(vm.runInContext('preview',h.context),null);assert.equal(h.get('searchDestination').hidden,true);
 h.get('destinationMode').value='search';h.get('search').value='foreign';assert.throws(()=>vm.runInContext('destination()',h.context),/Select the search/);
});

test('detached Capture targets the original browser window and requires optional LinkedIn consent',async()=>{
 const h=popupHarness('?detached=1&sourceWindow=42');let query:any,captures=0,allowed=false;
 h.context.chrome.permissions={request:async()=>allowed};
 h.context.chrome.tabs.query=async(q:any)=>{query=q;return [{id:55,url:'https://www.linkedin.com/in/synthetic/'}];};
 h.context.chrome.scripting.executeScript=async(spec:any)=>{if(spec.files){captures++;return [];}return [{result:{data:spec.args[0]==='context'?{actor:{id:'test',name:'Test'},workspace:'test',searches:[]}:{matches:[],companies:[],exactCompanyId:''}}}];};
 h.context.chrome.tabs.sendMessage=async()=>({name:'Synthetic Person',company:'Example',currentTitle:'Director'});
 h.context.chrome.storage.local.set=async()=>{};
 await h.get('capture').onclick();assert.equal(captures,0);assert.match(h.get('status').textContent,/Allow LinkedIn/);
 allowed=true;await h.get('capture').onclick();assert.equal(query.windowId,42);assert.equal(query.currentWindow,undefined);assert.equal(captures,1);assert.equal(h.get('firstName').value,'Synthetic');assert.equal(h.get('detach').hidden,true);
});
test('detach creates a resizable popup and carries destination without credentials',async()=>{
 const h=popupHarness();let created:any,closed=false;
 h.context.chrome.tabs.query=async()=>[{id:55,windowId:42}];h.context.chrome.storage.local.set=async()=>{};
 h.context.chrome.runtime={getURL:()=> 'chrome-extension://test/popup.html'};
 h.context.chrome.windows={create:async(args:any)=>{created=args;}};h.context.window={close:()=>{closed=true;}};
 h.get('destinationMode').value='search';h.get('search').value='s1';await h.get('detach').onclick();
 assert.equal(created.type,'popup');assert.equal(created.height,640);assert.match(created.url,/sourceWindow=42/);assert.match(created.url,/search=s1/);assert.equal(closed,true);
});

test('visible Experience fallback reads current jobs without relying on DOM classes',()=>{
 const c=parser();const parse=(text:string)=>{c.input=text;return vm.runInContext('extractVisibleExperience(input)',c);};
 let r=parse('About\nSomething\nExperience\nSales Director\nSales Director\nExample Systems · Full-time\nJan 2024 - Present · 2 yrs\nEducation\nUniversity');assert.equal(r.company,'Example Systems');assert.equal(r.currentTitle,'Sales Director');
 r=parse('Experience\nExample Systems\nFull-time · 6 yrs\nSales Director\nJan 2024 – Present\nSales Manager\nJan 2020 - Jan 2024');assert.equal(r.company,'Example Systems');assert.equal(r.currentTitle,'Sales Director');
 r=parse('Experience\nEngineer\nExample Labs\nJan 2024 - Present');assert.equal(r.company,'Example Labs');assert.equal(r.currentTitle,'Engineer');
 r=parse('Experience\nEngineer\nOld Company\nJan 2020 - Dec 2023\nEducation\nNew University\nJan 2024 - Present');assert.equal(r.company,'');assert.equal(r.currentTitle,'');
});

test('search typing displays clickable matches and selecting a result pins the import destination',()=>{
 const h=popupHarness();vm.runInContext("context={searches:[{id:'s16',search_number:16,client:'Example',title:'Sales Leader'},{id:'s116',search_number:116,client:'Example',title:'AI Leader'}]}",h.context);
 h.get('destinationMode').value='search';h.get('searchQuery').value=' 16 ';h.get('searchQuery').oninput();assert.equal(h.get('searchResults').children.length,2);
 h.get('searchResults').children[0].onclick();assert.equal(h.get('search').value,'s16');assert.match(h.get('destinationSummary').textContent,/16.*Sales Leader/);
 h.get('searchQuery').value='nothing matches';h.get('searchQuery').oninput();assert.equal(h.get('search').value,'');assert.match(h.get('searchResults').textContent,/No matching/);
});
test('capturing automatically previews duplicates without committing candidate data',async()=>{
 const h=popupHarness();const actions:string[]=[];
 h.context.chrome.tabs.query=async()=>[{id:1,url:'https://www.linkedin.com/in/example/'}];h.context.chrome.storage.local.set=async()=>{};
 h.context.chrome.tabs.sendMessage=async()=>({name:'Example Person',linkedinUrl:'https://www.linkedin.com/in/example/',company:'Example',currentTitle:'Director'});
 h.context.chrome.scripting.executeScript=async(spec:any)=>{if(spec.files)return [];actions.push(spec.args[0]);return [{result:{data:spec.args[0]==='context'?{actor:{id:'test',name:'Test'},workspace:'test',searches:[]}:{matches:[],companies:[],exactCompanyId:''}}}];};
 await h.get('capture').onclick();assert.deepEqual(actions,['context','preview']);assert.equal(h.get('matchInfo').textContent,'No matching candidate found.');assert.equal(h.get('review').hidden,false);assert.equal(h.get('profile').hidden,false);
});
