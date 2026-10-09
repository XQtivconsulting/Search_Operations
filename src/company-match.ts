export const normalizedCompany=(s:string)=>String(s||'').trim().toLowerCase().replace(/[.,]/g,'').replace(/\s+/g,' ');
export const companyNames=(c:any)=>[c.name,...(Array.isArray(c.aliases)?c.aliases:String(c.aliases||'').split(','))].map(normalizedCompany).filter(Boolean);
export const exactCompany=(companies:any[],name:string)=>companies.find(c=>companyNames(c).includes(normalizedCompany(name)));
const compact=(s:string)=>normalizedCompany(s).replace(/[^\p{L}\p{N}]/gu,'');
export const suggestedCompanies=(companies:any[],query:string)=>{
 const q=compact(query);if(!q)return [];
 return companies.filter(c=>companyNames(c).some(n=>{const name=compact(n);return name===q||(q.length>=3&&(name.includes(q)||q.includes(name)));})).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,8);
};
