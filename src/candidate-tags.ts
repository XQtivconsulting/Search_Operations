import {requireThat} from './domain';
type R=Record<string,any>;
export const tagCategories=[
 {key:'industry',label:'Industry',icon:'▥',values:['Banking & Financial Services','Insurance','Healthcare','Life Sciences','Retail & CPG','Manufacturing','Technology','Telecom & Media','Energy & Utilities','Professional Services','Private Equity']},
 {key:'geography',label:'Geography',icon:'◎',values:['US Northeast','US Southeast','US Midwest','US West','US Texas','Canada','United Kingdom','Europe','India','Middle East','Asia Pacific']},
 {key:'seniority',label:'Seniority',icon:'◇',values:['Manager','Director','Senior Director','AVP','VP','SVP','EVP','C-suite','Board']},
 {key:'compensation',label:'Compensation',icon:'$',values:['USD OTE <200k','USD OTE 200–300k','USD OTE 300–500k','USD OTE 500–750k','USD OTE 750k–1m','USD OTE 1m+','INR OTE <50 lakh','INR OTE 50 lakh–1 crore','INR OTE 1–2 crore','INR OTE 2 crore+','GBP OTE <150k','GBP OTE 150–250k','GBP OTE 250k+']},
 {key:'function',label:'Function',icon:'▣',values:['Sales / Hunting','Account Management','Alliances','General Management','AI & Data','Engineering','Product','Operations / Delivery','Finance','HR / Talent','Legal','Marketing','Strategy / Consulting']},
 {key:'expertise',label:'Expertise / hot lists',icon:'☆',values:['Future Chief AI Officer','AI Productionalization','Agentic AI','Data Platforms','Digital Transformation','Private Equity GTM','Google Cloud','Databricks','Enterprise Sales']},
];
export const normTag=(s:string)=>s.trim().replace(/\s+/g,' ').toLocaleLowerCase();
export function tagOptions(records:R[],key:string){const values=[...(tagCategories.find(c=>c.key===key)?.values||[]),...records.filter(r=>r.kind==='candidate-tag-value'&&r.category===key).map(r=>r.label),...records.filter(r=>r.kind==='candidate').flatMap(r=>r.tag_values?.[key]||[])];return [...new Map(values.map(v=>[normTag(v),v])).values()].sort((a,b)=>a.localeCompare(b));}
export function cleanTagValues(input:any,records:R[]){requireThat(input&&typeof input==='object'&&!Array.isArray(input),'Choose candidate tags.');requireThat(Object.keys(input).every(k=>tagCategories.some(c=>c.key===k)),'Unknown tag category.');const out:Record<string,string[]>={};for(const c of tagCategories){const values=input[c.key]||[];requireThat(Array.isArray(values)&&values.length<=20,'Choose up to 20 values per category.');const known=new Map(tagOptions(records,c.key).map(v=>[normTag(v),v]));out[c.key]=[];for(const v of values){requireThat(typeof v==='string'&&v.trim().length>0&&v.length<=100,'Tag values must be 1–100 characters.');const normalized=normTag(v);if(!out[c.key].some(x=>normTag(x)===normalized))out[c.key].push(known.get(normalized)||v.trim().replace(/\s+/g,' '));}}return out;}
export const canImportCandidates=(a:{role?:unknown;roles?:unknown})=>{const r=Array.isArray(a.roles)?a.roles:[a.role];return r.includes('super_admin')||r.includes('data_quality');};
export function candidateSearchIndex(records:R[],searches:R[],events:R[]=[]){
 const index=new Map<string,string[]>(),owners=new Map<string,string>();
 const strings=(v:any):string=>typeof v==='string'?v:Array.isArray(v)?v.map(strings).join(' '):v&&typeof v==='object'?Object.values(v).map(strings).join(' '):typeof v==='number'?String(v):'';
 for(const c of records.filter(r=>r.kind==='candidate')){index.set(c.id,[strings(c)]);owners.set(c.id,c.id);}
 for(const r of records){const cid=r.candidate_id;if(!index.has(cid))continue;owners.set(r.id,cid);index.get(cid)!.push(strings(r));if(r.role_id)index.get(cid)!.push(strings(searches.find(s=>s.id===r.role_id)||{}));}
 for(const e of events){const cid=owners.get(e.record_id);if(cid)index.get(cid)!.push(strings(e.data));}
 return new Map([...index].map(([id,v])=>[id,v.join(' ').toLocaleLowerCase()]));
}
