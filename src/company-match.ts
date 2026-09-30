export const normalizedCompany=(s:string)=>String(s||'').trim().toLowerCase().replace(/[.,]/g,'').replace(/\s+/g,' ');
export const companyNames=(c:any)=>[c.name,...(Array.isArray(c.aliases)?c.aliases:String(c.aliases||'').split(','))].map(normalizedCompany).filter(Boolean);
export const exactCompany=(companies:any[],name:string)=>companies.find(c=>companyNames(c).includes(normalizedCompany(name)));
export const suggestedCompanies=(companies:any[],query:string)=>query.trim()?companies.filter(c=>companyNames(c).some(n=>n.includes(normalizedCompany(query))||normalizedCompany(query).includes(n))).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,8):[];
