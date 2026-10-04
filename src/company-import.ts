import {tagOptions,normTag} from './candidate-tags';
import {employeeBands,revenueBands} from './company-directory';
import {requireThat,safeLink,text} from './domain';
export const tagFields=['tags','industries','offerings','specialties','geographies'];
export const scalarFields=['company_type','website','linkedin','revenue','revenue_year','revenue_source','notes','sector','subsector','employee_band','revenue_band'];
export const companyKey=(v:any)=>text(v,200).normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
export function mergeTags(...values:any[]) {const tags=new Map<string,string>();for(const v of values)for(const t of (Array.isArray(v)?v:String(v||'').split(/[,;\n]/)).map((s:any)=>text(s,200)).filter(Boolean))if(!tags.has(t.toLowerCase()))tags.set(t.toLowerCase(),t);requireThat(tags.size<=150,'A company can have up to 150 tags per field.');return [...tags.values()];}
export function companyLinkedin(v:any) {const link=safeLink(v);if(!link)return '';const u=new URL(link);requireThat(['linkedin.com','www.linkedin.com'].includes(u.hostname)&&/^\/company\/[^/]+\/?$/.test(u.pathname),'Use a LinkedIn company URL, such as https://www.linkedin.com/company/example.');return 'https://www.linkedin.com'+u.pathname.replace(/\/$/,'').toLowerCase();}
export function cleanCompany(b:any,records:any[]=[]):Record<string,any> {const name=text(b.name,200);requireThat(name,'Company name is required.');requireThat(!b.employee_band||employeeBands.includes(b.employee_band),'Choose a standard employee range.');requireThat(!b.revenue_band||revenueBands.includes(b.revenue_band),'Choose a standard revenue range.');const industries=new Map(tagOptions(records,'industry').map(v=>[normTag(v),v]));return {name,aliases:mergeTags(b.aliases),...Object.fromEntries(tagFields.map(k=>[k,k==='industries'?mergeTags(b[k]).map(v=>industries.get(normTag(v))||v):mergeTags(b[k])])),...Object.fromEntries(scalarFields.map(k=>[k,k==='website'?safeLink(b[k]):k==='linkedin'?companyLinkedin(b[k]):text(b[k],k==='notes'?5000:1000)]))};}
const domain=(v:any)=>{try{return new URL(v).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
export function planCompanyImport(existing:any[],input:any[],overwrite=false):Record<string,any>[] {
 requireThat(Array.isArray(input)&&input.length>0&&input.length<=1000,'Upload 1–1,000 company rows at a time.');
 const staged=existing.map(x=>({...x})),changes=new Map<string,any>();
 for(let index=0;index<input.length;index++){
  const row=cleanCompany(input[index],staged.map(c=>({...c,kind:'company'})));
  const matches=staged.filter(c=>companyKey(c.name)===companyKey(row.name)||row.website&&domain(c.website)===domain(row.website)||row.linkedin&&c.linkedin===row.linkedin);
  requireThat(matches.length<=1,`Row ${index+1}: identifiers match different companies. Correct this row before importing.`);
  let c=matches[0];
  if(c){
   for(const k of ['website','linkedin'])requireThat(!row[k]||!c[k]||(k==='website'?domain(row[k])===domain(c[k]):row[k]===c[k]),`Row ${index+1}: ${row.name} has a conflicting ${k}. Resolve its identity in the company profile first.`);
   const next={...c};for(const k of tagFields)next[k]=mergeTags(c[k],row[k]);
   for(const k of scalarFields)if(row[k]&&(overwrite||!c[k]))next[k]=row[k];
   staged[staged.indexOf(c)]=next;c=next;
  }else {c={...row,id:'new:'+index,version:0};staged.push(c);}
  changes.set(c.id,c);
 }
 return [...changes.values()].map(c=>({existingId:c.version?c.id:undefined,version:c.version,...Object.fromEntries(['name',...tagFields,...scalarFields].map(k=>[k,c[k]|| (tagFields.includes(k)?[]:'')]))}));
}
