import {Actor,canPlan,requireThat,text,day,count,safeLink} from './domain';
export const researchSchema=`
CREATE TABLE IF NOT EXISTS research_records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,role_id TEXT NOT NULL DEFAULT '',record_key TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,UNIQUE(kind,record_key));
CREATE INDEX IF NOT EXISTS research_role ON research_records(role_id,kind);
CREATE TABLE IF NOT EXISTS research_events(id TEXT PRIMARY KEY,record_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS brief_shares(token TEXT PRIMARY KEY,role_id TEXT NOT NULL UNIQUE,data TEXT NOT NULL,created_at TEXT NOT NULL);
`;
type DB={rows:(q:string,...p:any[])=>any[];audit:(a:Actor,k:string,id:string,old:any,next:any)=>void};
export type Member={id:string;name:string;role:string;status:string;staff_id?:string;staffId?:string};
export function linkedin(v:any) {let u:URL;try{u=new URL(String(v));}catch{throw new Error('Enter a complete LinkedIn profile URL.');}requireThat(u.protocol==='https:'&&['linkedin.com','www.linkedin.com'].includes(u.hostname)&&/^\/in\/[^/]+\/?$/.test(u.pathname)&&!u.username&&!u.password,'Use https://www.linkedin.com/in/profile.');return 'https://www.linkedin.com'+u.pathname.replace(/\/$/,'').toLowerCase();}
const iso=()=>new Date().toISOString();
const get=(db:DB,id:string)=>{const r=db.rows('SELECT * FROM research_records WHERE id=?',id)[0];requireThat(r,'Record not found.',404);return {...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version};};
export function researchState(db:DB) {return {records:db.rows('SELECT * FROM research_records').map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version})),events:db.rows('SELECT * FROM research_events ORDER BY created_at DESC').map(r=>({...r,data:JSON.parse(r.data)}))};}
export function researchMutation(db:DB,a:Actor,b:any,members:Member[]) {
 requireThat(a.role!=='founder'||b.action==='mapping-review','This account has read-only access.',403);
 const active=members.filter(m=>m.status==='active');
 const member=(id:string)=>{const m=active.find(m=>m.id===id);requireThat(m,'Choose an active workspace member.');return m;};
 const researcher=(id:string)=>{const m=member(id);requireThat(m.role==='researcher'&&(m.staff_id||m.staffId),'Choose a researcher linked to a staff record.');return m;};
 const teammate=(id:string,team:string,exclude='')=>{const m=researcher(id),sid=m.staff_id||m.staffId;requireThat(sid!==exclude,'Self-review is not allowed.');requireThat(db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',team,sid).length,'The peer reviewer must be a researcher in the same team.');return m;};
 const resolvePeer=(team:string,staff:string)=>{
  const candidates=active.filter(m=>m.role==='researcher'&&(m.staff_id||m.staffId)!==staff&&db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',team,m.staff_id||m.staffId||'').length);
  const route=db.rows("SELECT data FROM research_records WHERE kind='peer-route' AND record_key=?",team+':'+staff)[0];
  const selected=route?JSON.parse(route.data).reviewer_id:'';
  const matched=candidates.find(m=>m.id===selected);if(matched)return matched.id;
  const unique=[...new Set(candidates.map(m=>m.staff_id||m.staffId))];
  if(unique.length===1)return candidates[0].id;
  const legacy=db.rows("SELECT data FROM research_records WHERE kind='team-reviewer' AND record_key=?",team)[0];
  const fallback=legacy?candidates.find(m=>m.id===JSON.parse(legacy.data).reviewer_id):null;
  requireThat(fallback,'Set this researcher’s teammate reviewer in Teams before submitting.');return fallback.id;
 };
 const old=b.id?get(db,text(b.id)):null;
 if(old)requireThat(Number(b.version)===old.version,'This record changed. Reload before saving.',409);
 const role=old?.role_id||text(b.role_id);
 const search=role?db.rows('SELECT * FROM searches WHERE id=?',role)[0]:null;
 if(role)requireThat(search,'Role not found.',404);
 const manager=canPlan(a)||a.role==='partner'&&search?.partner_id===a.id;
 const manage=()=>requireThat(manager,'Role management permission required.',403);
 let next:any,id=old?.id||crypto.randomUUID(),kind=old?.kind||'',key='';
 const find=(k:string,rk:string)=>db.rows('SELECT id FROM research_records WHERE kind=? AND record_key=?',k,rk)[0];
 const save=(k:string,r:string,rk:string,d:any,existing:any=null)=>{
  const rid=existing?.id||crypto.randomUUID();
  db.rows('INSERT INTO research_records(id,kind,role_id,record_key,data,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET record_key=excluded.record_key,data=excluded.data,version=excluded.version',rid,k,r,rk,JSON.stringify(d),(existing?.version||0)+1);return rid;
 };
 if(b.action==='company-master') {
  requireThat(canPlan(a),'Planning permission required.',403);requireThat(!old||old.kind==='company','Wrong record type.');
  const name=text(b.name,200);requireThat(name,'Enter a company name.');kind='company';key=name.toLowerCase().replace(/\s+/g,' ');
  requireThat(!find(kind,key)||find(kind,key)?.id===old?.id,'This company is already in the master list.',409);
  const tags=(v:any)=>[...new Set(String(v||'').split(',').map(v=>text(v,100)).filter(Boolean))].slice(0,30);
  next={name,company_type:text(b.company_type,150),industries:tags(b.industries),offerings:tags(b.offerings),specialties:tags(b.specialties),geographies:tags(b.geographies),website:safeLink(b.website),notes:text(b.notes,5000)};
 } else if(b.action==='peer-route') {
  requireThat(canPlan(a),'Planning permission required.',403);requireThat(db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',b.team_id,b.staff_id).length,'This researcher is not in the team.');
  teammate(b.reviewer_id,b.team_id,b.staff_id);kind='peer-route';key=b.team_id+':'+b.staff_id;requireThat(old?.id===find(kind,key)?.id,'Peer pairing changed. Reload.',409);
  next={team_id:b.team_id,staff_id:b.staff_id,reviewer_id:b.reviewer_id};
 } else if(b.action==='team-reviewer') {
  requireThat(canPlan(a),'Planning permission required.',403);requireThat(db.rows('SELECT id FROM teams WHERE id=?',b.team_id).length,'Team not found.');
  kind='team-reviewer';key=text(b.team_id);teammate(b.reviewer_id,key);
  const found=find(kind,key);requireThat(old?.id===found?.id,'Reviewer configuration changed. Reload.',409);
  next={team_id:key,reviewer_id:b.reviewer_id};
 } else if(['brief-save','strategy-save','brief-approve','strategy-approve','brief-publish','brief-unpublish'].includes(b.action)) {
  manage();requireThat(search,'Choose a role.');kind=b.action.startsWith('brief')?'brief':'strategy';key=role;
  requireThat(!old||old.kind===kind,'Wrong record type.');requireThat(old?.id===find(kind,key)?.id,'A document already exists. Reload.',409);
  next={...old};delete next.version;
  if(b.action.endsWith('-save')) {const content=text(b.content,40000);requireThat(content,'Enter document content.');next.draft=content;next.status='Draft';}
  if(b.action.endsWith('-approve')) {requireThat(old?.draft,'Save a draft first.');next.active=old.draft;next.revision=(old.revision||0)+1;next.approved_by=a.id;next.approved_at=iso();next.status='Approved';
   if(kind==='strategy'&&!old.cutover){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date()),date=b.cutover?day(b.cutover):today;requireThat(date>=today,'Candidate tracking cannot start in the past.');requireThat(!db.rows('SELECT e.id FROM entries e JOIN assignments a ON a.id=e.assignment_id WHERE a.search_id=? AND a.work_date>=? AND (e.mapped IS NOT NULL OR e.peer IS NOT NULL OR e.partner IS NOT NULL)',role,date).length,'This role has manual output on or after that date. Choose a later start date to preserve those records.');next.cutover=date;}
  }
  if(b.action==='brief-publish') {requireThat(old?.active,'Approve a client-safe brief first.');const token=crypto.randomUUID()+crypto.randomUUID();db.rows('DELETE FROM brief_shares WHERE role_id=?',role);db.rows('INSERT INTO brief_shares VALUES(?,?,?,?)',token,role,JSON.stringify({title:search.title,client:search.client,content:old.active,revision:old.revision}),iso());next.share_token=token;}
  if(b.action==='brief-unpublish') {db.rows('DELETE FROM brief_shares WHERE role_id=?',role);next.share_token='';}
 } else if(['company-save','company-claim','company-progress'].includes(b.action)) {
  requireThat(search,'Choose a role.');kind='target';requireThat(!old||old.kind===kind,'Wrong record type.');
  if(b.action==='company-save') {
   requireThat(manager||a.role==='researcher','Research permission required.',403);
   if(old)manage();
   let companyId=old?.company_id||text(b.company_id),name='';
   if(companyId){const company=get(db,companyId);requireThat(company.kind==='company','Choose a company from the master list.');name=company.name;}
   else {name=text(b.name,200);requireThat(name,'Enter a company name.');const normalized=name.toLowerCase().replace(/\s+/g,' ');const company=find('company',normalized);companyId=company?.id||save('company','',normalized,{name});}
   key=role+':'+companyId;requireThat(old?.id===find(kind,key)?.id,'This company is already in the role universe.',409);
   const strategy=find('strategy',role);const s=strategy?get(db,strategy.id):null;
   const team=text(b.team_id),owner=manager?text(b.owner_id):(team?a.id:'');
   if(team)requireThat(db.rows('SELECT id FROM teams WHERE id=?',team).length,'Choose a team.');
   if(owner){const rm=researcher(owner);requireThat(team&&db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',team,rm.staff_id||rm.staffId).length,'The researcher must belong to this team.');}
   requireThat(['','High','Normal','Low'].includes(text(b.priority)),'Choose a valid priority.');
   next={...old,name,company_id:companyId,team_id:team,owner_id:owner,reviewer_id:'',scope:text(b.scope,5000),target_titles:text(b.target_titles,1000),category:text(b.category,200),priority:text(b.priority),expected:count(b.expected,'Expected talent'),due:b.due?day(b.due):'',status:old?.status||'Not started',source:old?.source||(manager?'Planned':'Researcher added'),strategy_revision:old?.strategy_revision||s?.revision||null,created_by:old?.created_by||a.id};
  } else {
   requireThat(old,'Company not found.');key=role+':'+old.company_id;
   if(b.action==='company-claim'){requireThat(!old.owner_id,'This company is already assigned.',409);const m=researcher(a.id);requireThat(db.rows('SELECT staff_id FROM team_members WHERE team_id=? AND staff_id=?',old.team_id,m.staff_id||m.staffId).length,'You must be a member of the assigned team.');next={...old,owner_id:a.id,status:'In progress',started_at:iso()};}
   else {requireThat(manager||old.owner_id===a.id,'Only the owner or role manager can update coverage.',403);requireThat(['Not started','In progress','Partially mapped','Completed','No relevant talent','Blocked','Revisit required'].includes(b.status),'Choose a coverage status.');requireThat(!['Completed','No relevant talent','Blocked'].includes(b.status)||text(b.notes),'Explain coverage or the blocker.');next={...old,status:b.status,notes:text(b.notes,5000),started_at:old.started_at||iso(),completed_at:['Completed','No relevant talent'].includes(b.status)?iso():null};}
  }
 } else if(b.action==='mapping-add') {
  requireThat(a.role==='researcher','Mappings must be recorded by a researcher account.',403);const person=researcher(a.id);
  const target=get(db,text(b.target_id));requireThat(target.kind==='target'&&target.role_id===role,'Choose a company in this role.');requireThat(target.owner_id===a.id,'Claim this company or ask the manager to assign it to you.',403);
  requireThat(!['Completed','No relevant talent','Blocked'].includes(target.status),'Reopen company research before adding mappings.');
  const items=b.items;requireThat(Array.isArray(items)&&items.length>0&&items.length<=100,'Add between 1 and 100 candidates.');
  const ids=[];for(const item of items){const url=linkedin(item.url);requireThat(text(item.name)&&text(item.title)&&text(item.rationale),'Name, title and fit rationale are required.');
   const existing=find('candidate',url);const cid=existing?.id||save('candidate','',url,{name:text(item.name,200),title:text(item.title,300),url,company:get(db,target.company_id).name});
   requireThat(!find('mapping',role+':'+cid),'A candidate is already mapped to this role. No rows were added.',409);
   const mapped={candidate_id:cid,target_id:target.id,name:text(item.name,200),title:text(item.title,300),url,rationale:text(item.rationale,5000),company:get(db,target.company_id).name,mapper_id:a.id,staff_id:person.staff_id||person.staffId,team_id:target.team_id,reviewer_id:target.reviewer_id,status:'Draft',created_at:iso(),strategy_revision:target.strategy_revision};
   const mid=save('mapping',role,role+':'+cid,mapped);db.audit(a,b.action,mid,null,mapped);ids.push(mid);
  }return {ids};
 } else if(['mapping-edit','mapping-submit','mapping-review','mapping-reassign','mapping-reopen'].includes(b.action)) {
  requireThat(old?.kind==='mapping','Mapping not found.');kind='mapping';key=role+':'+old.candidate_id;next={...old};
  if(b.action==='mapping-edit'){requireThat(old.mapper_id===a.id&&['Draft','Needs information'].includes(old.status),'Only the mapper can edit a draft or returned mapping.',403);requireThat(text(b.rationale),'Enter a fit rationale.');next.rationale=text(b.rationale,5000);}
  if(b.action==='mapping-submit'){requireThat(old.mapper_id===a.id&&['Draft','Needs information','Hold'].includes(old.status),'This mapping cannot be submitted by you.',403);const reviewerId=old.reviewer_override?old.reviewer_id:resolvePeer(old.team_id,old.staff_id);teammate(reviewerId,old.team_id,old.staff_id);next.reviewer_id=reviewerId;const p=member(search.partner_id);requireThat(['admin','partner','founder'].includes(p.role),'Assign an engagement partner to this role.');const strategy=find('strategy',role);const cutover=strategy?get(db,strategy.id).cutover:null;requireThat(cutover&&new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date())>=cutover,'Candidate submissions open on '+cutover+'. Keep this mapping as a draft until then.');next.strategy_revision=old.strategy_revision||(strategy?get(db,strategy.id).revision:null);next.status='Peer review';next.submitted_at=old.submitted_at||iso();next.stage_at=iso();next.work_date=old.work_date||new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());next.peer_decision=null;next.partner_decision=null;next.cycle=(old.cycle||0)+1;}
  if(b.action==='mapping-review') {
   const stage=old.status==='Peer review'?'peer':old.status==='Partner review'?'partner':'';requireThat(stage,'This mapping is not awaiting review.',409);
   requireThat(a.id!==old.mapper_id&&(!a.staffId||a.staffId!==old.staff_id),'Self-review is not allowed.',403);
   requireThat(stage==='peer'?old.reviewer_id===a.id:search.partner_id===a.id,'This review is assigned to another person.',403);
   if(stage==='peer')teammate(a.id,old.team_id,old.staff_id);
   requireThat(['Approve','Reject','Hold','Needs information'].includes(b.decision),'Choose a decision.');
   requireThat(b.decision==='Approve'||text(b.notes),'Add a reason or requested information.');
   requireThat(b.decision!=='Reject'||['Wrong level','Wrong function','Insufficient scale','Industry mismatch','Geography mismatch','Insufficient evidence','Compensation mismatch','Other'].includes(b.reason),'Select a rejection reason.');
   next[stage+'_decision']=b.decision;next.status=b.decision==='Approve'?(stage==='peer'?'Partner review':'Approved'):b.decision==='Reject'?'Rejected':b.decision;next.stage_at=iso();next.last_feedback=text(b.notes,5000);next.reason=text(b.reason);next.last_review_hours=Math.max(0,(Date.now()-Date.parse(old.stage_at))/3600000);
  }
  if(b.action==='mapping-reassign'){requireThat(canPlan(a),'Planning permission required.',403);teammate(b.reviewer_id,old.team_id,old.staff_id);next.reviewer_id=b.reviewer_id;next.reviewer_override=true;}
  if(b.action==='mapping-reopen'){manage();requireThat(['Approved','Rejected'].includes(old.status),'Only decided mappings can be reopened.');requireThat(text(b.notes),'Explain why this mapping is reopened.');next.status='Needs information';next.peer_decision=null;next.partner_decision=null;next.last_feedback=text(b.notes,5000);}
 } else throw new Error('Unknown research action.');
 requireThat(!old||old.kind===kind,'Wrong record type.');
 id=save(kind,['company','peer-route','team-reviewer'].includes(kind)?'':role,key,next,old);
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
