import {hasPermission} from './access-policy';
import {requireThat,text} from './domain';
import type {Actor} from './domain';
type DB={rows:(q:string,...p:any[])=>any[]};
const researchPermissions:Record<string,string>={
 'historical-mapping-import':'integrations.manage',
 'historical-interview-import':'integrations.manage',
 'interview-import-settings':'integrations.manage',
 'pitch-save':'search.pitch','target-clone':'search.targets','task-save':'planning.allocate','task-status':'planning.monitor',
 'company-master':'companies.edit','company-master-and-target':'companies.edit','company-import':'companies.edit',
 'peer-route':'reviews.manage','team-reviewer':'teams.members',
 'brief-save':'search.jd','brief-approve':'search.jd','brief-publish':'search.jd','brief-unpublish':'search.jd','brief-release':'search.jd',
 'brief-file-save':'search.jd','brief-file-list':'search.view','brief-file-read':'search.view',
 'target-assign':'search.targets','target-coverage':'search.targets','target-wave':'search.targets','target-assign-batch':'search.targets','target-waves':'search.targets','company-batch':'search.targets','company-save':'search.targets',
 'company-claim':'candidates.add','company-progress':'candidates.add',
 'mapping-add':'candidates.add','mapping-link':'candidates.add','mapping-inline':'candidates.add','candidate-assign':'candidates.add',
 'mapping-edit':'candidates.fit','mapping-submit':'reviews.submit','mapping-reassign':'reviews.manage','mapping-reopen':'reviews.manage',
 'candidate-import':'candidates.import','candidate-archive':'candidates.delete',
 'candidate-file-save':'candidates.edit','candidate-file-list':'candidates.view','candidate-file-read':'candidates.view',
 'candidate-summary-draft':'candidates.edit','candidate-summary-save':'candidates.edit','candidate-summary-publish':'candidates.edit',
 'candidate-note':'candidates.edit','candidate-tags':'candidates.edit','candidate-compensation':'candidates.edit','candidate-attributes':'candidates.edit',
 'engagement-search-assign':'engagement.assign','engagement-update':'engagement.work','engagement-interview-save':'engagement.interviews','engagement-pipeline-save':'engagement.config'
};
const mutationPermissions:Record<string,string>={
 'staff':'users.profile','staff-edit':'users.profile','staff-archive':'users.access',
 'sourcing-settings':'integrations.manage',
 'week-copy':'planning.allocate','plan-transfer':'planning.allocate','week-plan':'planning.allocate','assignment':'planning.allocate','assignment-edit':'planning.allocate',
 'decision':'planning.decisions','team':'teams.create','team-members':'teams.members','team-transfer':'teams.assign','team-reviewer':'teams.members',
 'crm-owner':'search.partner','search-owner':'search.partner','search-remove':'search.delete','search-manage':'search.edit','search':'search.create',
 'search-number-batch':'integrations.manage','search-import':'integrations.manage'
};
function allow(a:Actor,p:string){requireThat(p&&hasPermission(a,p),'Permission required: '+(p||'recognized action')+'.',403);}
// The old workflow validators use capability roles. Supply only an operation-specific
// adapter AFTER the exact permission check. Identity, tenant, permissions, record
// ownership, versions and audits remain unchanged. Nested operations reauthorize.
function scoped(a:Actor,roles:string[]):Actor{return {...a,accessRoles:[...new Set([...(a.accessRoles||[]),...roles])]};}
export function authorizeResearch(db:DB,a:Actor,b:any):Actor{
 if(!Array.isArray(a.permissions))return a;
 if(b.action==='mapping-batch')return a; // Every item is reauthorized in researchMutation.
 const row=b.id?db.rows('SELECT kind,data FROM research_records WHERE id=?',text(b.id))[0]:null,old=row?JSON.parse(row.data):null;
 let p=researchPermissions[b.action];
 if(b.action==='candidate-save')p=b.id?'candidates.edit':'candidates.create';
 if(b.action==='mapping-review')p=old?.status==='Partner review'?'reviews.partner':'reviews.team';
 if(b.action==='strategy-save'){
  const criteriaChanged=JSON.stringify(b.criteria||old?.criteria||[])!==JSON.stringify(old?.criteria||[]);
  const guidanceChanged=text(b.content,40000)!==(old?.draft||'');
  if(criteriaChanged)allow(a,'search.fit');
  if(guidanceChanged)allow(a,'search.keywords');
  requireThat(hasPermission(a,'search.fit')||hasPermission(a,'search.keywords'),'Strategy editing permission required.',403);
  return scoped(a,['planner']);
 }
 if(b.action==='strategy-approve')p='search.fit'; // Criteria owner approves the combined sourcing brief.
 allow(a,p);
 if(['engagement-update','engagement-interview-save','mapping-review'].includes(b.action))return a; // Retain assigned-search/reviewer constraints.
 const planner=['search.','companies.','planning.','teams.','reviews.manage'].some(prefix=>p.startsWith(prefix));
 return scoped(a,planner?['planner']:p==='engagement.config'?['admin']:p==='engagement.assign'?['planner']:p==='candidates.import'?['data_quality','researcher']:['researcher']);
}
export function authorizeMutation(db:DB,a:Actor,kind:string,b:any):Actor{
 if(!Array.isArray(a.permissions))return a;
 if(kind==='effort'){
  if(a.staffId===b.staff_id&&hasPermission(a,'reviews.submit'))return {...a,accessRoles:['researcher']};
  allow(a,'planning.monitor');return scoped(a,['planner']);
 }
 let p=mutationPermissions[kind];
 if(kind==='pto'){
  const old=db.rows('SELECT pto FROM time_off WHERE staff_id=? AND work_date=?',text(b.staff_id),text(b.work_date))[0];
  p=a.staffId===b.staff_id?'pto.self':old?.pto?'pto.edit':'pto.all';
 }
 allow(a,p);
 if(kind==='search'&&b.partner_id)allow(a,'search.partner');
 return scoped(a,['admin','planner']);
}
