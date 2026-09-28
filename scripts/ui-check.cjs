const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state={name:'XQtiv — synthetic test',actor:{id:'test',name:'Test administrator',role:'admin',staffId:null},searches:[{id:'r',external_id:'1',title:'Practice leader',client:'Example client',status:'Open',version:1}],teams:[{id:'t',name:'Blue'}],staff:[{id:'s',name:'Researcher A'},{id:'s2',name:'Researcher B'}],assignments:[{id:'a',search_id:'r',team_id:'t',work_date:'2026-09-27',target:20,notes:'',version:1}],entries:['s','s2'].map((staff_id,i)=>({id:'e'+i,staff_id,assignment_id:'a',search_id:'r',team_id:'t',work_date:'2026-09-27',mapped:null,peer:null,partner:null,peer_at:null,partner_at:null,notes:'',version:1})),decisions:[],issues:[],audit:[]};
 let saved;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/bulk') {saved=route.request().postDataJSON();for(const c of saved.changes){const e=state.entries.find(e=>e.id===c.id);e.mapped=c.mapped;e.notes=c.notes;e.version++;}return route.fulfill({json:{saved:saved.changes}});}
  await route.fulfill({json:path==='/api/state'?state:{configured:false,jobs:[],runs:[]}});
 });
 await page.goto('http://127.0.0.1:4173');
 await page.getByRole('button',{name:'Spreadsheet',exact:true}).click();
 await page.getByLabel('Row 1 Mapped',{exact:true}).evaluate(el=>{const e=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(e,'clipboardData',{value:{getData:()=> '12\tFirst batch\n8\tSecond batch'}});el.dispatchEvent(e);});
 await page.getByRole('button',{name:'Save 2 changed rows'}).click();
 await page.getByText('2 rows saved together.',{exact:true}).waitFor();
 assert.equal(saved.changes.length,2);assert.equal(saved.changes[0].mapped,12);assert.equal(saved.changes[1].mapped,8);
 await page.getByLabel('Row 1 Mapped',{exact:true}).fill('13');
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 assert.equal(await page.getByLabel('Row 1 Mapped',{exact:true}).inputValue(),'12');
 await page.screenshot({path:'private-data/spreadsheet-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'private-data/spreadsheet-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);await browser.close();console.log('UI verified: two-row Excel paste, batch request, persisted refresh, undo, no browser errors.');
})().catch(e=>{console.error(e);process.exit(1)});
