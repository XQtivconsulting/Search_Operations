type AccessSubject={role?:unknown;roles?:unknown;permissions?:unknown;accessRoles?:unknown};
const allRoles=['admin','planner','partner','researcher','engagement','data_quality','founder'];
const editRoles=['admin','planner','partner','researcher','engagement','data_quality'];
const define=(id:string,group:string,label:string,description:string,legacy:string[]=allRoles)=>({id,group,label,description,legacy});
// Legacy lists support unenriched migration/internal actors; signed-in actors always carry saved permissions.
export const permissionGroups=[
 define('search.view','Search setup','View search repository','View searches, JD, criteria, targets, guidance and pitch.'),
 define('search.create','Search setup','Create searches','Create a new search.',['admin','planner']),
 define('search.edit','Search setup','Edit search details','Update search name, client and status.',['admin','planner']),
 define('search.delete','Search setup','Delete unused searches','Only searches without recorded work can be removed. Close historical searches instead.',['admin','planner']),
 define('search.partner','Search setup','Assign search partner','Set or change the engagement partner.',['admin','planner']),
 define('search.jd','Search setup','Add or update job descriptions','Upload and maintain a search JD.',['admin','planner','partner']),
 define('search.fit','Search setup','Configure fit criteria','Define, weight and approve assessment criteria.',['admin','planner','partner']),
 define('search.targets','Search setup','Manage target companies','Add, assign, clone and update search targets.',['admin','planner','partner']),
 define('search.keywords','Search setup','Manage keyword guidance','Write and approve sourcing guidance.',['admin','planner','partner']),
 define('search.pitch','Search setup','Add or update pitch','Maintain the internal candidate pitch.'),
 define('companies.view','Companies & candidates','View companies','Browse the company directory.'),
 define('companies.edit','Companies & candidates','Create and update companies','Maintain company master data.',['admin','planner']),
 define('candidates.view','Companies & candidates','View candidates','View candidate profiles, notes and documents.'),
 define('candidates.create','Companies & candidates','Create candidates','Add a candidate to the directory.'),
 define('candidates.edit','Companies & candidates','Edit candidates','Maintain profiles, notes, files and executive summaries.',editRoles),
 define('candidates.add','Companies & candidates','Add candidates to searches','Link a candidate to a search under your account.',['researcher']),
 define('candidates.fit','Companies & candidates','Fill candidate fit assessments','Record evidence and rationale on draft or returned mappings.',['researcher']),
 define('candidates.delete','Companies & candidates','Archive candidates','Hide candidates from the active directory while retaining history.',['admin','partner']),
 define('candidates.import','Companies & candidates','Import candidate files','Import candidate spreadsheets.',['data_quality']),
 define('reviews.submit','Reviews','Send to team review','Submit sourcing work, preserving candidate attribution.',['researcher']),
 define('reviews.team','Reviews','Team review and send to partner','Review candidates in your sourcing team or assigned search.',['admin','researcher','partner']),
 define('reviews.partner','Reviews','Complete partner review','Approve or return candidates as the assigned search partner.',['admin','partner']),
 define('reviews.manage','Reviews','Manage reviews','Reassign reviews or reopen decided mappings with a reason.',['admin','planner','partner']),
 define('planning.view','Planning & allocation','View weekly plan and monitor','Read decisions, allocations and sourcing progress.'),
 define('planning.decisions','Planning & allocation','Make sourcing decisions','Set weekly Start, Continue, Pause and other decisions.',['admin','planner']),
 define('planning.allocate','Planning & allocation','Allocate sourcing teams','Assign, move and copy sourcing allocations and tasks.',['admin','planner']),
 define('planning.monitor','Planning & allocation','Manage sourcing monitor activities','Manage operational assignments and routing from the monitor.',['admin','planner']),
 define('teams.create','Planning & allocation','Create sourcing teams','Create team records.',['admin','planner']),
 define('teams.members','Planning & allocation','Maintain team membership','Edit team rosters and team leads.',['admin','planner']),
 define('teams.assign','Planning & allocation','Assign or move associates','Assign associates to existing sourcing teams.',['admin','planner']),
 define('engagement.view','Engagement','View engagement and interviews','View dashboard, queue and interview tracker.'),
 define('engagement.assign','Engagement','Assign engagement resources','Assign people directly to searches across all funnel stages.',['admin','planner','partner']),
 define('engagement.work','Engagement','Update engagement activities','Record activities and move candidates on assigned searches.',['admin','planner','partner','engagement']),
 define('engagement.interviews','Engagement','Maintain interview tracker','Record dates, outcomes and feedback on assigned searches.',['admin','planner','partner','engagement']),
 define('engagement.config','Engagement','Configure engagement pipeline','Edit stages and activity thresholds.',['admin']),
 define('pto.self','PTO & reporting','Record own PTO','Create and update your own PTO.'),
 define('pto.all','PTO & reporting','Enter PTO for others','Create PTO for any active colleague.',['admin']),
 define('pto.edit','PTO & reporting','Edit or clear others’ PTO','Change or remove existing PTO for colleagues.',['admin']),
 define('reports.view','PTO & reporting','View sourcing performance','View delivery and performance reports.'),
 define('data.export','PTO & reporting','Export workspace data','Download business workbooks and attachments.',[]),
 define('data.backup','PTO & reporting','Manage business backups','Run and download private business backups. Reset remains Super Admin only.',[]),
 define('users.view','People & administration','View people directory','View accepted accounts and profile details.',['admin']),
 define('users.profile','People & administration','Update user profiles','Edit display names without changing sign-in email, roles or access.',['admin']),
 define('users.invite','People & administration','Invite users','Create or cancel invitations.',['admin']),
 define('users.access','People & administration','Manage user access','Assign roles and revoke or restore access. Super Admin remains protected.',['admin']),
 define('roles.manage','People & administration','Manage roles and permissions','Create, edit or delete ordinary roles and their permissions.',['admin']),
 define('integrations.manage','People & administration','Manage integrations and settings','Run RecruitCRM imports, manage integration records and configure sourcing effort hours.',['admin']),
];
export const permissionIds=permissionGroups.map(p=>p.id);
export function hasPermission(a:AccessSubject={},key:string):boolean{
 const assigned=Array.isArray(a.roles)?a.roles:[a.role];if(assigned.includes('super_admin'))return true;
 if(Array.isArray(a.permissions))return a.permissions.includes(key);
 return !!permissionGroups.find(p=>p.id===key)?.legacy.some(r=>assigned.includes(r));
}
export type RoleDefinition={id:string;name:string;description:string;permissions:string[];version:number;updated_at?:string;users?:number;invitations?:number;retired?:boolean};
const view=['search.view','companies.view','candidates.view','planning.view','engagement.view','reports.view'];
const shared=[...view,'search.jd','search.pitch','companies.edit','candidates.create','candidates.edit','candidates.add','candidates.fit','pto.self'];
const research=['reviews.submit','reviews.team'];
const lead=['planning.decisions','planning.allocate','planning.monitor','search.targets','search.keywords','teams.assign','pto.edit','engagement.work','engagement.interviews'];
const engage=['engagement.work','engagement.interviews'];
const make=(id:string,name:string,permissions:string[],description:string):RoleDefinition=>({id,name,permissions:[...new Set(permissions)],description,version:0});
export const roleTemplates:RoleDefinition[]=[
 make('researcher','Researcher',[...shared,...research],'Source candidates and perform eligible team reviews'),
 make('research_lead','Research Team Lead',[...shared,...research,...lead,'engagement.assign'],'Lead sourcing delivery and allocate researchers'),
 make('engagement','Engagement Resource',[...shared,...engage],'Manage candidate engagement on assigned searches'),
 make('engagement_lead','Engagement Lead',[...shared,...engage,'engagement.assign','engagement.config','planning.allocate','planning.monitor','teams.assign','pto.edit'],'Lead engagement delivery and resource allocation'),
 make('partner','Partner',[...shared,...engage,...lead,'search.create','search.edit','search.partner','search.fit','candidates.delete','reviews.partner','reviews.team','reviews.manage','engagement.assign','engagement.config','pto.all','data.export','data.backup','users.view','users.profile'],'Own searches, review candidates and oversee delivery'),
 make('admin','Admin',permissionIds,'Manage workspace operations, users and permissions'),
 make('planner','Planner',[...view,'search.jd','search.pitch','companies.edit','planning.decisions','planning.allocate','planning.monitor','teams.assign','engagement.assign','pto.self'],'Compatibility template for existing planners'),
 make('data_quality','Data Quality',[...view,'candidates.create','candidates.edit','candidates.import','pto.self'],'Maintain and import candidate data'),
 make('founder','Founder',[...view,'pto.self'],'Read-only oversight'),
];
export function effectivePermissions(assigned:string[],definitions:RoleDefinition[]):string[]{
 const granted=assigned.includes('super_admin')?[...permissionIds]:assigned.flatMap(id=>definitions.find(d=>d.id===id)?.permissions||[]);
 const out=new Set(granted);
 for(const p of granted){
  if(p.startsWith('search.'))out.add('search.view');
  if(p.startsWith('companies.'))out.add('companies.view');
  if(p.startsWith('candidates.')||p.startsWith('reviews.'))out.add('candidates.view');
  if(p.startsWith('planning.')||p.startsWith('teams.'))out.add('planning.view');
  if(p.startsWith('engagement.'))out.add('engagement.view');
  if(p.startsWith('users.')||p==='roles.manage')out.add('users.view');
  if(p==='candidates.add'||p.startsWith('reviews.')||p.startsWith('planning.')||p.startsWith('engagement.'))out.add('search.view');
 }
 return [...out];
}
export function effectiveAccessRoles(assigned:string[],definitions:RoleDefinition[]):string[]{
 const p=effectivePermissions(assigned,definitions),out:string[]=[];
 if(assigned.includes('super_admin'))out.push('super_admin','admin');
 if(p.includes('roles.manage')&&p.includes('users.access'))out.push('admin');
 if(p.includes('planning.allocate'))out.push('planner');
 if(p.includes('reviews.partner'))out.push('partner');
 if(p.includes('reviews.submit'))out.push('researcher');
 if(p.includes('engagement.work')||p.includes('engagement.interviews'))out.push('engagement');
 if(p.includes('candidates.import'))out.push('data_quality');
 if(p.includes('reports.view'))out.push('founder');
 return [...new Set(out)];
}
export const assignedRoleName=(id:string,definitions:RoleDefinition[]=[])=>id==='super_admin'?'Super Admin':definitions.find(d=>d.id===id)?.name||id;

export const retiredRoleIds=['planner','founder'];
export const activeRoleTemplates=roleTemplates.filter(r=>!retiredRoleIds.includes(r.id));
