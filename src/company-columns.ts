export const companyColumns=[
 ['name','Company','Required. Use a consistent company name.'],
 ['industries','Industry','Comma-separated industry tags shared with candidates.'],
 ['sector','Sector','Business sector; select or add a shared value.'],
 ['subsector','Subsector','Business subsector; select or add a shared value.'],
 ['revenue_band','Revenue Band (USD)','Use a standard revenue band; leave unknown blank.'],
 ['employee_band','Company size','Use a standard employee range; leave unknown blank.'],
 ['tags','Relevant Tags','Optional comma-separated tags.'],
 ['company_type','Company Type','Optional company category.'],
 ['offerings','Service Offerings','Optional comma-separated services.'],
 ['specialties','Specialties','Optional areas of expertise.'],
 ['geographies','Geographies','Optional countries or markets.'],
 ['website','Website','Complete https:// website URL.'],
 ['linkedin','LinkedIn URL','Complete https://www.linkedin.com/company/… URL.'],
 ['revenue','Known revenue details','Optional revenue context, including currency.'],
 ['revenue_year','Revenue Year','Reporting year, if known.'],
 ['revenue_source','Revenue Source','Source URL or publication.'],
 ['notes','Notes','Other company information.'],
];
const aliases:Record<string,string>={revenue:'revenue',industries:'industries',name:'name',employees:'employee_band','employee range':'employee_band','company name':'name',industry:'industries',offering:'offerings',specialty:'specialties',geography:'geographies','web page':'website','revenue size':'revenue'};
export function matchCompanyHeaders(headers:any[]){const map:Record<string,number>={};headers.forEach((v,i)=>{const label=String(v||'').trim().toLowerCase();const found=companyColumns.find(([key,title])=>key===label||title.toLowerCase()===label)?.[0]||aliases[label];if(found)map[found]=i;});return map;}
