export const companyColumns=[
 ['name','Company','Required. Use a consistent company name.'],
 ['tags','Relevant Tags','Comma-separated tags, e.g. AI, Analytics, Consulting.'],
 ['company_type','Company Type','Your company category, e.g. Technology services.'],
 ['industries','Industries','Comma-separated industry tags.'],
 ['offerings','Service Offerings','Comma-separated services.'],
 ['specialties','Specialties','Comma-separated areas of expertise.'],
 ['geographies','Geographies','Comma-separated countries or markets.'],
 ['website','Website','Complete https:// website URL.'],
 ['linkedin','LinkedIn URL','Complete https://www.linkedin.com/company/… URL.'],
 ['revenue','Revenue','Include currency, e.g. USD 100–250 million.'],
 ['revenue_year','Revenue Year','Reporting year, if known.'],
 ['revenue_source','Revenue Source','Source URL or publication.'],
 ['notes','Notes','Other company information.'],
];
const aliases:Record<string,string>={name:'name','company name':'name',industry:'industries',offering:'offerings',specialty:'specialties',geography:'geographies','web page':'website','revenue size':'revenue'};
export function matchCompanyHeaders(headers:any[]){const map:Record<string,number>={};headers.forEach((v,i)=>{const label=String(v||'').trim().toLowerCase();const found=companyColumns.find(([key,title])=>key===label||title.toLowerCase()===label)?.[0]||aliases[label];if(found)map[found]=i;});return map;}
