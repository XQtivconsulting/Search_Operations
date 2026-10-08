import {zipSync,strToU8} from 'fflate';
import {createHash} from 'node:crypto';
import {resetTables} from './workspace-reset';
import {requireThat} from './domain';
type R=Record<string,any>;
// Business recovery intentionally excludes credentials and short-lived access capabilities.
const excluded=['candidate_sessions','candidate_codes','candidate_invites','candidate_limits','brief_shares'];
export const backupTables=[...resetTables.filter(t=>!excluded.includes(t)),'audit','research_events','settings'];
export type BusinessSnapshot={format:'search-erp-business-v1';tenant:string;created_at:string;tables:Record<string,R[]>;people:R[];excluded:string[];sha256:string};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function snapshotBusiness(db:{rows:(q:string,...p:any[])=>R[]},tenant:string,people:R[]):BusinessSnapshot{
 requireThat(/^[a-zA-Z0-9_-]{1,100}$/.test(tenant),'Invalid workspace.');
 const available=new Set(db.rows("SELECT name FROM sqlite_master WHERE type='table'").map(r=>r.name));
 const tables=Object.fromEntries(backupTables.filter(t=>available.has(t)).map(t=>[t,db.rows(`SELECT * FROM "${t}" ORDER BY rowid`)]));
 // Operational backup settings are deliberately separate from restorable business data.
 tables.settings=(tables.settings||[]).filter(r=>!String(r.key).startsWith('backup_'));
 const content={format:'search-erp-business-v1' as const,tenant,created_at:new Date().toISOString(),tables,people:people.map(p=>({id:p.id,name:p.name,email:p.email,roles:p.roles||[p.role],staff_id:p.staff_id,status:p.status})),excluded:['Passwords, sessions, API secrets and access invitations','Previous reset archives','Platform identity database: membership directory is included, credentials require separate recovery']};
 requireThat(strToU8(JSON.stringify(content)).length<=16*1024*1024,'Export exceeds the current 16 MB snapshot limit. No partial backup was marked complete; configure a chunked backup before adding more data.',413);
 return {...content,sha256:hash(content)};
}
export function validateSnapshot(s:BusinessSnapshot,tenant:string){
 requireThat(s?.format==='search-erp-business-v1'&&s.tenant===tenant,'Backup format or workspace does not match.');
 const {sha256,...content}=s;requireThat(hash(content)===sha256,'Backup checksum does not match.');
 requireThat(Object.keys(s.tables).every(t=>backupTables.includes(t as any)&&Array.isArray(s.tables[t])),'Backup contains an unsupported table.');
}
const xml=(v:any)=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const cellValue=(v:any)=>v!=null&&typeof v==='object'?JSON.stringify(v):String(v??'');
// Every value is an inline string: source data can never become an Excel formula.
export function workbook(sheets:{name:string;rows:R[];columns?:string[]}[]):Uint8Array{
 const files:Record<string,Uint8Array>={},ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const col=(n:number):string=>n>=26?col(Math.floor(n/26)-1)+String.fromCharCode(65+n%26):String.fromCharCode(65+n);
 sheets.forEach((s,index)=>{const keys=s.columns||[...new Set(s.rows.flatMap(r=>Object.keys(r)))];if(!keys.length)keys.push('No records');
  const output:any[][]=[['Source row','Text part',...keys]];
  s.rows.forEach((r,i)=>{const values=keys.map(k=>cellValue(r[k])),parts=Math.max(1,...values.map(v=>Math.ceil(v.length/16000)));for(let p=0;p<parts;p++)output.push([i+1,p+1,...values.map(v=>v.slice(p*16000,(p+1)*16000))]);});
  requireThat(output.length<=1048576&&keys.length<=16382,'Dataset exceeds Excel worksheet limits.',413);
  files[`xl/worksheets/sheet${index+1}.xml`]=strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><sheetData>${output.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>`<c r="${col(j)}${i+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${col(keys.length+1)}${output.length}"/></worksheet>`);
 });
 files['[Content_Types].xml']=strToU8(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
 files['_rels/.rels']=strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 files['xl/workbook.xml']=strToU8(`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
 files['xl/_rels/workbook.xml.rels']=strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`);
 return zipSync(files,{level:0});
}
const safe=(s:string)=>encodeURIComponent(s).replace(/\./g,'%2E');
export function buildBusinessArchive(snapshot:BusinessSnapshot):Uint8Array{
 validateSnapshot(snapshot,snapshot.tenant);
 const t=snapshot.tables,records=(t.research_records||[]).map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,search_id:r.role_id,version:r.version})),kind=(k:string)=>records.filter(r=>r.kind===k),candidates=kind('candidate'),searches=t.searches||[];
 const named=records.map(r=>({...r,candidate_name:candidates.find(c=>c.id===r.candidate_id)?.name||'',search_title:searches.find(s=>s.id===r.search_id)?.title||''}));
 const files:Record<string,Uint8Array>={'business-snapshot.json':strToU8(JSON.stringify(snapshot)), 'README.txt':strToU8(`Business continuity export for ${snapshot.tenant}\nCreated ${snapshot.created_at}\nSHA-256 in business-snapshot.json verifies its content.\nExcel data uses text cells to prevent formula execution. Long values continue on Text part rows; JSON is authoritative.\nPer-search workbooks include search-specific notes and referenced candidate profiles. Candidate-global notes are in Master datasets.xlsx.\nContacts are candidate contact details and the workspace people directory; a separate client-contact module is not yet implemented.\nExcluded: ${snapshot.excluded.join('; ')}.\nThis is a business-data export, not a full identity/disaster-recovery backup. Keep a downloaded copy outside the hosting account.\n`)};
 files['Master datasets.xlsx']=workbook([{name:'Searches',rows:searches},{name:'Status history',rows:t.search_status_history||[]},{name:'Candidates',rows:candidates},{name:'Companies',rows:kind('company')},{name:'People',rows:snapshot.people},{name:'Teams',rows:t.teams||[]},{name:'Engagement teams',rows:kind('engagement-team')},{name:'Mappings',rows:named.filter(r=>r.kind==='mapping')},{name:'Candidate notes',rows:named.filter(r=>r.kind==='candidate-activity')},{name:'Engagement',rows:named.filter(r=>r.kind==='engagement')},{name:'All research records',rows:named},{name:'Allocations',rows:t.assignments||[]},{name:'File index',rows:[...(t.candidate_files||[]),...(t.brief_files||[])]}]);
 for(const s of searches){const own=named.filter(r=>r.search_id===s.id),ids=new Set(own.map(r=>r.candidate_id).filter(Boolean));files[`searches/${safe(s.id)}-${String(s.title).replace(/[^\p{L}\p{N} -]/gu,'').slice(0,70)}.xlsx`]=workbook([{name:'Search',rows:[s]},{name:'Status history',rows:(t.search_status_history||[]).filter(r=>r.search_id===s.id)},{name:'Candidates',rows:candidates.filter(c=>ids.has(c.id))},{name:'Mappings',rows:own.filter(r=>r.kind==='mapping')},{name:'Engagement',rows:own.filter(r=>r.kind==='engagement')},{name:'Search notes',rows:own.filter(r=>r.kind==='candidate-activity')},{name:'Strategy brief and tasks',rows:own.filter(r=>!['mapping','engagement','candidate-activity'].includes(r.kind))},{name:'Allocations',rows:(t.assignments||[]).filter(r=>r.search_id===s.id)}]);}
 for(const prefix of ['candidate','brief'])for(const f of t[`${prefix}_files`]||[]){const chunks=(t[`${prefix}_file_chunks`]||[]).filter(r=>r.file_id===f.id).sort((a,b)=>a.part-b.part);files[`attachments/${prefix}/${safe(f.id)}/${safe(f.name)}`]=Uint8Array.from(atob(chunks.map(c=>c.data).join('')),c=>c.charCodeAt(0));}
 return zipSync(files,{level:0});
}
