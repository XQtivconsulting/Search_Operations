import {backfillDraftTargets} from './draft-targets';
import {canImportCandidates} from './candidate-tags';
import {crmAssignments,crmCandidateDetails,crmSlug,crmList} from './crm-candidates';
import {conversionSchema,startConversion,nextConversionItem,saveConversionDetails,conversionPreview,applyConversionItem} from './crm-conversion';
import {snapshotBusiness,buildBusinessArchive} from './backup-export';
import {storeBusinessBackup,nextWeeklyBackup} from './backup-service';
import {engagementMutation} from './engagement-domain';
import {exactCompany,companyNames,normalizedCompany} from './company-match';
import {resetSchema,resetSnapshot,clearWorkspace,saveCleanBaseline} from './workspace-reset';
import {effortSchema,saveEffort} from './effort';
import {isWorkingDecision} from './search-decisions';
import {planCandidates} from './candidate-import';
import {candidateSchema,createCandidateInvite,listCandidateInvites,revokeCandidateInvite,requestCandidateCode,verifyCandidateCode,candidatePage} from './candidate-access';
import {planCompanyImport} from './company-import';
import { DurableObject } from "cloudflare:workers";
import {researchSchema,researchState,researchRecords,researchMutation,derivedEntries,linkedin} from "./research";
import type {Member} from "./research";
import {weekStart,weekDays} from './planning';
import { workspaceSchema } from "./schema";
import type { CRMJob } from './recruitcrm';
import {hasRole,
  Actor,
  canPlan,
  canPartnerReview,
  requireThat,
  text,
  count,
  day,
  safeLink,
  validateCounts,
} from "./domain";
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
export class Workspace extends DurableObject {
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    ctx.storage.sql.exec(workspaceSchema);
    ctx.storage.sql.exec(resetSchema);
    this.rows('CREATE TABLE IF NOT EXISTS account_researchers(staff_id TEXT PRIMARY KEY,user_id TEXT NOT NULL)');
    this.rows('CREATE TABLE IF NOT EXISTS backup_runs(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,status TEXT NOT NULL,details TEXT NOT NULL)');
    this.rows('CREATE TABLE IF NOT EXISTS candidate_files(id TEXT PRIMARY KEY,candidate_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,category TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL)');
    this.rows('CREATE TABLE IF NOT EXISTS candidate_file_chunks(file_id TEXT NOT NULL REFERENCES candidate_files(id),part INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(file_id,part))');
    this.rows('CREATE TABLE IF NOT EXISTS brief_files(id TEXT PRIMARY KEY,role_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,created_at TEXT NOT NULL)');
    this.rows('CREATE TABLE IF NOT EXISTS brief_file_chunks(file_id TEXT NOT NULL REFERENCES brief_files(id),part INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(file_id,part))');
    ctx.storage.sql.exec(effortSchema);
    this.rows('CREATE TABLE IF NOT EXISTS time_off(staff_id TEXT NOT NULL REFERENCES staff(id),work_date TEXT NOT NULL,pto INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(staff_id,work_date))');
    ctx.storage.sql.exec(researchSchema);
    ctx.storage.sql.exec(candidateSchema);
    this.rows(conversionSchema);
    if(!this.rows('PRAGMA table_info(crm_jobs)').some(c=>c.name==='job_slug'))this.rows("ALTER TABLE crm_jobs ADD COLUMN job_slug TEXT NOT NULL DEFAULT ''");
    this.rows("CREATE TABLE IF NOT EXISTS crm_partners(external_id TEXT PRIMARY KEY,partner_id TEXT NOT NULL DEFAULT '',partner TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1)");
    // Retire Hold without losing its review history or reviewer feedback.
    ctx.storage.transactionSync(()=>{for(const r of this.rows("SELECT * FROM research_records WHERE kind='mapping' AND json_extract(data,'$.status')='Hold'")){const old=JSON.parse(r.data),next={...old,status:'Needs information',last_feedback:old.last_feedback||'Returned from the retired Hold stage. Please update the evidence and resubmit.'};this.rows('UPDATE research_records SET data=?,version=version+1 WHERE id=?',JSON.stringify(next),r.id);this.audit({id:'system-migration'} as Actor,'retire-hold',r.id,old,next);}});
    if(!this.rows('PRAGMA table_info(crm_jobs)').some(c=>c.name === 'company_name'))
      this.rows("ALTER TABLE crm_jobs ADD COLUMN company_name TEXT NOT NULL DEFAULT ''");
    if(!this.rows('PRAGMA table_info(searches)').some(c=>c.name === 'partner_id'))
      this.rows("ALTER TABLE searches ADD COLUMN partner_id TEXT NOT NULL DEFAULT ''");
    if(!this.rows("SELECT value FROM settings WHERE key='draft_targets_v1'").length)ctx.storage.transactionSync(()=>{
      backfillDraftTargets(this);
      this.rows("INSERT INTO settings(key,value) VALUES('draft_targets_v1','1')");
    });
    if(!this.rows("SELECT value FROM settings WHERE key='planning_v2'").length) {
      ctx.storage.transactionSync(()=>{
        // Keep the original events; materialize only the latest decision for each calendar week.
        for(const d of this.rows('SELECT * FROM weekly_decisions ORDER BY created_at, rowid'))
          this.rows('INSERT INTO weekly_priorities(search_id,week,disposition,notes) VALUES(?,?,?,?) ON CONFLICT(search_id,week) DO UPDATE SET disposition=excluded.disposition,notes=excluded.notes',d.search_id,weekStart(d.week),d.disposition,d.notes);
        this.rows("INSERT INTO settings(key,value) VALUES('planning_v2','1')");
      });
    }
  }
  rows(q: string, ...p: any[]): any[] {
    return this.ctx.storage.sql.exec(q, ...p).toArray();
  }
  audit(a: Actor, action: string, id: string, before: any, after: any) {
    this.rows(
      "INSERT INTO audit VALUES(?,?,?,?,?,?,?)",
      uuid(),
      a.id,
      action,
      id,
      JSON.stringify(before),
      JSON.stringify(after),
      now(),
    );
  }
  async ensureBackupSchedule(tenant:string) {
    if(!(this.env as any).BACKUPS)return;
    const old=this.rows("SELECT value FROM settings WHERE key='backup_tenant'")[0];
    requireThat(!old||old.value===tenant,'Backup workspace mismatch.',403);
    this.rows("INSERT OR IGNORE INTO settings VALUES('backup_tenant',?)",tenant);
    if(!await this.ctx.storage.getAlarm())await this.ctx.storage.setAlarm(nextWeeklyBackup());
  }
  async backupStatus(a:Actor){
    requireThat(hasRole(a,'super_admin'),'Workspace owner permission required.',403);
    await this.ensureBackupSchedule(a.tenant);
    return {configured:!!(this.env as any).BACKUPS,next_at:await this.ctx.storage.getAlarm(),runs:this.rows('SELECT * FROM backup_runs ORDER BY created_at DESC LIMIT 20').map(r=>({...r,details:JSON.parse(r.details)}))};
  }
  async exportBusiness(a:Actor,people:any[]){
    requireThat(hasRole(a,'super_admin'),'Workspace owner permission required.',403);
    const snapshot=this.ctx.storage.transactionSync(()=>snapshotBusiness(this,a.tenant,people));
    const bytes=buildBusinessArchive(snapshot);
    this.audit(a,'business-export',a.tenant,null,{sha256:snapshot.sha256});return bytes;
  }
  async backupNow(a:Actor,people:any[]){
    requireThat(hasRole(a,'super_admin'),'Workspace owner permission required.',403);
    await this.ensureBackupSchedule(a.tenant);
    return storeBusinessBackup(this,this.ctx.storage,(this.env as any).BACKUPS,a.tenant,people);
  }
  async alarm(){
    const tenant=this.rows("SELECT value FROM settings WHERE key='backup_tenant'")[0]?.value;
    if(!tenant||!(this.env as any).BACKUPS)return;
    try {
      const people=await (this.env as any).IDENTITY.getByName('identity-v1').members(tenant);
      await storeBusinessBackup(this,this.ctx.storage,(this.env as any).BACKUPS,tenant,people);
      await this.ctx.storage.setAlarm(nextWeeklyBackup());
    } catch {
      this.rows('INSERT INTO backup_runs VALUES(?,?,?,?)',crypto.randomUUID(),new Date().toISOString(),'failed',JSON.stringify({error:'Scheduled backup failed. Retry scheduled in one hour; inspect storage connection and export size.'}));
      await this.ctx.storage.setAlarm(Date.now()+3600000);
      console.error('Scheduled business backup failed');
    }
  }
  async saveCleanBaseline(a:Actor,people:any) {return this.ctx.storage.transactionSync(()=>saveCleanBaseline(this,a,people));}
  async previewReset(a:Actor) {const {signature,counts}=resetSnapshot(this,a);return {signature,counts};}
  async resetWorkspace(a:Actor,b:any,people:any) {return this.ctx.storage.transactionSync(()=>clearWorkspace(this,a,b.signature,people));}
  async resetBackups(a:Actor) {requireThat(hasRole(a,'super_admin'),'Workspace owner permission required.',403);return this.rows("SELECT id,created_at,json_extract(data,'$.label') label,json_extract(data,'$.kind') kind FROM reset_backups WHERE actor=? ORDER BY created_at DESC",a.id);}
  async resetBackup(a:Actor,id:string) {
    requireThat(hasRole(a,'super_admin'),'Workspace owner permission required.',403);
    const row=this.rows('SELECT data FROM reset_backups WHERE id=? AND actor=?',id,a.id)[0];
    requireThat(row,'Backup not found.',404);
    const backup=JSON.parse(row.data);backup.tables={};
    for(const r of this.rows('SELECT * FROM reset_backup_rows WHERE backup_id=? ORDER BY table_name,row_no',id))(backup.tables[r.table_name]??=[]).push(JSON.parse(r.data));
    return backup;
  }
  async research(a: Actor,b:any,members:Member[]):Promise<any> {await this.syncPeople(members);return this.ctx.storage.transactionSync(()=>{
      if(['candidate-file-save','candidate-file-list','candidate-file-read'].includes(b.action)) {
        const c=this.rows("SELECT id FROM research_records WHERE id=? AND kind='candidate'",text(b.candidate_id))[0];requireThat(c,'Candidate not found.',404);
        if(b.action==='candidate-file-list')return this.rows('SELECT * FROM candidate_files WHERE candidate_id=? ORDER BY created_at DESC',c.id);
        if(b.action==='candidate-file-read'){const f=this.rows('SELECT * FROM candidate_files WHERE id=? AND candidate_id=?',b.file_id,c.id)[0];requireThat(f,'File not found.',404);return {...f,base64:this.rows('SELECT data FROM candidate_file_chunks WHERE file_id=? ORDER BY part',f.id).map(r=>r.data).join('')};}
        requireThat(canPlan(a)||hasRole(a,'data_quality')||hasRole(a,'researcher')||hasRole(a,'partner')||hasRole(a,'engagement'),'Candidate editing permission required.',403);
        const name=text(b.name,200),base64=String(b.base64||'');requireThat(/\.(pdf|docx|doc|txt|eml|mp3|m4a|wav|xlsx|xls)$/i.test(name)&&base64.length>0&&base64.length<=7e6&&/^[A-Za-z0-9+/]*={0,2}$/.test(base64),'Upload PDF, Word, Excel, text, email or audio up to 5 MB.');
        requireThat(['Resume','Candidate information','Transcript','Email exchange','Recording','Assessment','Other'].includes(b.category),'Choose a file category.');
        const id=uuid();this.rows('INSERT INTO candidate_files VALUES(?,?,?,?,?,?,?)',id,c.id,name,'application/octet-stream',b.category,a.id,now());for(let i=0;i<base64.length;i+=131072)this.rows('INSERT INTO candidate_file_chunks VALUES(?,?,?)',id,i,base64.slice(i,i+131072));this.audit(a,'candidate-file-save',id,null,{name,candidate_id:c.id,category:b.category});return {id};
      }
      if(String(b.action).startsWith('engagement-')||['candidate-note','candidate-tags','candidate-compensation','candidate-attributes'].includes(b.action))return engagementMutation(this,a,b,members);
      if(['brief-file-save','brief-file-list','brief-file-read'].includes(b.action)) {
        const search=this.rows('SELECT * FROM searches WHERE id=?',text(b.role_id))[0];requireThat(search,'Search not found.',404);
        if(b.action==='brief-file-list')return this.rows('SELECT * FROM brief_files WHERE role_id=? ORDER BY created_at DESC',b.role_id);
        if(b.action==='brief-file-read'){const f=this.rows('SELECT * FROM brief_files WHERE id=? AND role_id=?',b.file_id,b.role_id)[0];requireThat(f,'File not found.',404);return {...f,base64:this.rows('SELECT data FROM brief_file_chunks WHERE file_id=? ORDER BY part',f.id).map(r=>r.data).join('')};}
        requireThat(canPlan(a)||hasRole(a,'partner')&&search.partner_id===a.id||researchRecords(this).some(t=>t.kind==='task'&&t.role_id===b.role_id&&t.owner_id===a.id&&t.task_type==='Role brief'&&t.status!=='Cancelled'),'Search management permission required.',403);
        const name=text(b.name,200),base64=String(b.base64||'');requireThat(/\.(pdf|docx|doc)$/i.test(name)&&base64.length>0&&base64.length<=7e6&&/^[A-Za-z0-9+/]*={0,2}$/.test(base64),'Upload PDF or Word up to 5 MB.');
        const id=uuid(),mime=/\.pdf$/i.test(name)?'application/pdf':/\.docx$/i.test(name)?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/msword';
        this.rows('INSERT INTO brief_files VALUES(?,?,?,?,?)',id,b.role_id,name,mime,now());for(let i=0;i<base64.length;i+=131072)this.rows('INSERT INTO brief_file_chunks VALUES(?,?,?)',id,i,base64.slice(i,i+131072));this.audit(a,'brief-file-save',id,null,{name,role_id:b.role_id});return {id};
      }
      if(b.action==='mapping-inline') {
        requireThat(hasRole(a,'researcher'),'Researcher access required.',403);
        const records=researchRecords(this),url=linkedin(b.url),candidate=records.find(r=>r.kind==='candidate'&&r.url===url);
        if(candidate)requireThat(candidate.version===Number(b.candidate_version),'Candidate details changed. Reload before adding the mapping.',409);
        const role=text(b.role_id),team=text(b.team_id);
        requireThat(!candidate||!records.some(r=>r.kind==='mapping'&&r.role_id===role&&r.candidate_id===candidate.id),'This candidate is already mapped to this role.',409);
        const companyName=text(candidate?.company||b.company,200),normalize=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
        let company=exactCompany(records.filter(r=>r.kind==='company'),companyName),target:any=null;
        if(b.company_id){const selected=records.find(r=>r.id===b.company_id&&r.kind==='company');requireThat(selected&&companyNames(selected).includes(normalizedCompany(companyName)),'Select the matching company.');company=selected;}
        requireThat(!companyName||company||b.create_company===true,'Choose an existing company or explicitly add the new company.');
        if(companyName){
          target=company?records.find(r=>r.kind==='target'&&r.role_id===role&&r.company_id===company!.id):null;
          if(!target){const created=researchMutation(this,a,{action:'company-save',role_id:role,company_id:company?.id,name:companyName,team_id:team,owner_id:a.id},members);target=researchRecords(this).find(r=>r.id===created.id);company=researchRecords(this).find(r=>r.id===target.company_id);}
          else if(!target.owner_id&&target.team_id===team){researchMutation(this,a,{...target,action:'company-claim'},members);target={...target,owner_id:a.id};}
        }
        const linked=target?.owner_id===a.id&&target.team_id===team?target.id:'';
        return researchMutation(this,a,{action:'mapping-add',role_id:role,team_id:team,target_id:linked,items:[{rationale:b.rationale,evidence:b.evidence,candidate_id:candidate?.id,url,first_name:b.first_name,last_name:b.last_name,company:company?.name||companyName,company_id:company?.id||''}]},members);
      }
      if(b.action==='candidate-import'||b.action==='candidate-assign') {
        requireThat(canImportCandidates(a)||canPlan(a)||hasRole(a,'researcher')||hasRole(a,'engagement')||hasRole(a,'partner'),'Candidate editing permission required.',403);
        const records=researchRecords(this),candidates=records.filter(r=>r.kind==='candidate');
        const assigning=b.action==='candidate-assign';
        if(!assigning)requireThat(canImportCandidates(a),'Excel import requires Data quality analyst or Super admin permission.',403);
        if(assigning)requireThat(Array.isArray(b.candidate_ids)&&b.candidate_ids.length>0&&b.candidate_ids.length<=500&&new Set(b.candidate_ids).size===b.candidate_ids.length,'Select 1–500 distinct candidates.');
        const candidatesById=new Map(candidates.map(c=>[c.id,c]));
        const rows=assigning?b.candidate_ids.map((id:string)=>{const c=candidatesById.get(id);requireThat(c,'Candidate not found.',404);return c;}):b.rows;
        const plan=planCandidates(rows,candidates),role=text(b.role_id);
        if(assigning)requireThat(role,'Choose a role.');
        if(role){requireThat(hasRole(a,'researcher'),'Enable the Researcher role before recording mappings.',403);requireThat(this.rows('SELECT id FROM searches WHERE id=?',role).length,'Role not found.',404);}
        const mappedCandidates=new Set(records.filter(m=>m.kind==='mapping'&&m.role_id===role).map(m=>m.candidate_id));
        const preview=plan.map(c=>({...c,mapping:!role?'Not requested':c.status==='Duplicate in file'?'Skip duplicate':mappedCandidates.has(c.existingId)?'Already mapped':'Create draft'}));
        const signature=JSON.stringify({plan:preview,versions:records.filter(r=>r.kind==='candidate'||r.kind==='mapping').map(r=>[r.id,r.version]).sort(),role});
        if(b.preview)return {plan:preview,signature};
        requireThat(signature===b.signature,'Candidate data changed. Preview again before saving.',409);
        let created=0,reused=0,mapped=0,skipped=0;const links:any[]=[];
        for(const c of preview){if(c.status==='Duplicate in file'){skipped++;continue;}const id=c.existingId||researchMutation(this,a,{first_name:c.first_name,last_name:c.last_name,url:c.url,email:c.email,phone:c.phone,title:c.title,company:c.company,action:'candidate-save'},members).id;if(c.existingId)reused++;else created++;
          if(c.mapping==='Create draft')links.push({candidate_id:id,rationale:c.rationale||''});
        }
        for(let i=0;i<links.length;i+=100)researchMutation(this,a,{action:'mapping-link',role_id:role,items:links.slice(i,i+100)},members);mapped=links.length;
        return {created,reused,mapped,skipped};
      }
      if(b.action==='brief-release') {
        requireThat(b.page?.origin==='document','Upload the original document before publishing this page.');
        const saved=researchMutation(this,a,{...b,action:'brief-save'},members);
        const read=()=>{const r=this.rows('SELECT * FROM research_records WHERE id=?',saved.id)[0];return {id:r.id,version:r.version};};
        researchMutation(this,a,{...read(),action:'brief-approve'},members);
        researchMutation(this,a,{...read(),action:'brief-publish'},members);
        return saved;
      }
      if(b.action==='company-master-and-target') {
        requireThat(canPlan(a),'Planning permission required.',403);
        const company=researchMutation(this,a,{...b,role_id:'',action:'company-master'},members);
        const target=researchMutation(this,a,{action:'company-save',role_id:b.role_id,company_id:company.id},members);
        return {company,target};
      }
      if(b.action==='company-import') {
        requireThat(canPlan(a),'Planning permission required.',403);
        const existing=researchRecords(this).filter(r=>r.kind==='company');
        const plan=planCompanyImport(existing,b.rows,b.overwrite===true);
        const signature=JSON.stringify(existing.map(c=>[c.id,c.version]).sort());
        if(b.preview)return {plan,signature};
        requireThat(signature===b.signature,'The company list changed. Preview the import again.',409);
        const saved=plan.map(c=>researchMutation(this,a,{...c,id:c.existingId,action:'company-master'},members));
        if(b.role_id){requireThat(this.rows('SELECT id FROM searches WHERE id=?',b.role_id).length,'Search not found.',404);for(const c of saved){if(!researchRecords(this).some(t=>t.kind==='target'&&t.role_id===b.role_id&&t.company_id===c.id))researchMutation(this,a,{action:'company-save',role_id:b.role_id,company_id:c.id},members);}}
        return {saved};
      }
      if(b.action==='target-assign-batch') {
        requireThat(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=100&&new Set(b.items.map((i:any)=>i.id)).size===b.items.length,'Select 1–100 distinct companies.');
        requireThat(b.team_id&&b.owner_id,'Choose a team and researcher.');
        return {saved:b.items.map((item:any)=>{const target=researchRecords(this).find(r=>r.id===item.id&&r.kind==='target');requireThat(target&&target.role_id===b.role_id,'Select companies from this role.',404);requireThat(!['Completed','No relevant talent'].includes(target.status),'Reopen completed company research before reassigning it.',409);return researchMutation(this,a,{id:item.id,version:item.version,action:'target-assign',team_id:b.team_id,owner_id:b.owner_id},members);})};
      }
      if(b.action==='target-waves') {
        requireThat(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=100,'Select 1–100 targets.');
        requireThat(new Set(b.items.map((i:any)=>i.id)).size===b.items.length,'Select each target once.');
        return {saved:b.items.map((i:any)=>researchMutation(this,a,{...i,action:'target-wave',wave:b.wave},members))};
      }
      if(b.action==='company-batch') {
        requireThat(Array.isArray(b.company_ids)&&b.company_ids.length>0&&b.company_ids.length<=100,'Select 1–100 companies.');
        requireThat(new Set(b.company_ids).size===b.company_ids.length,'Select each company once.');
        return {saved:b.company_ids.map((company_id:string)=>researchMutation(this,a,{action:'company-save',role_id:b.role_id,company_id,category:b.category,wave:b.wave,team_id:b.team_id,owner_id:b.owner_id},members))};
      }
      if(b.action==='mapping-batch') {
        requireThat(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=100,'Select 1–100 mappings.');
        requireThat(new Set(b.items.map((i:any)=>i.id)).size===b.items.length,'Select each mapping once.');
        requireThat(['mapping-submit','mapping-review'].includes(b.operation),'Unsupported batch operation.');
        return {saved:b.items.map((item:any)=>researchMutation(this,a,{id:item.id,version:item.version,action:b.operation,decision:b.decision,reason:b.reason,notes:b.notes},members))};
      }
      return researchMutation(this,a,b,members);
    });}
  // Legacy anonymous links no longer grant role access.
  async publicBrief(_token:string) {return null;}
  async candidateInvite(a:Actor,b:any){return this.ctx.storage.transactionSync(()=>createCandidateInvite(this,a,b));}
  async candidateInvites(a:Actor,role:string){return listCandidateInvites(this,a,role);}
  async candidateRevoke(a:Actor,id:string){return this.ctx.storage.transactionSync(()=>revokeCandidateInvite(this,a,id));}
  async candidateCode(b:any,ip:string){return requestCandidateCode(this,b,ip);}
  async candidateVerify(b:any,ip:string){return verifyCandidateCode(this,b,ip);}
  async candidatePage(session:string,token?:string){return candidatePage(this,session,token);}
  assignmentHasWork(a:any) {
    return !!(this.rows('SELECT 1 FROM effort_records WHERE search_id=? AND team_id=? AND work_date=? AND days>0',a.search_id,a.team_id,a.work_date).length||this.rows("SELECT id FROM research_records WHERE kind='mapping' AND role_id=? AND json_extract(data,'$.team_id')=? AND json_extract(data,'$.work_date')=?",a.search_id,a.team_id,a.work_date).length||this.rows("SELECT id FROM entries WHERE assignment_id=? AND (mapped IS NOT NULL OR peer IS NOT NULL OR partner IS NOT NULL OR notes<>'' OR flag IS NOT NULL OR source<>'manual')",a.id).length||this.rows('SELECT r.id FROM reviews r JOIN entries e ON e.id=r.entry_id WHERE e.assignment_id=?',a.id).length);
  }
  async state(a: Actor,members?:Member[]) {
    if(members)await this.syncPeople(members);
    const research=researchState(this);
    const result = {
      research,
      effort:this.rows('SELECT * FROM effort_records'),
      effortDays:this.rows('SELECT * FROM effort_days'),
      timeOff:this.rows('SELECT * FROM time_off'),
      actor: a,
      name:
        this.rows("SELECT value FROM settings WHERE key=?", "name")[0]?.value ??
        "Workspace",
      searches: this.rows("SELECT * FROM searches ORDER BY client,title"),
      teams: this.rows("SELECT t.*,COALESCE(r.version,0) roster_version FROM teams t LEFT JOIN team_rosters r ON r.team_id=t.id ORDER BY t.name"),
      team_members: this.rows('SELECT * FROM team_members'),
      priorities: this.rows('SELECT * FROM weekly_priorities ORDER BY week DESC'),
      staff: this.rows("SELECT s.*,COALESCE(p.email,'') email,COALESCE(p.archived,0) archived,COALESCE(p.version,0) version FROM staff s LEFT JOIN staff_profiles p ON p.staff_id=s.id ORDER BY s.name").map(s=>hasRole(a,'admin')?s:(({email,...rest})=>rest)(s)),
      assignments: this.rows(
        "SELECT * FROM assignments ORDER BY work_date DESC",
      ),
      entries: this.rows(
        "SELECT e.*,a.work_date,a.search_id,a.team_id FROM entries e JOIN assignments a ON a.id=e.assignment_id",
      ),
      decisions: this.rows(
        "SELECT * FROM weekly_decisions ORDER BY created_at DESC",
      ),
      issues:
        hasRole(a,'admin')
          ? this.rows("SELECT * FROM issues WHERE resolved=0")
          : [],
      audit: (hasRole(a,'admin')||hasRole(a,'founder'))
        ? this.rows(
            "SELECT action,entity,created_at FROM audit ORDER BY created_at DESC LIMIT 30",
          )
        : [],
    };
    if(members)result.staff=result.staff.map(s=>({...s,name:members.find(m=>(m.staff_id||m.staffId)===s.id)?.name||s.name}));
    const crmStatuses=new Map(this.rows('SELECT external_id,status FROM crm_jobs').map(j=>[j.external_id,j.status]));
    result.searches=result.searches.map(s=>({...s,status:crmStatuses.has(s.external_id)?crmStatuses.get(s.external_id):s.status}));
    result.assignments=result.assignments.map(a=>({...a,has_work:this.assignmentHasWork(a)}));
    const automated=new Set(research.records.filter(r=>r.kind==='strategy'&&r.active).map(r=>r.role_id));
    result.entries=result.entries.map(e=>({...e,automated:automated.has(e.search_id)}));
    result.entries.push(...derivedEntries(research.records,result.assignments));
    return result;
  }
  async crmCandidateImports(a:Actor){requireThat(hasRole(a,'admin'),'Administrator permission required.',403);return this.rows('SELECT id,search_id,status,created_at FROM crm_candidate_batches ORDER BY created_at DESC LIMIT 30');}
  async crmCandidateStart(a:Actor,searchId:string,token:string){
    requireThat(hasRole(a,'admin'),'Administrator permission required.',403);
    const search=this.rows('SELECT * FROM searches WHERE id=?',searchId)[0];requireThat(search?.external_id,'Choose a CRM-linked search already in the repository.');
    const job=this.rows('SELECT * FROM crm_jobs WHERE external_id=?',search.external_id)[0];const slug=crmSlug(job?.job_slug);
    const assignments=await crmAssignments(token,slug);
    let authors:Record<string,string>={},authorWarning='';try{const users=await crmList(token,'users/search');authors=Object.fromEntries(users.map(u=>[String(u.id),[u.first_name,u.last_name].filter(Boolean).join(' ')]));}catch{authorWarning='Source user names could not be fetched; original CRM author IDs are preserved.';}
    return this.ctx.storage.transactionSync(()=>{requireThat(this.rows('SELECT external_id FROM searches WHERE id=?',searchId)[0]?.external_id===search.external_id,'Search changed. Start a new preview.',409);const id=startConversion(this,a,searchId,slug,assignments,authors,authorWarning);return conversionPreview(this,a,id);});
  }
  async crmCandidatePreview(a:Actor,id:string){return conversionPreview(this,a,id);}
  async crmCandidateFetchNext(a:Actor,id:string,token:string){
    const {batch,item}=nextConversionItem(this,a,id);if(!item)return conversionPreview(this,a,id);
    const details=await crmCandidateDetails(token,batch.job_slug,item.slug);
    return this.ctx.storage.transactionSync(()=>{saveConversionDetails(this,a,id,item.slug,details);return conversionPreview(this,a,id);});
  }
  async crmCandidateApply(a:Actor,id:string,stages:Record<string,string>){return this.ctx.storage.transactionSync(()=>applyConversionItem(this,a,id,stages));}
  async crmState(a: Actor) {
    requireThat(hasRole(a,'admin'), 'Administrator permission required.',403);
    return {jobs:this.rows('SELECT j.*,p.partner_id AS saved_partner_id,p.partner AS saved_partner,COALESCE(p.version,0) AS partner_version FROM crm_jobs j LEFT JOIN crm_partners p ON p.external_id=j.external_id ORDER BY j.title'), runs:this.rows('SELECT * FROM integration_runs ORDER BY created_at DESC LIMIT 20')};
  }
  async stageCRM(a: Actor, jobs: CRMJob[]) {
    requireThat(hasRole(a,'admin'), 'Administrator permission required.',403);
    return this.ctx.storage.transactionSync(() => {
      // Refresh CRM-owned fields on existing searches; never activate new jobs.
      this.rows('DELETE FROM crm_jobs');
      let updated=0;
      for(const j of jobs) {
        this.rows('INSERT INTO crm_jobs(external_id,title,status,company_slug,fetched_at,company_name,job_slug) VALUES(?,?,?,?,?,?,?)',j.external_id,j.title,j.status,j.company_slug,now(),j.company_name || '',j.job_slug||'');
        const matches=this.rows('SELECT * FROM searches WHERE external_id=?',j.external_id);
        requireThat(matches.length<=1,'Multiple searches share this CRM ID. Reconcile before refreshing.',409);
        const old=matches[0];if(!old)continue;
        const client=j.company_name||old.client;
        if(old.title===j.title&&old.status===j.status&&old.client===client)continue;
        this.rows('UPDATE searches SET title=?,status=?,client=?,version=version+1 WHERE id=?',j.title,j.status,client,old.id);
        this.audit(a,'crm-refresh',old.id,old,{...old,title:j.title,status:j.status,client,version:old.version+1});updated++;
      }
      this.rows('INSERT INTO integration_runs VALUES(?,?,?,?,?)',uuid(),a.id,'staged',jobs.length,now());
      this.audit(a,'crm-stage','recruitcrm',null,{count:jobs.length});
      return {count:jobs.length,updated};
    });
  }
  async applyCRM(a: Actor, jobs: any[]) {
    requireThat(hasRole(a,'admin'),'Administrator permission required.',403);
    requireThat(Array.isArray(jobs) && jobs.length > 0 && jobs.length <= 200,'Select 1–200 jobs.');
    requireThat(new Set(jobs.map(j=>j.external_id)).size === jobs.length,'Duplicate job selection.');
    return this.ctx.storage.transactionSync(() => {
      for(const item of jobs) {
        const source = this.rows('SELECT * FROM crm_jobs WHERE external_id=?',text(item.external_id))[0];
        requireThat(source,'Fetch jobs again before applying.',409);
        requireThat(source.fetched_at === item.fetched_at,'The preview changed. Reload before applying.',409);
        const matches = this.rows('SELECT * FROM searches WHERE external_id=?',source.external_id);
        requireThat(matches.length <= 1,'Multiple searches share this CRM ID. Reconcile before applying.',409);
        const old = matches[0];
        requireThat(old ? old.id === item.search_id && old.version === item.version : !item.search_id,'The local search changed. Reload the preview.',409);
        const id = old?.id || uuid(), client = source.company_name || old?.client || text(item.client);
        requireThat(client,'Enter a client name for each new search.');
        const changePartner=Object.prototype.hasOwnProperty.call(item,'partner_id');
        const saved=this.rows('SELECT * FROM crm_partners WHERE external_id=?',source.external_id)[0];
        if(!old&&saved) requireThat(Number(item.partner_version)===saved.version,'The saved partner changed. Reload before adding the role.',409);
        const partner_id=changePartner?text(item.partner_id):(old?.partner_id || saved?.partner_id || ''),partner=changePartner?text(item.partner):(old?.partner || saved?.partner || '');
        if(old) this.rows('UPDATE searches SET title=?,status=?,client=?,partner_id=?,partner=?,version=version+1 WHERE id=?',source.title,source.status,client,partner_id,partner,id);
        else this.rows('INSERT INTO searches(id,external_id,client,title,status,partner_id,partner) VALUES(?,?,?,?,?,?,?)',id,source.external_id,client,source.title,source.status,partner_id,partner);
        this.audit(a,'crm-apply',id,old || null,{external_id:source.external_id,title:source.title,status:source.status,client,partner_id,partner});
      }
      this.rows('INSERT INTO integration_runs VALUES(?,?,?,?,?)',uuid(),a.id,'applied',jobs.length,now());
      return {count:jobs.length};
    });
  }
  async syncPeople(members:Member[]) {
    return this.ctx.storage.transactionSync(()=>{
      this.rows('CREATE TABLE IF NOT EXISTS account_researchers(staff_id TEXT PRIMARY KEY,user_id TEXT NOT NULL)');
      this.rows('DELETE FROM account_researchers');
      for(const m of members.filter(m=>m.status==='active'&&hasRole(m,'researcher')&&(m.staff_id||m.staffId))){const sid=m.staff_id||m.staffId!;
        // Legacy staff.name is unique, whereas account display names are not identities.
        // Keep historical staff IDs intact and disambiguate only this internal storage label.
        let storageName=m.name,suffix=0;
        while(this.rows('SELECT id FROM staff WHERE name=? AND id<>?',storageName,sid).length)storageName=m.name+' ['+sid+(suffix++?':'+suffix:'')+']';
        this.rows('INSERT INTO staff(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',sid,storageName);
        this.rows('INSERT INTO account_researchers VALUES(?,?)',sid,m.id);
        this.rows('UPDATE staff_profiles SET archived=0 WHERE staff_id=? AND archived<>0',sid);
      }
      const removed=this.rows('SELECT * FROM team_members WHERE staff_id NOT IN (SELECT staff_id FROM account_researchers)');
      for(const team of new Set(removed.map(r=>r.team_id))){this.audit({id:'account-sync'} as Actor,'account-roster-prune',team,removed.filter(r=>r.team_id===team),{reason:'Account no longer eligible for research assignments'});this.rows('DELETE FROM team_members WHERE team_id=? AND staff_id NOT IN (SELECT staff_id FROM account_researchers)',team);this.rows('INSERT INTO team_rosters VALUES(?,1) ON CONFLICT(team_id) DO UPDATE SET version=version+1',team);}
      this.rows("INSERT OR REPLACE INTO settings VALUES('accounts_only','1')");
    });
  }
  assignableStaff(id:string){return !this.rows("SELECT value FROM settings WHERE key='accounts_only'").length||!!this.rows('SELECT staff_id FROM account_researchers WHERE staff_id=?',id).length;}
  async ensureResearcher(a:Actor,b:any) {
    requireThat(hasRole(a,'admin'),'Administrator permission required.',403);
    return this.ctx.storage.transactionSync(()=>{
      if(b.staff_id) {
        const s=this.rows('SELECT s.*,COALESCE(p.archived,0) archived FROM staff s LEFT JOIN staff_profiles p ON p.staff_id=s.id WHERE s.id=?',b.staff_id)[0];
        requireThat(s&&!s.archived,'Choose an active researcher record.');return {id:s.id};
      }
      const id='person:'+text(b.key,100),existing=this.rows('SELECT s.id,COALESCE(p.archived,0) archived FROM staff s LEFT JOIN staff_profiles p ON p.staff_id=s.id WHERE s.id=?',id)[0];if(existing){requireThat(!existing.archived,'Restore the researcher record before linking it.');return {id:existing.id};}
      const name=text(b.name,100);requireThat(name,'Enter a name.');
      requireThat(!this.rows('SELECT id FROM staff WHERE lower(trim(name))=lower(?)',name).length,'A researcher with this name already exists. Select the existing record instead.',409);
      this.rows('INSERT INTO staff(id,name) VALUES(?,?)',id,name);this.audit(a,'staff',id,null,{name});return {id};
    });
  }
  sourcingDecision(role:string,date:string){return this.rows('SELECT * FROM weekly_priorities WHERE search_id=? AND week<=? ORDER BY week DESC LIMIT 1',role,weekStart(date))[0];}
  requireSourcing(role:string,date:string){requireThat(isWorkingDecision(this.sourcingDecision(role,date)),'Choose Start, Continue or Recalibrate in Search Decisions before allocating work. Pause and Stop do not allow new assignments.',409);}
  async mutate(a: Actor, kind: string, b: any,members?:Member[]) {
    if(members)await this.syncPeople(members);
    return this.ctx.storage.transactionSync(() => this.applyMutation(a, kind, b));
  }
  async bulk(a: Actor, changes: any[]) {
    requireThat(Array.isArray(changes) && changes.length > 0 && changes.length <= 200,
      "Save between 1 and 200 rows at a time.");
    const keys = changes.map(b => `${b.kind}:${b.id}`);
    requireThat(new Set(keys).size === keys.length, "A record may occur only once in a batch.");
    return this.ctx.storage.transactionSync(() => {
      return changes.map((b, index) => {
        try {
          requireThat(["entry", "review", "assignment-edit"].includes(b.kind), "Unsupported bulk operation.");
          return this.applyMutation(a, b.kind, b);
        } catch (e: any) {
          throw Object.assign(new Error(`Row ${index + 1}: ${e.message}. No rows were saved.`), {status: e.status ?? 400});
        }
      });
    });
  }
  private applyMutation(a: Actor, kind: string, b: any): { id: string } {
      if(kind==='pto'){
        const staff=text(b.staff_id),date=day(b.work_date);
        requireThat(canPlan(a)||hasRole(a,'researcher')&&a.staffId===staff,'You can update only your own PTO.',403);
        requireThat(this.rows('SELECT id FROM staff WHERE id=?',staff).length&&this.assignableStaff(staff),'Choose an active researcher.',404);
        requireThat(typeof b.pto==='boolean','Choose PTO or working.');
        const old=this.rows('SELECT * FROM time_off WHERE staff_id=? AND work_date=?',staff,date)[0];
        requireThat(Number(b.version)===(old?.version||0),'PTO changed. Reload before saving.',409);
        this.rows('INSERT INTO time_off VALUES(?,?,?,1) ON CONFLICT(staff_id,work_date) DO UPDATE SET pto=excluded.pto,version=version+1',staff,date,b.pto?1:0);
        const id=JSON.stringify([staff,date]);this.audit(a,'pto',id,old||null,{staff_id:staff,work_date:date,pto:b.pto,version:(old?.version||0)+1});return {id};
      }
      if(kind==='effort')return saveEffort(this,a,b);
      if(kind === 'staff-edit' || kind === 'staff-archive') {
        requireThat(hasRole(a,'admin'),'Administrator permission required.',403);
        const old=this.rows("SELECT s.*,COALESCE(p.email,'') email,COALESCE(p.archived,0) archived,COALESCE(p.version,0) version FROM staff s LEFT JOIN staff_profiles p ON p.staff_id=s.id WHERE s.id=?",b.id)[0];
        requireThat(old,'Researcher not found.',404);
        requireThat(Number(b.version)===old.version,'This researcher changed. Reload before editing.',409);
        const name=kind==='staff-edit'?text(b.name,100):old.name;
        const email=kind==='staff-edit'?text(b.email,254).toLowerCase():old.email;
        const archived=kind==='staff-archive'?(b.archived===true?1:0):old.archived;
        requireThat(name,'Enter a name.');
        requireThat(!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid contact email.');
        requireThat(!this.rows('SELECT id FROM staff WHERE lower(trim(name))=lower(?) AND id<>?',name,b.id).length,'Another researcher already has this name.',409);
        this.rows('UPDATE staff SET name=? WHERE id=?',name,b.id);
        this.rows('INSERT INTO staff_profiles VALUES(?,?,?,?) ON CONFLICT(staff_id) DO UPDATE SET email=excluded.email,archived=excluded.archived,version=excluded.version',b.id,email,archived,old.version+1);
        if(archived&&!old.archived) {
          for(const t of this.rows('SELECT team_id FROM team_members WHERE staff_id=?',b.id)) {
            const before=this.rows('SELECT staff_id FROM team_members WHERE team_id=?',t.team_id);
            this.rows('DELETE FROM team_members WHERE team_id=? AND staff_id=?',t.team_id,b.id);
            this.rows('INSERT INTO team_rosters VALUES(?,1) ON CONFLICT(team_id) DO UPDATE SET version=version+1',t.team_id);
            this.audit(a,'team-members',t.team_id,before,this.rows('SELECT staff_id FROM team_members WHERE team_id=?',t.team_id));
          }
        }
        this.audit(a,kind,b.id,old,{name,email,archived,version:old.version+1});
        return {id:b.id};
      }
      if(kind==='team-transfer') {
        requireThat(canPlan(a),'Planning permission required.',403);requireThat(b.from!==b.to,'Choose different teams.');
        for(const [team,version] of [[b.from,b.from_version],[b.to,b.to_version]]){requireThat(this.rows('SELECT id FROM teams WHERE id=?',team).length,'Team not found.',404);requireThat((this.rows('SELECT version FROM team_rosters WHERE team_id=?',team)[0]?.version||0)===Number(version),'Team roster changed. Reload.',409);}
        requireThat(this.assignableStaff(b.staff_id)&&this.rows('SELECT 1 FROM team_members WHERE team_id=? AND staff_id=?',b.from,b.staff_id).length,'Choose a current team member.');
        const lead=researchRecords(this).find(r=>r.kind==='team-reviewer'&&r.team_id===b.from);requireThat(!lead||!this.rows('SELECT 1 FROM account_researchers WHERE user_id=? AND staff_id=?',lead.reviewer_id,b.staff_id).length,'Assign a replacement team lead before moving this researcher.');
        this.rows('DELETE FROM team_members WHERE team_id=? AND staff_id=?',b.from,b.staff_id);this.rows('INSERT OR IGNORE INTO team_members VALUES(?,?)',b.to,b.staff_id);
        for(const team of [b.from,b.to])this.rows('INSERT INTO team_rosters VALUES(?,1) ON CONFLICT(team_id) DO UPDATE SET version=version+1',team);
        this.audit(a,kind,b.staff_id,{team:b.from},{team:b.to});return {id:b.staff_id};
      }
      if(kind === 'team-members') {
        requireThat(canPlan(a),'Planning permission required.',403);
        requireThat(this.rows('SELECT id FROM teams WHERE id=?',b.id).length,'Team not found.',404);
        const version=this.rows('SELECT version FROM team_rosters WHERE team_id=?',b.id)[0]?.version || 0;
        requireThat(Number(b.version)===version,'The team roster changed. Reload before editing.',409);
        requireThat(Array.isArray(b.staff_ids),'Select team members.');
        const ids=[...new Set<string>(b.staff_ids)];
        for(const id of ids) requireThat(this.assignableStaff(id)&&this.rows('SELECT s.id FROM staff s LEFT JOIN staff_profiles p ON p.staff_id=s.id WHERE s.id=? AND COALESCE(p.archived,0)=0',id).length,'Unknown researcher or archived record. Choose an active researcher.');
        const lead=researchRecords(this).find(r=>r.kind==='team-reviewer'&&r.team_id===b.id);const leadStaff=lead?this.rows('SELECT staff_id FROM account_researchers WHERE user_id=?',lead.reviewer_id)[0]?.staff_id:null;requireThat(!leadStaff||ids.includes(leadStaff),'Assign a replacement team lead before removing the current lead.');
        const before=this.rows('SELECT staff_id FROM team_members WHERE team_id=?',b.id);
        this.rows('DELETE FROM team_members WHERE team_id=?',b.id);
        for(const id of ids) this.rows('INSERT INTO team_members VALUES(?,?)',b.id,id);
        this.rows('INSERT INTO team_rosters VALUES(?,?) ON CONFLICT(team_id) DO UPDATE SET version=excluded.version',b.id,version+1);
        this.audit(a,kind,b.id,before,{staff_ids:ids,version:version+1});
        return {id:b.id};
      }
      if(kind === 'crm-owner') {
        requireThat(hasRole(a,'admin'),'Administrator permission required.',403);
        const id=text(b.external_id),job=this.rows('SELECT * FROM crm_jobs WHERE external_id=?',id)[0];
        requireThat(job,'Fetch jobs before saving a partner.',404);
        requireThat(!this.rows('SELECT id FROM searches WHERE external_id=?',id).length,'This role is now in the repository. Reload before saving.',409);
        const old=this.rows('SELECT * FROM crm_partners WHERE external_id=?',id)[0];
        requireThat(Number(b.version)===(old?.version||0),'The engagement partner changed. Reload before saving.',409);
        this.rows('INSERT INTO crm_partners(external_id,partner_id,partner,version) VALUES(?,?,?,?) ON CONFLICT(external_id) DO UPDATE SET partner_id=excluded.partner_id,partner=excluded.partner,version=excluded.version',id,text(b.partner_id),text(b.partner),(old?.version||0)+1);
        this.audit(a,kind,id,old||null,{partner_id:text(b.partner_id),partner:text(b.partner)});
        return {id};
      }
      if(kind === 'search-remove') {
        requireThat(canPlan(a),'Planning permission required.',403);
        const old=this.rows('SELECT * FROM searches WHERE id=?',b.id)[0];
        requireThat(old,'Search not found.',404);
        requireThat(Number(b.version)===old.version,'The search changed. Reload before removing.',409);
        const used=['assignments','weekly_priorities','weekly_decisions','effort_records'].some(t=>this.rows(`SELECT 1 FROM ${t} WHERE search_id=? LIMIT 1`,b.id).length)
          ||['research_records','brief_shares','role_publications','candidate_invites'].some(t=>this.rows(`SELECT 1 FROM ${t} WHERE role_id=? LIMIT 1`,b.id).length);
        requireThat(!used,'This role has research or planning history and cannot be removed. Close or abandon it in RecruitCRM instead.',409);
        if(old.external_id) this.rows('INSERT INTO crm_partners(external_id,partner_id,partner,version) VALUES(?,?,?,1) ON CONFLICT(external_id) DO UPDATE SET partner_id=excluded.partner_id,partner=excluded.partner,version=crm_partners.version+1',old.external_id,old.partner_id||'',old.partner||'');
        this.rows('DELETE FROM searches WHERE id=?',b.id);
        this.audit(a,kind,b.id,old,null);
        return {id:b.id};
      }
      if(kind === 'search-owner') {
        requireThat(canPlan(a),'Planning permission required.',403);
        const old=this.rows('SELECT * FROM searches WHERE id=?',b.id)[0];
        requireThat(old,'Search not found.',404);
        requireThat(Number(b.version)===old.version,'The search changed. Reload before editing.',409);
        this.rows('UPDATE searches SET partner_id=?,partner=?,version=version+1 WHERE id=?',text(b.partner_id),text(b.partner),b.id);
        this.audit(a,kind,b.id,old,{partner_id:text(b.partner_id),partner:text(b.partner)});
        return {id:b.id};
      }
      if(kind==='plan-transfer') {
        requireThat(canPlan(a),'Planning permission required.',403);
        requireThat(['move','unassign'].includes(b.operation),'Choose move or unassign.');
        requireThat(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=7&&new Set(b.items.map((i:any)=>i.id)).size===b.items.length,'Select 1–7 distinct daily assignments.');
        const days=weekDays(b.week),destination=text(b.destination_team_id);
        let members:string[]=[];
        if(b.operation==='move') {
          requireThat(destination&&destination!==b.team_id&&this.rows('SELECT id FROM teams WHERE id=?',destination).length,'Choose a different existing team.');
          const roster=this.rows('SELECT version FROM team_rosters WHERE team_id=?',destination)[0]?.version||0;
          requireThat(Number(b.roster_version)===roster,'The destination team roster changed. Reload before moving.',409);
          members=this.rows('SELECT staff_id FROM team_members WHERE team_id=?',destination).map(r=>r.staff_id).filter(id=>this.assignableStaff(id));
          requireThat(members.length,'Add researchers to the destination team first.');
        }
        for(const item of b.items) {
          const old=this.rows('SELECT * FROM assignments WHERE id=?',item.id)[0];
          requireThat(old&&old.search_id===b.search_id&&old.team_id===b.team_id&&days.includes(old.work_date),'Assignment not found in this search, team and week.',404);
          requireThat(Number(item.version)===old.version,'An assignment changed. Reload before moving or unassigning.',409);
          requireThat(!this.assignmentHasWork(old),'Work is recorded on '+old.work_date+'. Keep its attribution and select unstarted days instead.',409);
          const before={...old,staff_ids:this.rows('SELECT staff_id FROM entries WHERE assignment_id=?',old.id).map(r=>r.staff_id)};
          if(b.operation==='move') {
            this.requireSourcing(old.search_id,old.work_date);
            requireThat(!this.rows('SELECT id FROM assignments WHERE search_id=? AND team_id=? AND work_date=?',old.search_id,destination,old.work_date).length,'The destination team already has this search on '+old.work_date+'. Edit that assignment instead; targets were not combined.',409);
            this.rows('DELETE FROM entries WHERE assignment_id=?',old.id);
            this.rows('UPDATE assignments SET team_id=?,version=version+1 WHERE id=?',destination,old.id);
            for(const sid of members)this.rows('INSERT INTO entries(id,assignment_id,staff_id) VALUES(?,?,?)',uuid(),old.id,sid);
            this.audit(a,'plan-move',old.id,before,{...old,team_id:destination,version:old.version+1,staff_ids:members});
          } else {
            this.rows('DELETE FROM entries WHERE assignment_id=?',old.id);this.rows('DELETE FROM assignments WHERE id=?',old.id);this.audit(a,'plan-remove',old.id,before,null);
          }
        }
        return {id:b.search_id};
      }
      if(kind === 'week-plan') {
        requireThat(canPlan(a),'Planning permission required.',403);
        const dates=weekDays(b.week);
        requireThat(this.rows('SELECT id FROM searches WHERE id=?',b.search_id).length && this.rows('SELECT id FROM teams WHERE id=?',b.team_id).length,'Choose an existing search and team.');
        requireThat(Array.isArray(b.days) && b.days.length===7 && new Set(b.days.map((d:any)=>d.date)).size===7 && b.days.every((d:any)=>dates.includes(d.date)),'Submit all seven days of this week.');
        const members=this.rows('SELECT staff_id FROM team_members WHERE team_id=?',b.team_id).map(r=>r.staff_id).filter(id=>this.assignableStaff(id));
        const rosterVersion=this.rows('SELECT version FROM team_rosters WHERE team_id=?',b.team_id)[0]?.version || 0;
        requireThat(Number(b.roster_version)===rosterVersion,'The team roster changed. Reload before planning.',409);
        for(const d of b.days) {
          requireThat(typeof d.enabled==='boolean','Choose which days to plan.');
          const matches=this.rows('SELECT * FROM assignments WHERE search_id=? AND team_id=? AND work_date=?',b.search_id,b.team_id,d.date);
          requireThat(matches.length<=1,'This team and search have duplicate assignments on '+d.date+'. Reconcile them before editing.',409);
          const old=matches[0];
          requireThat(old ? old.id===d.id && old.version===Number(d.version) : !d.id,'The plan changed. Reload before saving.',409);
          if(!d.enabled) {
            if(old) {
              requireThat(!this.rows('SELECT 1 FROM effort_records WHERE search_id=? AND team_id=? AND work_date=? AND days>0',b.search_id,b.team_id,d.date).length,'Confirmed effort protects this assignment. Correct the effort record before removing it.',409);
              requireThat(!this.rows("SELECT id FROM research_records WHERE kind='mapping' AND role_id=? AND json_extract(data,'$.team_id')=? AND json_extract(data,'$.work_date')=?",b.search_id,b.team_id,d.date).length,'Candidate work is linked to this day. Keep the assignment and edit its target.',409);
              requireThat(!this.rows("SELECT id FROM entries WHERE assignment_id=? AND (mapped IS NOT NULL OR peer IS NOT NULL OR partner IS NOT NULL OR notes<>'' OR flag IS NOT NULL OR source<>'manual')",old.id).length && !this.rows('SELECT r.id FROM reviews r JOIN entries e ON e.id=r.entry_id WHERE e.assignment_id=?',old.id).length,'Work has already been recorded on '+d.date+'. Keep this assignment and edit its target instead.',409);
              this.rows('DELETE FROM entries WHERE assignment_id=?',old.id);
              this.rows('DELETE FROM assignments WHERE id=?',old.id);
              this.audit(a,'plan-remove',old.id,old,null);
            }
            continue;
          }
          const target=count(d.target,'Daily target',false),notes=text(d.notes,5000);
          const prior=old?this.rows('SELECT staff_id FROM entries WHERE assignment_id=?',old.id).map(r=>r.staff_id):[];
          const selected=d.staff_ids===undefined?(old?prior:members):d.staff_ids;
          requireThat(Array.isArray(selected)&&selected.length>0&&new Set(selected).size===selected.length,'Select at least one researcher for each working day.');
          const changed=JSON.stringify([...selected].sort())!==JSON.stringify([...prior].sort());
          requireThat(selected.every((sid:string)=>members.includes(sid)||old&&!changed&&prior.includes(sid)),'Choose researchers from the selected team.');
          if(old) {
            if(changed || (target??0)>(old.target??0))this.requireSourcing(b.search_id,d.date);
            if(changed){requireThat(!this.assignmentHasWork(old),'Recorded work protects this day’s researcher allocation. Change an unstarted day instead.',409);this.rows('DELETE FROM entries WHERE assignment_id=?',old.id);for(const sid of selected)this.rows('INSERT INTO entries(id,assignment_id,staff_id) VALUES(?,?,?)',uuid(),old.id,sid);}
            if(old.target!==target || old.notes!==notes || changed) {
              this.rows('UPDATE assignments SET target=?,notes=?,version=version+1 WHERE id=?',target,notes,old.id);
              this.audit(a,'plan-edit',old.id,{...old,staff_ids:prior},{target,notes,staff_ids:selected});
            }
          } else {
            this.requireSourcing(b.search_id,d.date);
            requireThat(members.length,'Add researchers to this team in Teams before planning work.');
            const id=uuid();
            this.rows('INSERT INTO assignments(id,search_id,team_id,work_date,target,notes) VALUES(?,?,?,?,?,?)',id,b.search_id,b.team_id,d.date,target,notes);
            for(const staffId of selected) this.rows('INSERT INTO entries(id,assignment_id,staff_id) VALUES(?,?,?)',uuid(),id,staffId);
            this.audit(a,'plan-create',id,null,{search_id:b.search_id,team_id:b.team_id,work_date:d.date,target,notes,staff_ids:selected});
          }
        }
        return {id:b.search_id};
      }
      if (kind === "assignment-edit") {
        requireThat(canPlan(a), "Planning permission required.", 403);
        const old = this.rows("SELECT * FROM assignments WHERE id=?", b.id)[0];
        requireThat(old, "Assignment not found.", 404);
        requireThat(Number(b.version) === old.version, "Someone changed this assignment. Reload before editing.", 409);
        const target = count(b.target, "Target");
        if((target??0)>(old.target??0))this.requireSourcing(old.search_id,old.work_date);
        this.rows("UPDATE assignments SET target=?,notes=?,version=version+1 WHERE id=?", target, text(b.notes, 5000), b.id);
        this.audit(a, kind, b.id, old, {target, notes: text(b.notes, 5000)});
        return {id: b.id};
      }
      if (kind === "search") {
        requireThat(canPlan(a), "Planning permission required.", 403);
        requireThat(
          text(b.client) && text(b.title),
          "Enter the client and role.",
        );
        const id = uuid();
        this.rows(
          "INSERT INTO searches(id,external_id,client,title,status,start_date,partner,notes) VALUES(?,?,?,?,?,?,?,?)",
          id,
          'LOCAL-'+id.slice(0,8).toUpperCase(),
          text(b.client),
          text(b.title),
          "Open",
          b.start_date ? day(b.start_date) : null,
          text(b.partner),
          text(b.notes, 5000),
        );
        this.rows('UPDATE searches SET partner_id=? WHERE id=?',text(b.partner_id),id);
        this.audit(a, kind, id, null, b);
        return { id };
      }
      if (kind === "staff" || kind === "team") {
        requireThat(
          kind==='team'?canPlan(a):hasRole(a,'admin'),
          "Administrator or team planning permission required.",
          403,
        );
        const name = text(b.name, 100);
        requireThat(name, "Enter a name.");
        const id = uuid();
        this.rows(
          `INSERT INTO ${kind === "staff" ? "staff" : "teams"}(id,name) VALUES(?,?)`,
          id,
          name,
        );
        this.audit(a, kind, id, null, { name });
        return { id };
      }
      if (kind === "assignment") {
        requireThat(canPlan(a), "Planning permission required.", 403);
        requireThat(
          this.rows("SELECT id FROM searches WHERE id=?", b.search_id).length &&
            this.rows("SELECT id FROM teams WHERE id=?", b.team_id).length,
          "Choose an existing search and team.",
        );
        const id = uuid(),
          date = day(b.work_date),
          target = count(b.target, "Target");
        this.requireSourcing(b.search_id,date);
        requireThat(!this.rows('SELECT id FROM assignments WHERE search_id=? AND team_id=? AND work_date=?',b.search_id,b.team_id,date).length,'This search and team are already planned for this day. Edit the weekly plan.',409);
        this.rows(
          "INSERT INTO assignments(id,search_id,team_id,work_date,target,partner,link,notes) VALUES(?,?,?,?,?,?,?,?)",
          id,
          b.search_id,
          b.team_id,
          date,
          target,
          text(b.partner),
          safeLink(b.link),
          text(b.notes, 5000),
        );
        for (const staffId of new Set<string>(b.staff_ids ?? [])) {
          requireThat(
            this.assignableStaff(staffId)&&this.rows("SELECT s.id FROM staff s LEFT JOIN staff_profiles p ON p.staff_id=s.id WHERE s.id=? AND COALESCE(p.archived,0)=0", staffId).length,
            "Choose an active researcher.",
          );
          this.rows(
            "INSERT INTO entries(id,assignment_id,staff_id) VALUES(?,?,?)",
            uuid(),
            id,
            staffId,
          );
        }
        this.audit(a, kind, id, null, b);
        return { id };
      }
      if (['entry','review','reopen'].includes(kind)) {
        const row=this.rows('SELECT a.search_id,a.work_date FROM entries e JOIN assignments a ON a.id=e.assignment_id WHERE e.id=?',b.id)[0];
        const strategy=row&&this.rows("SELECT data FROM research_records WHERE kind='strategy' AND role_id=?",row.search_id)[0];
        if(strategy) {const doc=JSON.parse(strategy.data);requireThat(!doc.cutover||row.work_date<doc.cutover,'This role uses candidate-derived output. Open its candidate mappings instead.',409);}
      }
      if (kind === "entry") {
        const old = this.rows("SELECT * FROM entries WHERE id=?", b.id)[0];
        requireThat(old, "Entry not found.", 404);
        requireThat(
          hasRole(a,'admin') ||
            (hasRole(a,'researcher') && a.staffId === old.staff_id),
          "You may edit only your own sourcing output.",
          403,
        );
        requireThat(
          Number(b.version) === old.version,
          "Someone changed this entry. Reload before editing.",
          409,
        );
        requireThat(
          old.peer_at === null && old.partner_at === null,
          "Reviewed output must be reopened by an administrator before editing.",
          409,
        );
        const mapped = count(b.mapped, "Mapped");
        validateCounts(mapped, old.peer, old.partner);
        this.rows(
          "UPDATE entries SET mapped=?,notes=?,version=version+1 WHERE id=?",
          mapped,
          text(b.notes, 5000),
          b.id,
        );
        this.audit(a, kind, b.id, old, b);
        return { id: b.id };
      }
      if (kind === "review") {
        const old = this.rows("SELECT * FROM entries WHERE id=?", b.id)[0];
        requireThat(old, "Entry not found.", 404);
        requireThat(
          Number(b.version) === old.version,
          "Someone changed this entry. Reload before reviewing.",
          409,
        );
        requireThat(
          b.stage === "peer" || b.stage === "partner",
          "Choose a review stage.",
        );
        if (b.stage === "partner")
          requireThat(
            canPartnerReview(a),
            "Partner review permission required.",
            403,
          );
        else
          requireThat(
            hasRole(a,'admin') ||
              (hasRole(a,'researcher') &&
                a.staffId &&
                a.staffId !== old.staff_id),
            "A peer review must be performed by another researcher.",
            403,
          );
        const approved = count(b.approved, "Approved", false)!;
        if (b.stage === "peer") {
          requireThat(
            !old.partner_at,
            "Reopen the partner review before changing peer approval.",
            409,
          );
          validateCounts(old.mapped, approved, null);
        } else {
          requireThat(old.peer !== null, "Complete peer review first.");
          validateCounts(old.mapped, old.peer, approved);
        }
        this.rows(
          `UPDATE entries SET ${b.stage}=?,${b.stage}_at=?,flag=NULL,version=version+1 WHERE id=?`,
          approved,
          now(),
          b.id,
        );
        this.rows(
          "INSERT INTO reviews VALUES(?,?,?,?,?,?,?)",
          uuid(),
          b.id,
          b.stage,
          approved,
          a.id,
          now(),
          text(b.notes, 5000),
        );
        this.audit(a, kind, b.id, old, b);
        return { id: b.id };
      }
      if (kind === "reopen") {
        requireThat(
          hasRole(a,'admin'),
          "Administrator permission required.",
          403,
        );
        requireThat(text(b.notes), "Explain why the review is being reopened.");
        const old = this.rows("SELECT * FROM entries WHERE id=?", b.id)[0];
        requireThat(old, "Entry not found.", 404);
        requireThat(
          Number(b.version) === old.version,
          "Reload this changed entry.",
          409,
        );
        this.rows(
          "UPDATE entries SET peer=NULL,partner=NULL,peer_at=NULL,partner_at=NULL,flag=NULL,version=version+1 WHERE id=?",
          b.id,
        );
        this.audit(a, kind, b.id, old, b);
        return { id: b.id };
      }
      if (kind === "decision") {
        requireThat(canPlan(a), "Planning permission required.", 403);
        requireThat(
          ["Start", "Continue", "Recalibrate", "Pause", "Stop"].includes(
            b.disposition,
          ),
          "Choose a planning decision.",
        );
        requireThat(
          this.rows("SELECT id FROM searches WHERE id=?", b.search_id).length,
          "Search not found.",
          404,
        );
        const week=weekStart(b.week),old=this.rows('SELECT * FROM weekly_priorities WHERE search_id=? AND week=?',b.search_id,week)[0];
        requireThat(Number(b.version) === (old?.version || 0),'A priority already exists or has changed for this search and week. Reload and edit it.',409);
        if(Object.prototype.hasOwnProperty.call(b,'base_week')){const base=this.sourcingDecision(b.search_id,week);requireThat((base?.week||'')===b.base_week&&(base?.version||0)===Number(b.base_version),'The carried decision changed. Reload before saving.',409);}
        const notes=text(b.notes,5000),id=uuid();
        this.rows('INSERT INTO weekly_priorities(search_id,week,disposition,notes,version) VALUES(?,?,?,?,?) ON CONFLICT(search_id,week) DO UPDATE SET disposition=excluded.disposition,notes=excluded.notes,version=excluded.version',b.search_id,week,b.disposition,notes,(old?.version || 0)+1);
        this.rows('INSERT INTO weekly_decisions VALUES(?,?,?,?,?,?,?)',id,b.search_id,week,b.disposition,notes,a.id,now());
        this.audit(a,kind,id,old || null,{search_id:b.search_id,week,disposition:b.disposition,notes});
        return {id};
      }
      throw Object.assign(new Error("Unknown operation."), { status: 404 });
  }
  async importWorkbook(data: any) {
    return this.ctx.storage.transactionSync(() => {
      requireThat(
        !this.rows("SELECT hash FROM imports WHERE hash=?", data.source_sha256)
          .length,
        "This workbook was already imported.",
        409,
      );
      requireThat(
        !this.rows("SELECT id FROM searches LIMIT 1").length,
        "Import is restricted to an empty workspace.",
        409,
      );
      this.rows("INSERT OR REPLACE INTO settings VALUES(?,?)", "name", "XQtiv");
      const searches = new Map<string, string>(),
        staff = new Map<string, string>(),
        teams = new Map<string, string>();
      const staffId = (name: string) => {
        const normalized = text(name).replace(/\s+/g, " ").toLowerCase();
        if (!staff.has(normalized)) {
          const id = uuid();
          staff.set(normalized, id);
          this.rows("INSERT INTO staff VALUES(?,?)", id, text(name));
        }
        return staff.get(normalized)!;
      };
      for (const s of data.crm_searches) {
        const id = uuid();
        searches.set(s.external_id, id);
        this.rows(
          "INSERT INTO searches(id,external_id,client,title,status,start_date) VALUES(?,?,?,?,?,?)",
          id,
          s.external_id,
          s.client ?? "Unspecified client",
          s.title ?? "Untitled search",
          s.status ?? "Unknown",
          s.created_date ?? null,
        );
      }
      for (const s of data.sessions) {
        const key =
          s.external_id && searches.has(s.external_id)
            ? s.external_id
            : s.search_label;
        if (!searches.has(key)) {
          const id = uuid();
          searches.set(key, id);
          this.rows(
            "INSERT INTO searches(id,external_id,client,title,status,notes) VALUES(?,?,?,?,?,?)",
            id,
            s.external_id ?? null,
            s.client ?? "Unspecified client",
            s.search_label,
            "Unknown",
            "Imported tracker search without a matching CRM record.",
          );
        }
        const tn = text(s.team) || "Unassigned";
        if (!teams.has(tn)) {
          const id = uuid();
          teams.set(tn, id);
          this.rows("INSERT INTO teams VALUES(?,?)", id, tn);
        }
        const id = uuid();
        const link =
          (s.breakdown_links ?? []).find((l: string) =>
            l.startsWith("https://"),
          ) ?? "";
        this.rows(
          "INSERT INTO assignments(id,search_id,team_id,work_date,target,partner,readiness,link,source_row,source_totals) VALUES(?,?,?,?,?,?,?,?,?,?)",
          id,
          searches.get(key),
          teams.get(tn),
          s.date,
          typeof s.target_approved === "number" ? s.target_approved : null,
          s.partner_label ?? "",
          String(s.readiness ?? ""),
          link,
          s.source_row,
          JSON.stringify(s.source_totals),
        );
        for (const e of s.entries) {
          const sid = staffId(
              e.staff_name || `Unattributed row ${s.source_row}`,
            ),
            n = (v: any) =>
              typeof v === "number" && v >= 0 && Number.isInteger(v) ? v : null;
          const mapped = n(e.mapped),
            peer = n(e.peer_approved),
            partner = n(e.partner_approved);
          let flag = null;
          try {
            validateCounts(mapped, peer, partner);
          } catch {
            flag = "Historical review counts need reconciliation";
          }
          const existing = this.rows(
            "SELECT id FROM entries WHERE assignment_id=? AND staff_id=?",
            id,
            sid,
          )[0];
          if (existing) {
            this.rows(
              "INSERT INTO issues VALUES(?,?,?,?,0)",
              uuid(),
              "duplicate_staff_in_session",
              s.source_row,
              JSON.stringify(e),
            );
            continue;
          }
          this.rows(
            "INSERT INTO entries(id,assignment_id,staff_id,mapped,peer,partner,peer_at,partner_at,flag,source) VALUES(?,?,?,?,?,?,?,?,?,?)",
            uuid(),
            id,
            sid,
            mapped,
            peer,
            partner,
            peer === null ? null : "imported",
            partner === null ? null : (s.review_date ?? "imported"),
            flag,
            "workbook",
          );
        }
      }
      for (const issue of data.issues)
        this.rows(
          "INSERT INTO issues VALUES(?,?,?,?,0)",
          uuid(),
          issue.kind,
          issue.row ?? null,
          JSON.stringify(issue),
        );
      for (const row of data.raw_rows["Master List"] ?? []) {
        if (row.row < 2) continue;
        const cells = row.cells,
          external = String(cells["A" + row.row]?.cached ?? "");
        const search = searches.get(external);
        if (!search) continue;
        for (const [coord, cell] of Object.entries<any>(cells)) {
          const column = coord.replace(/\d/g, "");
          if (
            !["Start", "Continue", "Recalibrate", "Pause", "Stop"].includes(
              cell.cached,
            )
          )
            continue;
          const header = data.raw_rows["Master List"][0].cells[column + "1"];
          if (header?.cached && /^\d{4}-\d{2}-\d{2}$/.test(header.cached)) {
            this.rows(
              "INSERT INTO weekly_decisions VALUES(?,?,?,?,?,?,?)",
              uuid(),
              search,
              header.cached,
              cell.cached,
              "Imported weekly decision",
              "workbook",
              now(),
            );
            this.rows('INSERT INTO weekly_priorities(search_id,week,disposition,notes) VALUES(?,?,?,?) ON CONFLICT(search_id,week) DO UPDATE SET disposition=excluded.disposition,notes=excluded.notes,version=weekly_priorities.version+1',search,weekStart(header.cached),cell.cached,'Imported weekly decision');
          }
        }
      }
      this.rows(
        "INSERT INTO imports VALUES(?,?,?)",
        data.source_sha256,
        now(),
        JSON.stringify({
          sessions: data.sessions.length,
          issues: data.issues.length,
        }),
      );
      return {
        searches: searches.size,
        staff: staff.size,
        sessions: data.sessions.length,
      };
    });
  }
}
