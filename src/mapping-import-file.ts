export const mappingImportColumns=[['search_number','Search ID'],['mapped_by','Researcher Name'],['mapped_on','Mapping Date'],['first_name','First Name'],['last_name','Last Name'],['url','LinkedIn URL'],['company','Company'],['title','Title'],['location','Location'],['email','Email'],['notes','Notes'],['team_review','Team Review'],['team_reviewer','Team Reviewer'],['team_review_date','Team Review Date'],['partner_review','Partner Review'],['partner_reviewer','Partner Reviewer'],['partner_review_date','Partner Review Date']] as const;
export const str=(v:unknown)=>String(v??'').trim();
export function importDate(v:unknown,required=false):string{
 if(!v){if(required)throw Error('Mapping Date is required.');return '';}
 let s=v instanceof Date?v.toISOString().slice(0,10):str(v),m=s.match(/^(\d{4})-([a-z]{3})-(\d{2})$/i);
 if(m){const i=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase());if(i>=0)s=`${m[1]}-${String(i+1).padStart(2,'0')}-${m[3]}`;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Use a full date: YYYY-MMM-DD or YYYY-MM-DD.');return s;
}
export function historicalMappingRows(grid:any[][]){
 const aliases:Record<string,string>={date:'mapped_on',name:'name',lilink:'url',linkedin:'url',linkedinprofile:'url',xqtivsearchid:'search_number',researcher:'mapped_by',mappedby:'mapped_by'};
 for(const [key,label] of mappingImportColumns)aliases[label.toLowerCase().replace(/[^a-z]/g,'')]=key;
 const keys=(grid[0]||[]).map(v=>aliases[str(v).toLowerCase().replace(/[^a-z]/g,'')]||'');
 for(const k of ['search_number','mapped_by','mapped_on','url'])if(!keys.includes(k))throw Error('Required headers: Search ID, Researcher Name, Mapping Date, LinkedIn URL.');
 if(new Set(keys.filter(Boolean)).size!==keys.filter(Boolean).length)throw Error('Remove duplicate column headers.');
 const rows=grid.slice(1).flatMap((cells,i)=>cells.some(v=>str(v))?[Object.fromEntries([['row',i+2],...keys.flatMap((k,j)=>k?[[k,cells[j] instanceof Date?(cells[j] as Date).toISOString().slice(0,10):str(cells[j])]]:[])])]:[]);
 if(!rows.length||rows.length>500)throw Error('Upload 1–500 mappings per file.');return rows;
}
