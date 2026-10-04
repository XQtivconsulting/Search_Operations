import {cleanCompany} from './company-import';
import {exactCompany} from './company-match';
type R=Record<string,any>;
// One-time repair for drafts saved before assignment created a target company.
export function backfillDraftTargets(db:{rows:(q:string,...p:any[])=>R[];audit:(a:any,action:string,id:string,before:any,after:any)=>void}){
 const records=db.rows('SELECT * FROM research_records').map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version}));
 const companies=records.filter(r=>r.kind==='company'),candidates=new Map(records.filter(r=>r.kind==='candidate').map(r=>[r.id,r]));
 const targets=new Map(records.filter(r=>r.kind==='target').map(r=>[r.role_id+':'+r.company_id,r.id]));
 const roles=new Set(db.rows('SELECT id FROM searches').map(r=>r.id));let repaired=0;
 const actor={id:'system-migration'},stamp=new Date().toISOString();
 const create=(kind:string,role:string,key:string,data:R)=>{const id=crypto.randomUUID();db.rows('INSERT INTO research_records(id,kind,role_id,record_key,data,version) VALUES(?,?,?,?,?,1)',id,kind,role,key,JSON.stringify(data));db.audit(actor,'draft-target-backfill',id,null,data);return id;};
 for(const m of records.filter(r=>r.kind==='mapping'&&r.status==='Draft'&&!r.target_id&&roles.has(r.role_id))){
  const candidate=candidates.get(m.candidate_id);const name=String(candidate?.company||m.company||'').trim();
  let company=companies.find(c=>c.id===(candidate?.company_id||m.company_id))||exactCompany(companies,name);
  if(!company&&name){const data=cleanCompany({name});company={...data,id:create('company','',name.toLowerCase().replace(/\s+/g,' '),data)};companies.push(company);}
  if(!company)continue;
  const key=m.role_id+':'+company.id;let target=targets.get(key);
  if(!target){target=create('target',m.role_id,key,{name:company.name,company_id:company.id,expected:null,wave:null,team_id:'',owner_id:'',reviewer_id:'',status:'Not started',source:'Candidate mapping',created_by:actor.id,strategy_revision:null});targets.set(key,target);}
  const after={...m,company:company.name,company_id:company.id,target_id:target};delete after.version;
  db.rows('UPDATE research_records SET data=?,version=version+1 WHERE id=?',JSON.stringify(after),m.id);db.audit(actor,'draft-target-backfill',m.id,m,after);
  db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),m.id,actor.id,'draft-target-backfill',JSON.stringify({before:m,after}),stamp);repaired++;
 }return repaired;
}
