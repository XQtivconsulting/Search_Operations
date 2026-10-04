import {companySearchTerms,matchCompany} from './company-search';
export const employeeBands=[...Array.from({length:10},(_,i)=>`${(i*500+1).toLocaleString('en-US')}–${((i+1)*500).toLocaleString('en-US')}`),...Array.from({length:5},(_,i)=>`${(5001+i*1000).toLocaleString('en-US')}–${(6000+i*1000).toLocaleString('en-US')}`),...Array.from({length:8},(_,i)=>`${(10001+i*5000).toLocaleString('en-US')}–${(15000+i*5000).toLocaleString('en-US')}`),'More than 50,000'];
export const revenueBands=['Under $1 million','$1 million–<$10 million','$10 million–<$25 million','$25 million–<$50 million','$50 million–<$100 million','$100 million–<$200 million','$200 million–<$300 million','$300 million–<$500 million','$500 million–<$1 billion','$1 billion–<$2 billion','$2 billion–<$5 billion','$5 billion–<$10 billion','$10 billion–<$25 billion','$25 billion–<$50 billion','$50 billion or more'];
export const companyColumns=[['name','Company'],['industries','Industry'],['sector','Sector'],['subsector','Subsector'],['revenue_band','Revenue'],['employee_band','Company size']];
export const companyValues=(c:Record<string,any>,key:string):string[]=>{const value=c[key]||(key==='revenue_band'?c.revenue:'');return Array.isArray(value)?value:value?[String(value)]:[];};
export function companyDirectoryRows(companies:Record<string,any>[],query:string,filters:Record<string,string[]|null>,sort:string,descending:boolean,mode:'any'|'all'='all'){
 return companies.filter(c=>matchCompany(c,companySearchTerms(query),mode).matches&&Object.entries(filters).every(([key,chosen])=>chosen===null||(companyValues(c,key).length?companyValues(c,key):['']).some(v=>chosen.includes(v)))).sort((a,b)=>{
  const av=companyValues(a,sort).join(', '),bv=companyValues(b,sort).join(', ');if(!av||!bv)return av?-1:bv?1:String(a.id).localeCompare(String(b.id));
  const bands=sort==='employee_band'?employeeBands:sort==='revenue_band'?revenueBands:null;
  return (bands&&bands.includes(av)&&bands.includes(bv)?bands.indexOf(av)-bands.indexOf(bv):av.localeCompare(bv,undefined,{sensitivity:'base',numeric:true}))*(descending?-1:1)||String(a.id).localeCompare(String(b.id));
 });
}
