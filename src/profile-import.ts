import {hasPermission} from './access-policy';
import {requireThat,text,Actor} from './domain';
import {candidateMatches,linkedin} from './candidate-identity';
import {companyNames,normalizedCompany,suggestedCompanies} from './company-match';
import {researchRecords,researchMutation,Member} from './research';
type DB={rows:(q:string,...p:any[])=>any[];audit:(a:Actor,k:string,id:string,old:any,next:any)=>void};
function authorize(a:Actor,members:Member[]){
 requireThat(members.some(m=>m.id===a.id&&m.status==='active'),'Active workspace membership required.',403);
 requireThat(hasPermission(a,'candidates.create')||hasPermission(a,'candidates.add'),'Candidate import permission required.',403);
 requireThat(hasPermission(a,'candidates.view'),'Candidate viewing permission required.',403);
}
export function profileImportSearches(db:DB,a:Actor){
 const staff=a.staffId||'',teams=new Set(db.rows('SELECT team_id FROM team_members WHERE staff_id=?',staff).map(r=>r.team_id));
 const assigned=new Set(db.rows('SELECT search_id,team_id FROM assignments').filter(r=>teams.has(r.team_id)).map(r=>r.search_id));
 for(const r of researchRecords(db))if(['target','task'].includes(r.kind)&&r.owner_id===a.id)assigned.add(r.role_id);
 return db.rows('SELECT id,title,client,search_number,status,partner_id FROM searches').filter(s=>String(s.status||'Open').toLowerCase()==='open'&&(a.roles?.includes('super_admin')||s.partner_id===a.id||assigned.has(s.id))).map(({partner_id,...s})=>s);
}
function cleanProfile(p:any){
 requireThat(p&&typeof p==='object'&&!Array.isArray(p),'Provide candidate details.');
 const c={first_name:text(p.firstName,100),last_name:text(p.lastName,100),url:linkedin(p.linkedinUrl),title:text(p.currentTitle,300),company:text(p.company,200),location:text(p.location,300),email:text(p.email,254).toLowerCase(),phone:text(p.phone,60)};
 requireThat(c.first_name&&c.last_name,'First name and last name are required.');
 requireThat(!c.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email),'Enter a valid email.');return c;
}
const summary=(c:any)=>({id:c.id,name:c.name,url:c.url,company:c.company,title:c.title,archived:!!c.archived});
export function profileImport(db:DB,a:Actor,b:any,members:Member[]):any{
 authorize(a,members);
 const searches=hasPermission(a,'candidates.add')?profileImportSearches(db,a):[];
 if(b.action==='context')return {actor:{id:a.id,name:a.name},workspace:a.tenant,canCreate:hasPermission(a,'candidates.create'),canMap:hasPermission(a,'candidates.add'),searches};
 requireThat(['preview','commit'].includes(b.action),'Unknown import action.');
 const candidate=cleanProfile(b.candidate),role=text(b.searchId,100);
 if(role){requireThat(hasPermission(a,'candidates.add'),'Add candidates to searches permission required.',403);requireThat(searches.some(s=>s.id===role),'This open search is not assigned to you.',403);}
 const records=researchRecords(db),matches=candidateMatches(records.filter(r=>r.kind==='candidate'),candidate),exact=matches.filter(m=>m.exact);
 requireThat(exact.length<2,'Multiple candidates share this LinkedIn URL. Resolve duplicates in XRP.',409);
 const companies=records.filter(r=>r.kind==='company'),companyMatches=suggestedCompanies(companies,candidate.company),companyExact=companies.filter(c=>companyNames(c).includes(normalizedCompany(candidate.company)));
 requireThat(companyExact.length<2,'Multiple companies share this name. Resolve duplicates in XRP.',409);
 if(b.action==='preview')return {candidate,matches:matches.map(m=>({candidate:summary(m.candidate),exact:m.exact,reason:m.reason})),companies:companyMatches.map(c=>({id:c.id,name:c.name})),exactCompanyId:companyExact[0]?.id||'',canCreate:hasPermission(a,'candidates.create')};
 let existing=exact[0]?.candidate||null;
 if(b.candidateId){const chosen=matches.find(m=>m.candidate.id===b.candidateId)?.candidate;requireThat(chosen&&(!existing||chosen.id===existing.id),'Select a candidate from the current matches.',409);existing=chosen;}
 requireThat(!existing?.archived,'Restore the archived candidate in XRP before importing.',409);
 if(!existing){requireThat(hasPermission(a,'candidates.create'),'Create candidates permission required.',403);requireThat(!matches.length||b.confirmNewCandidate===true,'Review similar candidates before creating a new profile.',409);}
 let company=companyExact[0]||null;
 if(!existing&&b.companyId){company=companyMatches.find(c=>c.id===b.companyId)||null;requireThat(company,'Choose a matching company from the preview.',409);}
 if(!existing&&!company&&companyMatches.length)requireThat(b.confirmNewCompany===true,'Review similar companies before creating a new company.',409);
 const candidateId=existing?.id||researchMutation(db,a,{action:'candidate-save',...candidate,...(company?{company:company.name,company_id:company.id}:{})},members).id;
 let mappingId='',mappingCreated=false;
 if(role){const mapping=records.find(r=>r.kind==='mapping'&&r.role_id===role&&r.candidate_id===candidateId);if(mapping)mappingId=mapping.id;else{mappingId=researchMutation(db,a,{action:'mapping-link',role_id:role,items:[{candidate_id:candidateId}]},members).ids![0];mappingCreated=true;}}
 const result={candidateId,mappingId,candidateCreated:!existing,mappingCreated,status:mappingId?(mappingCreated?'Candidate mapped as Draft':'Already mapped'):(existing?'Candidate already exists':'Candidate created')};
 db.audit(a,'extension-profile-import',candidateId,null,{...result,search_id:role,source:'XRP Profile Mapper'});return result;
}
