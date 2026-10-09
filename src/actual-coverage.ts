import {companyNames,normalizedCompany} from './company-match';
type R=Record<string,any>;
export function actualCoverage(records:R[],role:string){
 const companies=records.filter(r=>r.kind==='company'),candidates=new Map(records.filter(r=>r.kind==='candidate').map(r=>[r.id,r])),byId=new Map(companies.map(r=>[r.id,r]));
 const aliases=new Map<string,R[]>();for(const c of companies)for(const n of new Set(companyNames(c)))aliases.set(n,[...(aliases.get(n)||[]),c]);
 const resolve=(id:string,name:string)=>{const exact=byId.get(id),matches=aliases.get(normalizedCompany(name))||[];const master=exact||(matches.length===1?matches[0]:null);return {key:master?'id:'+master.id:name?'name:'+normalizedCompany(name):'unknown',name:master?.name||name||'Company not recorded'};};
 const targets=new Set(records.filter(r=>r.kind==='target'&&r.role_id===role).map(t=>resolve(t.company_id,t.company||t.name||'').key));
 const groups=new Map<string,R>(),seen=new Set<string>();let total=0,fallback=0;
 for(const m of records.filter(r=>r.kind==='mapping'&&r.role_id===role).sort((a,b)=>(b.version||0)-(a.version||0)||String(a.id).localeCompare(String(b.id)))){
  const identity=m.candidate_id||m.id;if(seen.has(identity))continue;seen.add(identity);
  const c=candidates.get(m.candidate_id)||{},historical=!!(m.company_id||String(m.company||'').trim()),company=historical?resolve(m.company_id,String(m.company||'').trim()):resolve(c.company_id,String(c.company||'').trim());
  const usedCurrent=!historical&&company.key!=='unknown';if(usedCurrent)fallback++;
  if(!groups.has(company.key))groups.set(company.key,{...company,onTarget:company.key==='unknown'?null:targets.has(company.key),total:0,approved:0,pending:0,rejected:0,other:0,candidates:[]});
  const g=groups.get(company.key)!;g.total++;total++;g[m.status==='Approved'?'approved':m.status==='Rejected'?'rejected':['Peer review','Partner review'].includes(m.status)?'pending':'other']++;
  g.candidates.push({...m,candidateName:c.name||m.name||'Name not recorded',usedCurrent});
 }
 return {total,companies:[...groups.values()].filter(g=>g.key!=='unknown').length,unknown:groups.get('unknown')?.total||0,fallback,groups:[...groups.values()].map((g):R=>({...g,share:total?g.total/total:0})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))};
}
