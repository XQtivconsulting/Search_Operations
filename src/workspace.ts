import {candidateSchema,createCandidateInvite,listCandidateInvites,revokeCandidateInvite,requestCandidateCode,verifyCandidateCode,candidatePage} from './candidate-access';
import {planCompanyImport} from './company-import';
import { DurableObject } from "cloudflare:workers";
import {researchSchema,researchState,researchMutation,derivedEntries} from "./research";
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
    ctx.storage.sql.exec(researchSchema);
    ctx.storage.sql.exec(candidateSchema);
    if(!this.rows('PRAGMA table_info(crm_jobs)').some(c=>c.name === 'company_name'))
      this.rows("ALTER TABLE crm_jobs ADD COLUMN company_name TEXT NOT NULL DEFAULT ''");
    if(!this.rows('PRAGMA table_info(searches)').some(c=>c.name === 'partner_id'))
      this.rows("ALTER TABLE searches ADD COLUMN partner_id TEXT NOT NULL DEFAULT ''");
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
  async research(a: Actor,b:any,members:Member[]):Promise<any> {return this.ctx.storage.transactionSync(()=>{
      if(b.action==='brief-release') {
        requireThat(b.page?.origin==='document','Upload the original document before publishing this page.');
        const saved=researchMutation(this,a,{...b,action:'brief-save'},members);
        const read=()=>{const r=this.rows('SELECT * FROM research_records WHERE id=?',saved.id)[0];return {id:r.id,version:r.version};};
        researchMutation(this,a,{...read(),action:'brief-approve'},members);
        researchMutation(this,a,{...read(),action:'brief-publish'},members);
        return saved;
      }
      if(b.action==='company-import') {
        requireThat(canPlan(a),'Planning permission required.',403);
        const existing=researchState(this).records.filter(r=>r.kind==='company');
        const plan=planCompanyImport(existing,b.rows,b.overwrite===true);
        const signature=JSON.stringify(existing.map(c=>[c.id,c.version]).sort());
        if(b.preview)return {plan,signature};
        requireThat(signature===b.signature,'The company list changed. Preview the import again.',409);
        return {saved:plan.map(c=>researchMutation(this,a,{...c,id:c.existingId,action:'company-master'},members))};
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
    return !!(this.rows("SELECT id FROM research_records WHERE kind='mapping' AND role_id=? AND json_extract(data,'$.team_id')=? AND json_extract(data,'$.work_date')=?",a.search_id,a.team_id,a.work_date).length||this.rows("SELECT id FROM entries WHERE assignment_id=? AND (mapped IS NOT NULL OR peer IS NOT NULL OR partner IS NOT NULL OR notes<>'' OR flag IS NOT NULL OR source<>'manual')",a.id).length||this.rows('SELECT r.id FROM reviews r JOIN entries e ON e.id=r.entry_id WHERE e.assignment_id=?',a.id).length);
  }
  async state(a: Actor) {
    const research=researchState(this);
    const result = {
      research,
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
    result.assignments=result.assignments.map(a=>({...a,has_work:this.assignmentHasWork(a)}));
    const automated=new Set(research.records.filter(r=>r.kind==='strategy'&&r.active).map(r=>r.role_id));
    result.entries=result.entries.map(e=>({...e,automated:automated.has(e.search_id)}));
    result.entries.push(...derivedEntries(research.records,result.assignments));
    return result;
  }
  async crmState(a: Actor) {
    requireThat(hasRole(a,'admin'), 'Administrator permission required.',403);
    return {jobs:this.rows('SELECT * FROM crm_jobs ORDER BY title'), runs:this.rows('SELECT * FROM integration_runs ORDER BY created_at DESC LIMIT 20')};
  }
  async stageCRM(a: Actor, jobs: CRMJob[]) {
    requireThat(hasRole(a,'admin'), 'Administrator permission required.',403);
    return this.ctx.storage.transactionSync(() => {
      // Replace only the staging snapshot, never the operating records.
      this.rows('DELETE FROM crm_jobs');
      for(const j of jobs) this.rows('INSERT INTO crm_jobs(external_id,title,status,company_slug,fetched_at,company_name) VALUES(?,?,?,?,?,?)',j.external_id,j.title,j.status,j.company_slug,now(),j.company_name || '');
      this.rows('INSERT INTO integration_runs VALUES(?,?,?,?,?)',uuid(),a.id,'staged',jobs.length,now());
      this.audit(a,'crm-stage','recruitcrm',null,{count:jobs.length});
      return {count:jobs.length};
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
        const partner_id=changePartner?text(item.partner_id):(old?.partner_id || ''),partner=changePartner?text(item.partner):(old?.partner || '');
        if(old) this.rows('UPDATE searches SET title=?,status=?,client=?,partner_id=?,partner=?,version=version+1 WHERE id=?',source.title,source.status,client,partner_id,partner,id);
        else this.rows('INSERT INTO searches(id,external_id,client,title,status,partner_id,partner) VALUES(?,?,?,?,?,?,?)',id,source.external_id,client,source.title,source.status,partner_id,partner);
        this.audit(a,'crm-apply',id,old || null,{external_id:source.external_id,title:source.title,status:source.status,client,partner_id,partner});
      }
      this.rows('INSERT INTO integration_runs VALUES(?,?,?,?,?)',uuid(),a.id,'applied',jobs.length,now());
      return {count:jobs.length};
    });
  }
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
  async mutate(a: Actor, kind: string, b: any) {
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
      if(kind === 'team-members') {
        requireThat(canPlan(a),'Planning permission required.',403);
        requireThat(this.rows('SELECT id FROM teams WHERE id=?',b.id).length,'Team not found.',404);
        const version=this.rows('SELECT version FROM team_rosters WHERE team_id=?',b.id)[0]?.version || 0;
        requireThat(Number(b.version)===version,'The team roster changed. Reload before editing.',409);
        requireThat(Array.isArray(b.staff_ids),'Select team members.');
        const ids=[...new Set<string>(b.staff_ids)];
        for(const id of ids) requireThat(this.rows('SELECT s.id FROM staff s LEFT JOIN staff_profiles p ON p.staff_id=s.id WHERE s.id=? AND COALESCE(p.archived,0)=0',id).length,'Unknown researcher or archived record. Choose an active researcher.');
        const before=this.rows('SELECT staff_id FROM team_members WHERE team_id=?',b.id);
        this.rows('DELETE FROM team_members WHERE team_id=?',b.id);
        for(const id of ids) this.rows('INSERT INTO team_members VALUES(?,?)',b.id,id);
        this.rows('INSERT INTO team_rosters VALUES(?,?) ON CONFLICT(team_id) DO UPDATE SET version=excluded.version',b.id,version+1);
        this.audit(a,kind,b.id,before,{staff_ids:ids,version:version+1});
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
          members=this.rows('SELECT staff_id FROM team_members WHERE team_id=?',destination).map(r=>r.staff_id);
          requireThat(members.length,'Add researchers to the destination team first.');
        }
        for(const item of b.items) {
          const old=this.rows('SELECT * FROM assignments WHERE id=?',item.id)[0];
          requireThat(old&&old.search_id===b.search_id&&old.team_id===b.team_id&&days.includes(old.work_date),'Assignment not found in this search, team and week.',404);
          requireThat(Number(item.version)===old.version,'An assignment changed. Reload before moving or unassigning.',409);
          requireThat(!this.assignmentHasWork(old),'Work is recorded on '+old.work_date+'. Keep its attribution and select unstarted days instead.',409);
          const before={...old,staff_ids:this.rows('SELECT staff_id FROM entries WHERE assignment_id=?',old.id).map(r=>r.staff_id)};
          if(b.operation==='move') {
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
        const members=this.rows('SELECT staff_id FROM team_members WHERE team_id=?',b.team_id).map(r=>r.staff_id);
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
              requireThat(!this.rows("SELECT id FROM research_records WHERE kind='mapping' AND role_id=? AND json_extract(data,'$.team_id')=? AND json_extract(data,'$.work_date')=?",b.search_id,b.team_id,d.date).length,'Candidate work is linked to this day. Keep the assignment and edit its target.',409);
              requireThat(!this.rows("SELECT id FROM entries WHERE assignment_id=? AND (mapped IS NOT NULL OR peer IS NOT NULL OR partner IS NOT NULL OR notes<>'' OR flag IS NOT NULL OR source<>'manual')",old.id).length && !this.rows('SELECT r.id FROM reviews r JOIN entries e ON e.id=r.entry_id WHERE e.assignment_id=?',old.id).length,'Work has already been recorded on '+d.date+'. Keep this assignment and edit its target instead.',409);
              this.rows('DELETE FROM entries WHERE assignment_id=?',old.id);
              this.rows('DELETE FROM assignments WHERE id=?',old.id);
              this.audit(a,'plan-remove',old.id,old,null);
            }
            continue;
          }
          const target=count(d.target,'Daily target',false),notes=text(d.notes,5000);
          if(old) {
            if(old.target!==target || old.notes!==notes) {
              this.rows('UPDATE assignments SET target=?,notes=?,version=version+1 WHERE id=?',target,notes,old.id);
              this.audit(a,'plan-edit',old.id,old,{target,notes});
            }
          } else {
            requireThat(members.length,'Add researchers to this team in Teams before planning work.');
            const id=uuid();
            this.rows('INSERT INTO assignments(id,search_id,team_id,work_date,target,notes) VALUES(?,?,?,?,?,?)',id,b.search_id,b.team_id,d.date,target,notes);
            for(const staffId of members) this.rows('INSERT INTO entries(id,assignment_id,staff_id) VALUES(?,?,?)',uuid(),id,staffId);
            this.audit(a,'plan-create',id,null,{search_id:b.search_id,team_id:b.team_id,work_date:d.date,target,notes,staff_ids:members});
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
          text(b.external_id),
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
            this.rows("SELECT s.id FROM staff s LEFT JOIN staff_profiles p ON p.staff_id=s.id WHERE s.id=? AND COALESCE(p.archived,0)=0", staffId).length,
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
