import {canTeamReview} from './team-review';
import {handoffEngagement} from './engagement-domain';
import {submissionReadiness} from './submission-readiness';
import {companyNames,normalizedCompany} from './company-match';
import {cleanCriteria,cleanEvidence} from './strategy-criteria';
import {cleanRolePage} from './role-page';
import {cleanCompany} from './company-import';
import {hasRole,canPartnerReview,roleList,Actor,canPlan,requireThat,text,day,count,safeLink} from './domain';
export const researchSchema=`
CREATE TABLE IF NOT EXISTS research_records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,role_id TEXT NOT NULL DEFAULT '',record_key TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,UNIQUE(kind,record_key));
CREATE INDEX IF NOT EXISTS research_role ON research_records(role_id,kind);
CREATE TABLE IF NOT EXISTS research_events(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS brief_shares(token TEXT PRIMARY KEY,role_id TEXT NOT NULL UNIQUE,data TEXT NOT NULL,created_at TEXT NOT NULL);
`;
type DB={rows:(q:string,...p:any[])=>any[];audit:(a:Actor,k:string,id:string,old:any,next:any)=>void};
export type Member={id:string;name:string;role:string;roles?:string[];status:string;staff_id?:string;staffId?:string};
export function linkedin(v:any) {let u:URL;try{u=new URL(String(v));}catch{throw new Error('Enter a complete LinkedIn profile URL.');}requireThat(u.protocol==='https:'&&['linkedin.com','www.linkedin.com'].includes(u.hostname)&&/^\/in\/[^/]+\/?$/.test(u.pathname)&&!u.username&&!u.password,'Use https://www.linkedin.com/in/profile.');return 'https://www.linkedin.com'+u.pathname.replace(/\/$/,'').toLowerCase();}
const iso=()=>new Date().toISOString();
const get=(db:DB,id:string)=>{const r=db.rows('SELECT * FROM research_records WHERE id=?',id)[0];requireThat(r,'Record not found.',404);return {...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version};};
export function researchState(db:DB) {return {records:db.rows('SELECT * FROM research_records').map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version})),events:db.rows('SELECT * FROM research_events ORDER BY created_at DESC').map(r=>({...r,data:JSON.parse(r.data)}))};}
export function researchMutation(db:DB,a:Actor,b:any,members:Member[]) {
 requireThat((b.action==='candidate-save'&&!b.id)||roleList(a).some(r=>r!=='founder'),'This account has read-only access.',403);
 const active=members.filter(m=>m.status==='active');
 const member=(id:string)=>{const m=active.find(m=>m.id===id);requireThat(m,'Choose an active workspace member.');return m;};
 const researcher=(id:string)=>{const m=member(id);requireThat(hasRole(m,'researcher')&&(m.staff_id||m.staffId),'Choose a researcher linked to a staff record.');return m;};
 const teammate=(id:string,team:string,exclude='')=>{const m=researcher(id),sid=m.staff_id||m.staffId;requireThat(sid!==exclude,'Self-review is not allowed.');requireThat(db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',team,sid).length,'The peer reviewer must be a researcher in the same team.');return m;};
 const old=b.id?get(db,text(b.id)):null;
 if(old)requireThat(Number(b.version)===old.version,'This record changed. Reload before saving.',409);
 const role=old?.role_id||text(b.role_id);
 const search=role?db.rows('SELECT * FROM searches WHERE id=?',role)[0]:null;
 if(role)requireThat(search,'Role not found.',404);
 const manager=canPlan(a)||hasRole(a,'partner')&&search?.partner_id===a.id;
 const assignedSetup=researchState(db).records.some(t=>t.kind==='task'&&t.role_id===role&&t.owner_id===a.id&&t.status!=='Cancelled'&&((b.action==='brief-save'&&t.task_type==='Role brief')||(b.action==='strategy-save'&&t.task_type==='Search strategy')));
 const manage=()=>requireThat(manager||assignedSetup,'Role management permission required.',403);
 let next:any,id=old?.id||crypto.randomUUID(),kind=old?.kind||'',key='';
 const find=(k:string,rk:string)=>db.rows('SELECT id FROM research_records WHERE kind=? AND record_key=?',k,rk)[0];
 const save=(k:string,r:string,rk:string,d:any,existing:any=null)=>{
  const rid=existing?.id||crypto.randomUUID();
  db.rows('INSERT INTO research_records(id,kind,role_id,record_key,data,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET record_key=excluded.record_key,data=excluded.data,version=excluded.version',rid,k,r,rk,JSON.stringify(d),(existing?.version||0)+1);return rid;
 };
 if(b.action==='task-save') {
  requireThat(canPlan(a),'Planning permission required.',403);requireThat(search,'Choose a search.');requireThat(!old||old.kind==='task','Choose a task.');
  const person=researcher(b.owner_id),team=text(b.team_id);requireThat(db.rows('SELECT 1 FROM team_members WHERE team_id=? AND staff_id=?',team,person.staff_id||person.staffId).length,'Assign a member of this team.');
  requireThat(['Role brief','Search strategy','Target companies','Sourcing','Other'].includes(b.task_type),'Choose a task type.');
  requireThat(['Planned','In progress','Completed','Cancelled'].includes(b.status||'Planned'),'Choose a task status.');
  kind='task';key=old?.id||id;next={...old,task_type:b.task_type,title:text(b.title,200)||b.task_type,team_id:team,owner_id:b.owner_id,staff_id:person.staff_id||person.staffId,work_date:day(b.work_date),status:b.status||'Planned',notes:text(b.notes,5000)};
 } else if(b.action==='task-status') {
  requireThat(old?.kind==='task','Task not found.');requireThat(canPlan(a)||old.owner_id===a.id,'Only the assignee or planner can update this task.',403);requireThat(['Planned','In progress','Completed','Cancelled'].includes(b.status),'Choose a task status.');kind='task';key=old.id;next={...old,status:b.status};
 } else if(b.action==='candidate-save') {
  requireThat(!old||canPlan(a)||hasRole(a,'data_quality')||hasRole(a,'researcher')||hasRole(a,'engagement')||hasRole(a,'partner'),'Candidate editing permission required.',403);
  requireThat(!old||old.kind==='candidate','Choose a candidate record.');
  const url=old?.crm_ids?.length&&!b.url?'':linkedin(b.url),first_name=text(b.first_name,100),last_name=text(b.last_name,100),email=text(b.email,254).toLowerCase(),phone=text(b.phone,60);
  requireThat(first_name&&last_name,'First name and last name are required.');
  requireThat(!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid candidate email.');
  requireThat(!old||old.url===url,'A candidate LinkedIn identity cannot be replaced.');
  const existing=find('candidate',url);requireThat(!existing||existing.id===old?.id,'This LinkedIn profile already exists. Open that candidate and map them to another role.',409);
  const companyName=text(b.company,200),normalized=companyName.toLowerCase().replace(/\s+/g,' ');
  let companyRecord=companyName?find('company',normalized):null;
  if(b.company_id){const c=get(db,text(b.company_id));requireThat(c.kind==='company'&&c.name.toLowerCase().replace(/\s+/g,' ')===normalized,'Choose the matching company.');companyRecord={id:c.id};}
  if(companyName&&!companyRecord&&b.create_company===true){const cid=save('company','',normalized,{name:companyName});db.audit(a,'company-master',cid,null,{name:companyName});companyRecord={id:cid};}
  requireThat(b.potential_client===undefined||typeof b.potential_client==='boolean','Choose Yes or No for potential client.');
  kind='candidate';key=url||'recruitcrm:'+old.crm_ids[0];next={...old,...(b.potential_client===undefined||b.potential_client===old?.potential_client?{}:{potential_client:b.potential_client,potential_client_by:a.id,potential_client_at:iso()}),first_name,last_name,name:first_name+' '+last_name,url,email,phone,title:text(b.title,300),company:companyName,company_id:companyRecord?.id||''};
 } else if(b.action==='company-master') {
  requireThat(canPlan(a),'Planning permission required.',403);requireThat(!old||old.kind==='company','Wrong record type.');
  const name=text(b.name,200);requireThat(name,'Enter a company name.');kind='company';key=name.toLowerCase().replace(/\s+/g,' ');
  requireThat(!find(kind,key)||find(kind,key)?.id===old?.id,'This company is already in the master list.',409);
  const tags=(v:any)=>[...new Set(String(v||'').split(',').map(v=>text(v,100)).filter(Boolean))].slice(0,30);
  next={...old,...cleanCompany({...old,...b},researchState(db).records)};
  const names=companyNames(next);requireThat(!researchState(db).records.some(c=>c.kind==='company'&&c.id!==old?.id&&companyNames(c).some(n=>names.includes(n))),'This name or alias is already assigned to another company.',409);
 } else if(b.action==='peer-route') {
  requireThat(canPlan(a),'Planning permission required.',403);requireThat(db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',b.team_id,b.staff_id).length,'This researcher is not in the team.');
  requireThat(!old||old.kind==='peer-route','Wrong record type.');
  const reviewerStaff=b.reviewer_staff_id||((()=>{const m=teammate(b.reviewer_id,b.team_id,b.staff_id);return m.staff_id||m.staffId;})());
  requireThat(reviewerStaff!==b.staff_id,'Self-review is not allowed.');
  requireThat(db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',b.team_id,reviewerStaff).length,'The peer reviewer must be a researcher in the same team.');
  kind='peer-route';key=b.team_id+':'+b.staff_id;requireThat(old?.id===find(kind,key)?.id,'Peer pairing changed. Reload.',409);
  next={team_id:b.team_id,staff_id:b.staff_id,reviewer_staff_id:reviewerStaff};
 } else if(b.action==='team-reviewer') {
  requireThat(canPlan(a),'Planning permission required.',403);requireThat(db.rows('SELECT id FROM teams WHERE id=?',b.team_id).length,'Team not found.');
  kind='team-reviewer';key=text(b.team_id);teammate(b.reviewer_id,key);
  const found=find(kind,key);requireThat(old?.id===found?.id,'Reviewer configuration changed. Reload.',409);
  next={team_id:key,reviewer_id:b.reviewer_id};


 } else if(['brief-save','strategy-save','brief-approve','strategy-approve','brief-publish','brief-unpublish'].includes(b.action)) {
  manage();requireThat(search,'Choose a role.');kind=b.action.startsWith('brief')?'brief':'strategy';key=role;
  requireThat(!old||old.kind===kind,'Wrong record type.');requireThat(old?.id===find(kind,key)?.id,'A document already exists. Reload.',409);
  next={...old};delete next.version;
  if(b.action.endsWith('-save')) {const page=kind==='brief'&&b.page?cleanRolePage(b.page):null;const content=page?[page.title,...page.sections.map(s=>s.heading+'\n\n'+s.body)].filter(Boolean).join('\n\n'):text(b.content,40000);requireThat(content,'Enter document content.');next.draft=content;if(kind==='strategy')next.criteria=cleanCriteria(b.criteria||old?.criteria||[]);if(page)next.draft_page=page;else if(kind==='brief')delete next.draft_page;next.status='Draft';}
  if(b.action.endsWith('-approve')) {requireThat(old?.draft,'Save a draft first.');next.active=old.draft;if(kind==='strategy')next.active_criteria=old.criteria||[];if(kind==='brief')next.active_page=old.draft_page||null;next.revision=(old.revision||0)+1;next.approved_by=a.id;next.approved_at=iso();next.status='Approved';
   if(kind==='strategy'&&!old.cutover){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date()),date=b.cutover?day(b.cutover):today;requireThat(date>=today,'Candidate tracking cannot start in the past.');requireThat(!db.rows('SELECT e.id FROM entries e JOIN assignments a ON a.id=e.assignment_id WHERE a.search_id=? AND a.work_date>=? AND (e.mapped IS NOT NULL OR e.peer IS NOT NULL OR e.partner IS NOT NULL)',role,date).length,'This role has manual output on or after that date. Choose a later start date to preserve those records.');next.cutover=date;}
  }
  if(b.action==='brief-publish') {requireThat(old?.active,'Approve a candidate-safe brief first.');db.rows('DELETE FROM brief_shares WHERE role_id=?',role);db.rows('INSERT OR REPLACE INTO role_publications VALUES(?,?)',role,JSON.stringify({title:old.active_page?.origin==='document'?old.active_page.title:search.title,client:old.active_page?.origin==='document'?(old.active_page.client||''):search.client,content:old.active,page:old.active_page?{...old.active_page,source_text:undefined}:null,revision:old.revision}));next.published_revision=old.revision;next.share_token='';}
  if(b.action==='brief-unpublish') {db.rows('DELETE FROM brief_shares WHERE role_id=?',role);db.rows('DELETE FROM role_publications WHERE role_id=?',role);db.rows('UPDATE candidate_invites SET revoked=1 WHERE role_id=?',role);next.share_token='';next.published_revision=null;}
 } else if(b.action==='target-assign') {
  manage();requireThat(old?.kind==='target','Choose a role target.');
  const team=text(b.team_id),owner=text(b.owner_id);
  requireThat(!team||db.rows('SELECT id FROM teams WHERE id=?',team).length,'Choose an existing team.');
  if(owner){const m=researcher(owner);requireThat(team&&db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',team,m.staff_id||m.staffId).length,'The researcher must belong to this team.');}
  kind='target';key=role+':'+old.company_id;next={...old,team_id:team,owner_id:owner};
 } else if(b.action==='target-coverage') {
  manage();requireThat(old?.kind==='target','Choose a search target.');
  const expected=count(b.expected,'Target coverage',false);requireThat(expected!==null,'Enter target coverage.');
  requireThat(old.expected==null||Number(old.expected)===expected||text(b.notes),'Explain the target coverage revision.');
  kind='target';key=role+':'+old.company_id;next={...old,expected,coverage_note:text(b.notes,5000),coverage_updated_by:a.id,coverage_updated_at:iso()};
 } else if(b.action==='target-wave') {
  manage();requireThat(old?.kind==='target','Choose a role target.');kind='target';key=role+':'+old.company_id;const wave=count(b.wave,'Research wave',false);requireThat(wave&&wave<=99,'Use a wave from 1 to 99.');next={...old,wave};
 } else if(['company-save','company-claim','company-progress'].includes(b.action)) {
  requireThat(search,'Choose a role.');kind='target';requireThat(!old||old.kind===kind,'Wrong record type.');
  if(b.action==='company-save') {
   requireThat(manager||hasRole(a,'researcher'),'Research permission required.',403);
   if(old)manage();
   let companyId=old?.company_id||text(b.company_id),name='';
   if(companyId){const company=get(db,companyId);requireThat(company.kind==='company','Choose a company from the master list.');name=company.name;}
   else {name=text(b.name,200);requireThat(name,'Enter a company name.');const normalized=name.toLowerCase().replace(/\s+/g,' ');const company=find('company',normalized);companyId=company?.id||save('company','',normalized,cleanCompany({...b,name},researchState(db).records));}
   key=role+':'+companyId;requireThat(old?.id===find(kind,key)?.id,'This company is already in the role universe.',409);
   const strategy=find('strategy',role);const s=strategy?get(db,strategy.id):null;
   const team=text(b.team_id),owner=manager?text(b.owner_id):(team?a.id:'');
   if(team)requireThat(db.rows('SELECT id FROM teams WHERE id=?',team).length,'Choose a team.');
   if(owner){const rm=researcher(owner);requireThat(team&&db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',team,rm.staff_id||rm.staffId).length,'The researcher must belong to this team.');}
   requireThat(!b.wave||(Number.isInteger(Number(b.wave))&&Number(b.wave)>=1&&Number(b.wave)<=99),'Use a wave from 1 to 99.');
   requireThat(['','High','Normal','Low'].includes(text(b.priority)),'Choose a valid priority.');
   next={...old,name,company_id:companyId,team_id:team,owner_id:owner,reviewer_id:'',scope:text(b.scope,5000),target_titles:text(b.target_titles,1000),category:text(b.category,200),priority:text(b.priority),wave:count(b.wave,'Research wave'),expected:old?old.expected:count(b.expected,'Target coverage'),due:b.due?day(b.due):'',status:old?.status||'Not started',source:old?.source||(manager?'Planned':'Researcher added'),strategy_revision:old?.strategy_revision||s?.revision||null,created_by:old?.created_by||a.id};
  } else {
   requireThat(old,'Company not found.');key=role+':'+old.company_id;
   if(b.action==='company-claim'){requireThat(!old.owner_id,'This company is already assigned.',409);requireThat(!['Completed','No relevant talent'].includes(old.status),'Reopen completed research before assigning it.',409);const m=researcher(a.id),sid=m.staff_id||m.staffId;
    const myTeams=db.rows('SELECT team_id FROM team_members WHERE staff_id=?',sid).map(r=>r.team_id),planned=db.rows('SELECT DISTINCT team_id FROM assignments WHERE search_id=?',role).map(r=>r.team_id).filter(t=>myTeams.includes(t));
    const selected=old.team_id||text(b.team_id)||(planned.length===1?planned[0]:myTeams.length===1?myTeams[0]:'');
    requireThat(selected,'Choose your research team before assigning this company to yourself.');requireThat(myTeams.includes(selected),'Your active researcher account must belong to this company’s assigned team. Check Teams or ask a planner to change the company assignment.');next={...old,team_id:selected,owner_id:a.id,status:'In progress',started_at:iso()};}
   else {requireThat(manager||old.owner_id===a.id,'Only the owner or role manager can update coverage.',403);requireThat(['Not started','In progress','Partially mapped','Completed','No relevant talent','Blocked','Revisit required'].includes(b.status),'Choose a coverage status.');requireThat(!['Completed','No relevant talent','Blocked'].includes(b.status)||text(b.notes),'Explain coverage or the blocker.');next={...old,status:b.status,notes:text(b.notes,5000),started_at:old.started_at||iso(),completed_at:['Completed','No relevant talent'].includes(b.status)?(old.completed_at||iso()):null,completed_by:['Completed','No relevant talent'].includes(b.status)?(old.completed_by||a.id):null,coverage_researcher_id:['Completed','No relevant talent'].includes(b.status)?(old.coverage_researcher_id||old.owner_id||a.id):null,coverage_team_id:['Completed','No relevant talent'].includes(b.status)?(old.coverage_team_id||old.team_id):null};}
  }
 } else if(['mapping-add','mapping-link'].includes(b.action)) {
  requireThat(hasRole(a,'researcher'),'Enable the Researcher role on your account before recording mappings.',403);const person=researcher(a.id);
  requireThat(search,'Choose a role.');
  const linking=b.action==='mapping-link';
  requireThat(!linking||!b.target_id,'Search assignment cannot allocate target-company work.');
  const target=b.target_id?get(db,text(b.target_id)):null;
  if(target){requireThat(target.kind==='target'&&target.role_id===role,'Choose a company in this role.');requireThat(target.owner_id===a.id,'Claim this company or ask the manager to assign it to you.',403);requireThat(!['Completed','No relevant talent','Blocked'].includes(target.status),'Reopen company research before adding mappings.');}
  const team=linking?'':target?.team_id||text(b.team_id);
  requireThat(linking||db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',team,person.staff_id||person.staffId).length,'Choose a team you belong to.');
  const items=b.items;requireThat(Array.isArray(items)&&items.length>0&&items.length<=100,'Add between 1 and 100 candidates.');
  const ids=[];for(const item of items){
   requireThat(!linking||item.candidate_id,'Choose an existing candidate.');
   const selected=item.candidate_id?get(db,text(item.candidate_id)):null;requireThat(!selected||selected.kind==='candidate','Choose an existing candidate.');
   const url=selected?.url||linkedin(item.url),existing=find('candidate',url),candidate=selected||(existing?get(db,existing.id):null);
   const first_name=candidate?.first_name||text(item.first_name,100),last_name=candidate?.last_name||text(item.last_name,100);
   requireThat(first_name&&last_name,'First name and last name are required. Update an older candidate record before mapping.');
   const email=text(item.email,254).toLowerCase();requireThat(!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid candidate email.');
   const companyRecord=item.company_id?get(db,text(item.company_id)):null;requireThat(!companyRecord||companyRecord.kind==='company','Choose a company.');
   const company=target?get(db,target.company_id).name:(candidate?.company||companyRecord?.name||text(item.company,200));
   const company_id=target?.company_id||candidate?.company_id||companyRecord?.id||'';
   const candidateData={first_name,last_name,name:first_name+' '+last_name,url,email,phone:text(item.phone,60),title:text(item.title,300),company,company_id};
   const cid=candidate?.id||save('candidate','',url,candidateData);
   if(!candidate)db.audit(a,'candidate-save',cid,null,candidateData);
   requireThat(!find('mapping',role+':'+cid),'This candidate is already mapped to this role. Open the existing mapping; no duplicate was created.',409);
   const strategy=find('strategy',role),criteria=strategy?get(db,strategy.id).active_criteria||[]:[];
   const mapped={evidence:cleanEvidence(item.evidence,criteria),criteria_snapshot:criteria,candidate_id:cid,target_id:target?.id||'',name:candidate?.name||candidateData.name,title:candidate?.title||text(item.title,300),url,rationale:text(item.rationale,5000),company,company_id,mapper_id:a.id,staff_id:person.staff_id||person.staffId,team_id:team,reviewer_id:'',status:'Draft',created_at:iso(),strategy_revision:target?.strategy_revision||null};
   const mid=save('mapping',role,role+':'+cid,mapped);db.audit(a,b.action,mid,null,mapped);ids.push(mid);
   db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),mid,a.id,b.action,JSON.stringify({before:null,after:mapped}),iso());
  }return {ids};
 } else if(['mapping-edit','mapping-submit','mapping-review','mapping-reassign','mapping-reopen'].includes(b.action)) {
  requireThat(old?.kind==='mapping','Mapping not found.');kind='mapping';key=role+':'+old.candidate_id;next={...old};
  if(b.action==='mapping-edit'){requireThat(old.mapper_id===a.id&&['Draft','Needs information'].includes(old.status),'Only the mapper can edit a draft or returned mapping.',403);requireThat(text(b.rationale),'Enter a fit rationale.');next.rationale=text(b.rationale,5000);const strategy=find('strategy',role);const criteria=strategy?get(db,strategy.id).active_criteria||[]:[];next.evidence=cleanEvidence(b.evidence||old.evidence,criteria);next.criteria_snapshot=criteria;}
  if(b.action==='mapping-submit'){researcher(a.id);requireThat(text(old.rationale),'Add a fit rationale before submitting.');requireThat(old.mapper_id===a.id&&['Draft','Needs information','Hold'].includes(old.status),'This mapping cannot be submitted by you.',403);next.reviewer_id='';next.reviewer_override=false;next.peer_reviewed_by=null;next.peer_reviewed_name=null;next.peer_reviewed_at=null;const p=member(search.partner_id);requireThat(canPartnerReview(p),'Assign an engagement partner to this role.');const strategy=find('strategy',role);const cutover=strategy?get(db,strategy.id).cutover:null;const criteria=strategy?get(db,strategy.id).active_criteria||[]:[];next.evidence=cleanEvidence(old.evidence,criteria,true);next.criteria_snapshot=criteria;const readiness=submissionReadiness(strategy?get(db,strategy.id):null);requireThat(!readiness,readiness);next.strategy_revision=strategy?get(db,strategy.id).revision:null;next.status='Peer review';next.submitted_at=old.submitted_at||iso();next.stage_at=iso();next.work_date=old.work_date||new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());next.peer_decision=null;next.partner_decision=null;next.cycle=(old.cycle||0)+1;}
  if(b.action==='mapping-review') {
   const stage=old.status==='Peer review'?'peer':old.status==='Partner review'?'partner':'';requireThat(stage,'This mapping is not awaiting review.',409);
   if(stage==='peer'){
    member(a.id);requireThat(canTeamReview(a,old,search,db.rows('SELECT team_id,staff_id FROM team_members'),db.rows('SELECT search_id,team_id,work_date FROM assignments')),'Team review requires a researcher in the same team, the search engagement partner, or a super admin.',403);
    next.reviewer_id=a.id;next.peer_reviewed_by=a.id;next.peer_reviewed_name=member(a.id).name;next.peer_reviewed_at=iso();
   }else{
    requireThat(search.partner_id===a.id,'This review is assigned to another person.',403);requireThat(canPartnerReview(a),'Partner permission required.',403);
   }
   requireThat(['Approve','Reject','Needs information'].includes(b.decision),'Choose a decision.');
   requireThat(b.decision==='Approve'||text(b.notes),'Add a reason or requested information.');
   requireThat(b.decision!=='Reject'||['Wrong level','Wrong function','Insufficient scale','Industry mismatch','Geography mismatch','Insufficient evidence','Compensation mismatch','Other'].includes(b.reason),'Select a rejection reason.');
   next[stage+'_decision']=b.decision;next.status=b.decision==='Approve'?(stage==='peer'?'Partner review':'Approved'):b.decision==='Reject'?'Rejected':b.decision;next.stage_at=iso();next.last_feedback=text(b.notes,5000);next.reason=text(b.reason);next.last_review_hours=Math.max(0,(Date.now()-Date.parse(old.stage_at))/3600000);
  }
  if(b.action==='mapping-reassign'){requireThat(canPlan(a),'Planning permission required.',403);teammate(b.reviewer_id,old.team_id,old.staff_id);next.reviewer_id=b.reviewer_id;next.reviewer_override=true;}
  if(b.action==='mapping-reopen'){manage();requireThat(['Approved','Rejected'].includes(old.status),'Only decided mappings can be reopened.');requireThat(text(b.notes),'Explain why this mapping is reopened.');next.status='Needs information';next.peer_decision=null;next.partner_decision=null;next.last_feedback=text(b.notes,5000);}
 } else throw new Error('Unknown research action.');
 requireThat(!old||old.kind===kind,'Wrong record type.');
 id=save(kind,['candidate','company','peer-route','team-reviewer'].includes(kind)?'':role,key,next,old);
 if(kind==='mapping'&&next.status==='Approved')handoffEngagement(db,a,{...next,id,role_id:role});
 const event={before:old,after:next,decision:b.decision||null,reason:b.reason||null,notes:text(b.notes,5000)};
 db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,a.id,b.action,JSON.stringify(event),iso());db.audit(a,b.action,id,old,next);return {id};
}
export function derivedEntries(records:any[],assignments:any[]) {
 const groups=new Map<string,any>();
 for(const m of records.filter(r=>r.kind==='mapping'&&r.submitted_at)){
  const key=[m.role_id,m.team_id,m.staff_id,m.work_date].join(':');
  const entry=groups.get(key)||{id:'derived:'+key,assignment_id:assignments.find(a=>a.search_id===m.role_id&&a.team_id===m.team_id&&a.work_date===m.work_date)?.id||'unplanned:'+key,search_id:m.role_id,team_id:m.team_id,staff_id:m.staff_id,work_date:m.work_date,mapped:0,peer:0,partner:0,source:'candidates',version:0,notes:'Calculated from candidate mappings',peer_at:'derived',partner_at:'derived'};
  entry.mapped++;if(m.peer_decision==='Approve')entry.peer++;if(m.status==='Approved')entry.partner++;groups.set(key,entry);
 }return [...groups.values()];
}
