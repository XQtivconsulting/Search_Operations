import {geographyFullName,geographyCode} from './candidate-geography';
import {tagCategories} from './candidate-tags';
type Candidate = Record<string, any>;
export const candidateColumns = [
 ['first_name', 'First name'], ['last_name', 'Last name'], ['company', 'Company'],
 ['url', 'LinkedIn'],
] as const;
export const candidateTagColumns=tagCategories.map(c=>['tag:'+c.key,c.label] as const);
export function candidateTagText(c:Candidate,key:string){return [...(c.tag_values?.[key]||[])].map((v:string)=>key==='geography'?geographyFullName(v):v).sort((a:string,b:string)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true})).join(', ');}
const text = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
export function candidateTagDisplay(c:Candidate,key:string){return key==='geography'?[...new Set((c.tag_values?.geography||[]).map(geographyCode))].sort().join(', '):candidateTagText(c,key);}
export function directoryRows(candidates: Candidate[], query: string, filters: Record<string,string>, sort: string, descending: boolean, roleCounts: Map<string,number>, index: Map<string,string>=new Map(), records:Candidate[]=[]) {
 const terms = text(query).split(/\s+/).filter(Boolean);
 const value = (c: Candidate, key: string) => key.startsWith('tag:')?candidateTagText(c,key.slice(4)):key === 'roles' ? roleCounts.get(c.id) || 0 : key === 'first_name' ? c.first_name || c.name || '' : c[key] || '';
 return candidates.filter(c => {
  const searchable = (index.get(c.id)||'')+' '+text([c.name,c.first_name,c.last_name,c.company,c.title,c.url,c.email,c.phone].join(' '));
  return terms.every(term => searchable.includes(term)) && Object.entries(filters).every(([key,filter]) => {if(!filter)return true;if(key==='unmapped')return !(roleCounts.get(c.id)||0);if(key==='potential_client')return String(c.potential_client)===filter;if(key==='searches')return records.some(r=>r.kind==='mapping'&&r.candidate_id===c.id&&JSON.parse(filter).includes(r.role_id));if(key.startsWith('tag:'))return (c.tag_values?.[key.slice(4)]?.length?c.tag_values[key.slice(4)]:['']).some((v:string)=>JSON.parse(filter).includes(v));if(key==='company')return [c.company,...records.filter(r=>r.kind==='mapping'&&r.candidate_id===c.id).map(r=>r.company)].some(v=>text(v).includes(text(filter)));return text(value(c,key)).includes(text(filter));});
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
