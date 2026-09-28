import {requireThat,text} from './domain';
import {companyLinkedin} from './company-import';
export async function companySuggestions(name:string,transport:typeof fetch=fetch){
 const query=text(name,200);requireThat(query.length>=2,'Enter a company name first.');
 async function get(params:Record<string,string>){const url=new URL('https://www.wikidata.org/w/api.php');url.search=new URLSearchParams({...params,format:'json',languages:'en',language:'en'}).toString();const r=await transport(url,{redirect:'manual',headers:{'User-Agent':'XQtivSearchOperations/1.0 (company profile lookup)'},signal:AbortSignal.timeout(8000)});requireThat(r.ok,'Public company lookup is unavailable. You can still enter details manually.',502);const body=await r.text();requireThat(body.length<2000000,'Public lookup response too large.',502);return JSON.parse(body);}
 const result=await get({action:'wbsearchentities',search:query,type:'item',limit:'5'}),ids=(result.search||[]).map((r:any)=>r.id).filter((id:any)=>/^Q\d+$/.test(id));if(!ids.length)return [];
 const entities=await get({action:'wbgetentities',ids:ids.join('|'),props:'labels|descriptions|claims'});
 return ids.map((id:string)=>{const e=entities.entities?.[id]||{},claims=e.claims||{},first=(key:string)=>(claims[key]||[]).find((c:any)=>c.rank!=='deprecated'&&c.mainsnak?.datavalue)?.mainsnak.datavalue.value;
  let website='';try{const u=new URL(first('P856'));if(u.protocol==='https:'&&!u.username&&!u.password)website=u.href;}catch{}
  let linkedin='';try{const slug=first('P4264');if(typeof slug==='string')linkedin=companyLinkedin('https://www.linkedin.com/company/'+slug);}catch{}
  const revenueClaims=(claims.P2139||[]).filter((c:any)=>c.rank!=='deprecated'&&c.mainsnak?.datavalue?.value?.amount).sort((a:any,b:any)=>String(b.qualifiers?.P585?.[0]?.datavalue?.value?.time||'').localeCompare(String(a.qualifiers?.P585?.[0]?.datavalue?.value?.time||'')));
  const r=revenueClaims[0],v=r?.mainsnak.datavalue.value,unit=String(v?.unit||'').split('/').pop(),currencies:Record<string,string>={Q4917:'USD',Q4583:'INR',Q4916:'EUR',Q25224:'GBP',Q259502:'AUD',Q1104069:'CAD'},currency=currencies[unit||''];
  return {id,name:e.labels?.en?.value||id,description:e.descriptions?.en?.value||'',website,linkedin,revenue:v&&currency?Number(v.amount).toLocaleString('en-US')+' '+currency:'',revenue_year:r?.qualifiers?.P585?.[0]?.datavalue?.value?.time?.slice(1,5)||'',revenue_source:'https://www.wikidata.org/wiki/'+id};
 });
}
