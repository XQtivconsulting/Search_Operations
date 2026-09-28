type Company=Record<string,any>;
const fields=['name','company_type','industries','tags','offerings','specialties','geographies','notes'];
const stop=new Set('show me all the companies company list find search for a an that are is associated with in on of and or like keywords keyword please give related to'.split(' '));
const normalize=(v:string)=>v.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const aliases:Record<string,string[]>={energy:['energy','energies','oil','gas','renewable','renewables','solar','wind','electricity','power'],utilities:['utilities','utility','electricity','power','water'],healthcare:['healthcare','health care','hospitals','hospital'],finance:['finance','financial','banking','banks','fintech'],ai:['ai','artificial intelligence'],cpg:['cpg','consumer packaged goods']};
export function companySearchTerms(query:string){return [...new Set(normalize(query).split(' ').filter(t=>t&&!stop.has(t)).map(t=>t==='energies'?'energy':t==='utility'?'utilities':t))];}
export function matchCompany(company:Company,terms:string[],mode:'any'|'all'='any') {
 const corpus=' '+normalize(fields.flatMap(k=>Array.isArray(company[k])?company[k]:company[k]?[company[k]]:[]).join(' '))+' ';
 const matched=terms.filter(term=>(aliases[term]||[term]).some(word=>corpus.includes(' '+word+' ')));
 return {matches:!terms.length||(mode==='all'?matched.length===terms.length:matched.length>0),matched};
}
