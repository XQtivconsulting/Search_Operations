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

function popupHarness(){
 const elements=new Map<string,any>(),timers=new Map<number,{fn:()=>void,ms:number}>();let timer=0;
 const element=(id='')=>({id,value:'',textContent:'',disabled:false,hidden:false,options:[] as any[],append(){},addEventListener(){},replaceChildren(){this.options=[];},add(o:any){this.options.push(o);}});
 const get=(id:string)=>{if(!elements.has(id))elements.set(id,element(id));return elements.get(id);};
 let injected:any,reply:any={actor:{id:'member',name:'Member'},workspace:'xqtiv',searches:[]};let hang=true;
 const context=vm.createContext({document:{getElementById:get,createElement:()=>element(),querySelectorAll:()=>[...elements.values()]},Option:function(label:string,id:string){return {label,value:id};},Date,Error,AbortController,
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
