type Candidate = Record<string, any>;
export const candidateColumns = [
 ['first_name', 'First name'], ['last_name', 'Last name'], ['company', 'Company'],
 ['title', 'Current title'], ['url', 'LinkedIn'],
] as const;
const text = (value: unknown) => String(value || '').trim().toLocaleLowerCase();
export function directoryRows(candidates: Candidate[], query: string, filters: Record<string,string>, sort: string, descending: boolean, roleCounts: Map<string,number>) {
 const terms = text(query).split(/\s+/).filter(Boolean);
 const value = (c: Candidate, key: string) => key === 'roles' ? roleCounts.get(c.id) || 0 : key === 'first_name' ? c.first_name || c.name || '' : c[key] || '';
 return candidates.filter(c => {
  const searchable = text([c.name,c.first_name,c.last_name,c.company,c.title,c.url,c.email,c.phone].join(' '));
  return terms.every(term => searchable.includes(term)) && Object.entries(filters).every(([key,filter]) => text(value(c,key)).includes(text(filter)));
 }).sort((a,b) => {
  const av=value(a,sort), bv=value(b,sort);
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
