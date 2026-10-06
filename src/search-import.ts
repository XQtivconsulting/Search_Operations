import {candidateRows} from './candidate-import';
import {requireThat,text} from './domain';
import {searchNumber} from './search-number';
import {searchStatuses} from './search-management';
export const searchImportColumns=[['title','Search name'],['client','Client'],['status','Status'],['search_number','XQtiv Search ID']] as const;
export const searchSignature=(searches:any[])=>JSON.stringify(searches.map(s=>[s.id,s.version,s.search_number]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
export function planSearchImport(rows:any[],searches:any[]){
 requireThat(Array.isArray(rows)&&rows.length>0&&rows.length<=200,'Import 1–200 searches at a time.');
 const ids=new Set<number>(),names=new Set<string>();
 return rows.map((r,i)=>{
  const title=text(r.title),client=text(r.client),raw=text(r.status)||'Open',status=searchStatuses.find(s=>s.toLowerCase()===raw.toLowerCase());
  requireThat(title&&client,`Row ${i+1}: search name and client are required.`);
  requireThat(status,`Row ${i+1}: choose Open, On Hold, Closed, Abandoned or Canceled.`);
  const number=r.search_number===undefined||r.search_number===null||r.search_number===''?null:searchNumber(r.search_number);
  if(number!==null){requireThat(!ids.has(number),`Row ${i+1}: duplicate XQtiv Search ID ${number}.`);ids.add(number);}
  const key=client.toLowerCase()+'\n'+title.toLowerCase();requireThat(!names.has(key),`Row ${i+1}: repeated search name and client. Import distinct searches separately with their own IDs.`);names.add(key);
  const sameNumber=number===null?undefined:searches.find(s=>s.search_number===number);
  const sameName=searches.filter(s=>s.title.toLowerCase()===title.toLowerCase()&&s.client.toLowerCase()===client.toLowerCase());
  requireThat(!sameNumber||sameName.some(s=>s.id===sameNumber.id),`Row ${i+1}: XQtiv Search ID ${number} belongs to another search.`);
  const existing=sameNumber||(number===null&&sameName.length===1?sameName[0]:undefined);
  requireThat(number!==null||sameName.length<=1,`Row ${i+1}: several searches match; provide the XQtiv Search ID.`);
  return {title,client,status:status!,search_number:number,existing_id:existing?.id||'',result:existing?'Already exists — skip':'Add'};
 });
}

export function searchCandidateRows(grid:any[][]){
 if(grid.length<2||!grid.slice(1).some(r=>r.some(v=>String(v??'').trim())))return [];
 const rows=candidateRows(grid);requireThat(rows.every(r=>String(r.search_number??'').trim()),'Each Candidates row needs a XQtiv Search ID.');return rows;
}
export function workbookSearchRows(grid:any[][]){
 if(!grid.length)return [];
 const aliases:Record<string,string>={searchname:'title',search:'title',title:'title',role:'title',client:'client',clientname:'client',company:'client',status:'status',searchstatus:'status',xqtivsearchid:'search_number',searchid:'search_number'};
 const keys=grid[0].map(v=>aliases[String(v??'').toLowerCase().replace(/[^a-z]/g,'')]||'');
 return grid.slice(1).filter(r=>r.some(v=>String(v??'').trim())).map(r=>Object.fromEntries(keys.flatMap((key,i)=>key?[[key,String(r[i]??'').trim()]]:[])));
}
