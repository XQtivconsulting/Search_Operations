import {requireThat} from './domain';
type R=Record<string,any>;
export const crmSlug=(value:unknown)=>{const s=String(value||'');requireThat(/^[A-Za-z0-9_-]{1,150}$/.test(s),'RecruitCRM record is missing a valid slug. Refresh jobs first.');return s;};
/** Only follows pages of the same endpoint and preserves entity-scoping filters. */
export async function crmList(token:string,path:string,query:Record<string,string>={},transport:typeof fetch=fetch):Promise<R[]>{
 const base=new URL('https://api.recruitcrm.io/v1/'+path);for(const [k,v] of Object.entries(query))base.searchParams.set(k,v);
 let next:string|null=base.href;const seen=new Set<string>(),result:R[]=[];
 while(next){
  const u=new URL(next,base);requireThat(u.origin===base.origin&&u.pathname===base.pathname&&!u.username&&!u.password&&Object.entries(query).every(([k,v])=>u.searchParams.get(k)===v),'RecruitCRM returned an unsafe or unscoped pagination link.',502);
  requireThat(!seen.has(u.href)&&seen.size<20,'RecruitCRM result exceeds 20 pages. No partial candidate data will be imported.',502);seen.add(u.href);
  let response:Response;try{response=await transport(u.href,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(30000)});}catch{throw Object.assign(new Error('RecruitCRM connection timed out or failed. Resume the preview to retry.'),{status:502});}
  requireThat(response.status!==429,'RecruitCRM rate limit reached. Wait, then resume.',429);requireThat(response.ok,'RecruitCRM candidate request failed ('+response.status+'). No partial candidate data was saved.',502);
  const raw=await response.text();requireThat(raw.length<=1500000,'RecruitCRM response is too large to preview safely.',413);let b:any;try{b=JSON.parse(raw);}catch{throw new Error('RecruitCRM returned invalid JSON.');}
  const rows=Array.isArray(b)?b:Array.isArray(b.data)?b.data:path==='users/search'&&b.id!=null?[b]:b.data;requireThat(Array.isArray(rows),'RecruitCRM returned an unexpected candidate response.',502);result.push(...rows);requireThat(result.length<=2000,'This job or candidate exceeds the 2,000-record import limit.',413);
  next=Array.isArray(b)||!b.next_page_url||b.next_page_url==='null'?null:String(b.next_page_url);
 }return result;
}
export const crmAssignments=(token:string,job:string,transport:typeof fetch=fetch)=>crmList(token,`jobs/${crmSlug(job)}/assigned-candidates`,{},transport);
export async function crmCandidateDetails(token:string,job:string,candidate:string,transport:typeof fetch=fetch){
 const slug=crmSlug(candidate);
 const notes=await crmList(token,'notes/search',{related_to:slug,related_to_type:'candidate'},transport);
 requireThat(notes.every(n=>String(n.related_to)===slug&&n.related_to_type==='candidate'||Array.isArray(n.associated_candidates)&&n.associated_candidates.map(String).includes(slug)),'RecruitCRM returned notes for a different candidate.',502);
 const history=await crmList(token,`jobs/${crmSlug(job)}/stage-history/${slug}`,{},transport);
 return {notes,history};
}
