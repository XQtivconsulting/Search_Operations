import {geographyFullName,geographyCode,geographyMatches} from './candidate-geography';
import {parseCandidateQuery,matchesCandidateQuery} from './candidate-smart-search';
import {matchesFilter,filterText} from './filter-values';
import {tagCategories} from './candidate-tags';
type Candidate = Record<string, any>;
export const candidateColumns = [
 ['first_name', 'First name'], ['last_name', 'Last name'], ['title', 'Title'], ['company', 'Company'],
 ['url', 'LinkedIn'],
] as const;
export const candidateTagColumns=tagCategories.map(c=>['tag:'+c.key,c.label] as const);
export function candidateTagText(c:Candidate,key:string){return [...(c.tag_values?.[key]||[])].map((v:string)=>key==='geography'?geographyFullName(v):v).sort((a:string,b:string)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true})).join(', ');}
const text = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
export function candidateTagDisplay(c:Candidate,key:string){return key==='geography'?[...new Set((c.tag_values?.geography||[]).map(geographyCode))].sort().join(', '):candidateTagText(c,key);}
export function directoryRows(candidates: Candidate[], query: string, filters: Record<string,string>, sort: string, descending: boolean, roleCounts: Map<string,number>, index: Map<string,string>=new Map(), records:Candidate[]=[]) {
 const smartQuery=parseCandidateQuery(query,records);
 const activeFilters=Object.entries(filters).filter(([,filter])=>filter).map(([key,filter])=>[key,key==='searches'||key.startsWith('tag:')?JSON.parse(filter):filter] as const);
 const companies=new Map(records.filter(r=>r.kind==='company').map(r=>[r.id,r]));
 const mappings=new Map<string,Candidate[]>();
 for(const r of records)if(r.kind==='mapping'){if(!mappings.has(r.candidate_id))mappings.set(r.candidate_id,[]);mappings.get(r.candidate_id)!.push(r);}
 const companyNames=(r:Candidate)=>[r.company,companies.get(r.company_id)?.name,...(companies.get(r.company_id)?.aliases||[])];
 const value = (c: Candidate, key: string) => key.startsWith('tag:')?candidateTagText(c,key.slice(4)):key === 'roles' ? roleCounts.get(c.id) || 0 : key === 'first_name' ? c.first_name || c.name || '' : c[key] || '';
 return candidates.filter(c => {
  const searchable = (index.get(c.id)||'')+' '+text([c.name,c.first_name,c.last_name,c.company,c.title,c.url,c.email,c.phone,...Object.values(c.tag_values||{}).flat(),c.compensation_details].join(' '));
  return matchesCandidateQuery(c,searchable,smartQuery) && activeFilters.every(([key,filter]) => {
   if(key==='unmapped')return !(roleCounts.get(c.id)||0);
   if(key==='potential_client')return String(c.potential_client)===filter;
   if(key==='searches')return (mappings.get(c.id)||[]).some(r=>filter.includes(r.role_id));
   if(key.startsWith('tag:'))return (c.tag_values?.[key.slice(4)]?.length?c.tag_values[key.slice(4)]:['']).some((v:string)=>filter.some((selected:string)=>key==='tag:geography'?geographyMatches(v,selected):filterText(v)===filterText(selected)));
   if(key==='company')return [...companyNames(c),...(mappings.get(c.id)||[]).flatMap(companyNames)].some(v=>matchesFilter(v,filter));
   return matchesFilter(value(c,key),filter);
  });
 }).sort((a,b) => {
  const av=value(a,sort), bv=value(b,sort);
  if(sort.startsWith('tag:')&&(!av||!bv))return av? -1:bv?1:String(a.id).localeCompare(String(b.id));
  const compared=sort==='roles' ? Number(av)-Number(bv) : String(av).localeCompare(String(bv),undefined,{sensitivity:'base',numeric:true});
  return (descending ? -compared : compared) || String(a.id).localeCompare(String(b.id));
 });
}
export function candidateRoleCounts(records: Candidate[]) {
 const roles=new Map<string,Set<string>>();
 for(const r of records) if(r.kind==='mapping') {
  if(!roles.has(r.candidate_id)) roles.set(r.candidate_id,new Set());
  roles.get(r.candidate_id)!.add(r.role_id);
 }
 return new Map([...roles].map(([id,ids])=>[id,ids.size]));
}
export function directoryPage(rows: Candidate[], page: number, size: number) {
 const pages=Math.max(1,Math.ceil(rows.length/size)), current=Math.max(0,Math.min(page,pages-1));
 return {rows:rows.slice(current*size,(current+1)*size),page:current,pages,start:rows.length?current*size+1:0,end:Math.min((current+1)*size,rows.length)};
}
