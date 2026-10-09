import { DurableObject } from "cloudflare:workers";
import {rolePolicySchema,roleDefinitions,validateAssignedRoles,roleUsage,mutateRolePolicy} from './role-policy-store';
import {effectiveAccessRoles,effectivePermissions,hasPermission,retiredRoleIds} from './access-policy';
import { identitySchema } from "./schema";
import { passwordHash, passwordOK } from "./password";
import { Actor, AccessRole, requireThat, text, roles, roleList, hasRole } from "./domain";
export async function digest(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export const token = () => crypto.randomUUID() + crypto.randomUUID();
export class Identity extends DurableObject {
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    ctx.storage.sql.exec(identitySchema);
    ctx.storage.sql.exec(rolePolicySchema);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS email_changes(user_id TEXT PRIMARY KEY,email TEXT NOT NULL,old_email TEXT NOT NULL,session_hash TEXT NOT NULL,code_hash TEXT NOT NULL,expires INTEGER NOT NULL,created INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS account_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,action TEXT NOT NULL,created_at TEXT NOT NULL)');
  }
  rows(q: string, ...p: (string | number | null)[]): any[] {
    return this.ctx.storage.sql.exec(q, ...p).toArray();
  }
  // Preserve the original workspace administrator as owner without merging accounts.
  ensureOwners() {
    this.ctx.storage.transactionSync(()=>{
      for(const {tenant} of this.rows("SELECT DISTINCT tenant FROM memberships WHERE role='admin' AND status='active'")) {
        if(this.rows('SELECT tenant FROM workspace_owners WHERE tenant=?',tenant).length)continue;
        const owner=this.rows("SELECT m.user_id,m.staff_id,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=? AND m.role='admin' AND m.status='active' ORDER BY COALESCE((SELECT MIN(i.expires) FROM invites i WHERE i.tenant=m.tenant AND i.email=u.email AND i.used=1 AND i.role='admin'),9223372036854775807),m.rowid LIMIT 1",tenant)[0];
        if(!owner)continue;
        const current=this.details({id:owner.user_id,tenant,role:'admin',staff_id:owner.staff_id,name:owner.name});
        this.rows('INSERT INTO workspace_owners VALUES(?,?)',tenant,owner.user_id);
        this.rows('INSERT INTO member_profiles VALUES(?,?,?,?,?) ON CONFLICT(user_id,tenant) DO UPDATE SET roles=excluded.roles,version=excluded.version',owner.user_id,tenant,JSON.stringify([...new Set(['super_admin',...current.roles])]),current.name||'',current.version+1);
        this.rows('INSERT INTO member_events VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),tenant,'system-migration',owner.user_id,JSON.stringify({roles:current.roles}),JSON.stringify({roles:['super_admin',...current.roles]}),new Date().toISOString());
      }
    });
  }
  details(m:any,definitions=roleDefinitions(this,m.tenant)) {
    const p=this.rows('SELECT * FROM member_profiles WHERE user_id=? AND tenant=?',m.id,m.tenant)[0];
    const assigned=(p?JSON.parse(p.roles):[m.role]).filter((id:string)=>id==='super_admin'||definitions.some(d=>d.id===id));
    const permissions=effectivePermissions(assigned,definitions);
    if(!m.staff_id&&(permissions.includes('pto.self')||permissions.includes('candidates.add'))){m={...m,staff_id:'person:'+m.id};this.rows('UPDATE memberships SET staff_id=? WHERE tenant=? AND user_id=?',m.staff_id,m.tenant,m.id);}
    return {...m,name:p?.name||m.name,roles:assigned,permissions,accessRoles:effectiveAccessRoles(assigned,definitions),version:p?.version||0};
  }
  async roleCatalog(a:Actor){
    const current=(await this.members(a.tenant)).find(m=>m.id===a.id);
    requireThat(current?.status==='active'&&(hasPermission(current,'roles.manage')||hasPermission(current,'users.view')),'Administrator permission required.',403);
    return {roles:roleDefinitions(this,a.tenant).map(r=>({...r,...roleUsage(this,a.tenant,r.id)})),superAdminUsers:roleUsage(this,a.tenant,'super_admin').users};
  }
  async validRoles(tenant:string,ids:unknown){validateAssignedRoles(this,tenant,ids);return true;}
  async rolePolicy(a:Actor,b:any):Promise<any>{
    this.ensureOwners();
    return this.ctx.storage.transactionSync(()=>{
      const row=this.rows('SELECT u.id,m.* FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=? AND m.user_id=?',a.tenant,a.id)[0];
      requireThat(row?.status==='active'&&this.details(row).roles.includes('super_admin'),'Super Admin permission required.',403);
      if(b.action==='batch'){
        requireThat(Array.isArray(b.roles)&&b.roles.length>0&&b.roles.length<=100,'Choose roles to save.');
        requireThat(new Set(b.roles.map((r:any)=>r.id)).size===b.roles.length&&b.roles.every((r:any)=>typeof r.id==='string'),'Duplicate or missing role.');
        return {saved:b.roles.map((r:any)=>mutateRolePolicy(this,a.tenant,a.id,{...r,action:'save'}))};
      }
      return mutateRolePolicy(this,a.tenant,a.id,b);
    });
  }
  async sessionUser(raw:string) {
    return this.rows('SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?',await digest(raw),Date.now())[0]||null;
  }
  async updateMember(a:Actor,b:any) {
    this.ensureOwners();
    return this.ctx.storage.transactionSync(()=>{
      const actorRow=this.rows('SELECT u.id,u.name,m.* FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=? AND m.user_id=?',a.tenant,a.id)[0];
      requireThat(actorRow&&actorRow.status==='active'&&hasPermission(this.details(actorRow),'users.access'),'Administrator permission required.',403);
      const authority=this.details(actorRow);
      const row=this.rows('SELECT u.id,u.name,u.email,m.* FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=? AND m.user_id=?',a.tenant,b.id)[0];
      requireThat(row,'Account not found in this workspace.',404);
      requireThat(Array.isArray(b.roles),'Choose at least one valid role.');
      const old=this.details(row),nextRoles=[...new Set<AccessRole>(b.roles)];
      requireThat(Number(b.version)===old.version,'This account changed. Reload before saving.',409);
      validateAssignedRoles(this,a.tenant,nextRoles);
      requireThat(nextRoles.every(r=>!retiredRoleIds.includes(r)||old.roles.includes(r)),'Retired roles cannot be newly assigned.');
      requireThat(hasRole(authority,'super_admin')||(!hasRole(old,'super_admin')&&!nextRoles.includes('super_admin')),'Only a super admin can change a super admin account.',403);
      requireThat(authority.roles.includes('super_admin')||(nextRoles.length===old.roles.length&&nextRoles.every(r=>old.roles.includes(r))),'Only a super admin can change assigned roles.',403);
      const status=b.status||old.status;requireThat(['active','revoked'].includes(status),'Choose active or revoked access.');
      requireThat(b.id!==a.id||status==='active','You cannot revoke your own access.');
      if(hasRole(old,'super_admin')&&(!nextRoles.includes('super_admin')||status!=='active')) {
        const others=this.rows("SELECT u.id,m.* FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=? AND m.status='active' AND m.user_id<>?",a.tenant,b.id);
        requireThat(others.some(m=>hasRole(this.details(m),'super_admin')),'Keep at least one active super admin.',409);
      }
      const sourcing=effectiveAccessRoles(nextRoles,roleDefinitions(this,a.tenant)).includes('researcher');
      const staffId=old.staff_id||'person:'+old.id;
      requireThat(!old.staff_id||!b.staff_id||old.staff_id===b.staff_id,'An existing researcher identity cannot be replaced. Keep the current staff link.');
      requireThat(!sourcing||staffId,'Link a researcher record first.');
      if(staffId) {
        requireThat(!this.rows('SELECT user_id FROM memberships WHERE tenant=? AND staff_id=? AND user_id<>?',a.tenant,staffId,b.id).length,'This researcher is already linked to another account.',409);
        this.rows('UPDATE invites SET used=1 WHERE tenant=? AND staff_id=? AND used=0',a.tenant,staffId);
      }
      const name=text(b.name,100)||old.name;
      this.rows('UPDATE memberships SET role=?,staff_id=?,status=? WHERE tenant=? AND user_id=?',nextRoles[0],staffId,status,a.tenant,b.id);
      this.rows('INSERT INTO member_profiles VALUES(?,?,?,?,?) ON CONFLICT(user_id,tenant) DO UPDATE SET roles=excluded.roles,name=excluded.name,version=excluded.version',b.id,a.tenant,JSON.stringify(nextRoles),name,old.version+1);
      this.rows('INSERT INTO member_events VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),a.tenant,a.id,b.id,JSON.stringify(old),JSON.stringify({name,roles:nextRoles,staff_id:staffId,status,version:old.version+1}),new Date().toISOString());
      return {ok:true};
    });
  }
  async updateProfile(a:Actor,b:any){
    return this.ctx.storage.transactionSync(()=>{
      const actor=this.rows('SELECT u.id,u.name,m.* FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=? AND m.user_id=?',a.tenant,a.id)[0];
      requireThat(actor?.status==='active'&&hasPermission(this.details(actor),'users.profile'),'Profile editing permission required.',403);
      const row=this.rows('SELECT u.id,u.name,m.* FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=? AND m.user_id=?',a.tenant,b.id)[0];
      requireThat(row,'Account not found.',404);const old=this.details(row);
      requireThat(!hasRole(old,'super_admin')||hasRole(this.details(actor),'super_admin'),'Super Admin is protected.',403);
      requireThat(old.version===Number(b.version),'Account changed. Reload.',409);const name=text(b.name,100);requireThat(name,'Enter a name.');
      this.rows('INSERT INTO member_profiles VALUES(?,?,?,?,?) ON CONFLICT(user_id,tenant) DO UPDATE SET name=excluded.name,version=excluded.version',b.id,a.tenant,JSON.stringify(old.roles),name,old.version+1);
      this.rows('INSERT INTO member_events VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),a.tenant,a.id,b.id,JSON.stringify({name:old.name}),JSON.stringify({name}),new Date().toISOString());return {ok:true};
    });
  }
  async resetTestPeople(a:Actor,b:any) {
    this.ensureOwners();
    return this.ctx.storage.transactionSync(()=>{
      const members=this.rows('SELECT u.id,u.email,u.name,m.* FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=?',a.tenant).map(m=>this.details(m));
      const owner=this.rows('SELECT user_id FROM workspace_owners WHERE tenant=?',a.tenant)[0]?.user_id;
      const current=members.find(m=>m.id===a.id);
      requireThat(current?.status==='active'&&hasRole(current,'super_admin')&&a.id===owner,'Only the original workspace owner can reset test people.',403);
      const remove=members.filter(m=>m.id!==owner),pending=this.rows('SELECT token,email,name FROM invites WHERE tenant=? AND used=0',a.tenant);
      const signature=JSON.stringify({owner,people:members.map(m=>[m.id,m.version,m.status]).sort(),invites:pending.map(i=>i.token).sort()});
      if(b.preview)return {keep:{id:current.id,name:current.name,email:current.email},remove:remove.map(m=>({id:m.id,name:m.name,email:m.email})),invitations:pending.length,signature};
      requireThat(b.signature===signature,'People changed. Preview the cleanup again.',409);
      requireThat(text(b.confirmEmail,254).toLowerCase()===current.email,'Enter your own sign-in email to confirm.');
      for(const m of remove){this.rows('DELETE FROM memberships WHERE tenant=? AND user_id=?',a.tenant,m.id);this.rows('DELETE FROM member_profiles WHERE tenant=? AND user_id=?',a.tenant,m.id);this.rows('INSERT INTO member_events VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),a.tenant,a.id,m.id,JSON.stringify(m),JSON.stringify({removed_from_workspace:true}),new Date().toISOString());}
      this.rows('UPDATE invites SET used=1 WHERE tenant=? AND used=0',a.tenant);
      this.rows('INSERT INTO member_events VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),a.tenant,a.id,owner,'null',JSON.stringify({test_people_reset:true,removed:remove.length,cancelled:pending.length}),new Date().toISOString());
      return {removed:remove.length,cancelled:pending.length};
    });
  }
  async cancelInvitation(a:Actor,id:string) {
    const members=await this.members(a.tenant),actor=members.find(m=>m.id===a.id);
    requireThat(actor?.status==='active'&&hasPermission(actor,'users.invite'),'Administrator permission required.',403);
    const invitation=this.rows('SELECT * FROM invites WHERE tenant=? AND token=? AND used=0',a.tenant,id)[0];
    requireThat(invitation,'Pending invitation not found.',404);
    const assigned=this.rows('SELECT roles FROM invitation_roles WHERE token=?',id)[0];
    requireThat(!(assigned&&JSON.parse(assigned.roles).includes('super_admin'))||hasRole(actor,'super_admin'),'Only a super admin can manage this invitation.',403);
    this.ctx.storage.transactionSync(()=>{
      this.rows('UPDATE invites SET used=1 WHERE token=?',id);
      this.rows('INSERT INTO member_events VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),a.tenant,a.id,'invitation',JSON.stringify({email:invitation.email}),JSON.stringify({cancelled:true}),new Date().toISOString());
    });return {ok:true};
  }
  limit(key: string, max = 15) {
    const now = Date.now(),
      old = this.rows("SELECT * FROM limits WHERE key=?", key)[0];
    if (!old || old.expires < now) {
      this.rows(
        "INSERT OR REPLACE INTO limits VALUES(?,?,?)",
        key,
        1,
        now + 15 * 60e3,
      );
      return;
    }
    requireThat(
      old.count < max,
      "Too many attempts. Please try again in 15 minutes.",
      429,
    );
    this.rows("UPDATE limits SET count=count+1 WHERE key=?", key);
  }
  async invite(
    email: string,
    name: string,
    tenant: string,
    role: AccessRole,
    staffId: string | null,
    firstAdmin = false,
    assignedRoles?: AccessRole[],
  ) {
    const assigned=assignedRoles||[role];
    validateAssignedRoles(this,tenant,assigned);validateAssignedRoles(this,tenant,[role]);requireThat(assigned.every(r=>!retiredRoleIds.includes(r)),'Retired roles cannot be assigned to new invitations.');
    requireThat(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      "Enter a valid email.",
    );
    const raw = token();
    const hash = await digest(raw);
    this.ctx.storage.transactionSync(() => {
    if (firstAdmin) {
      requireThat(!this.rows('SELECT user_id FROM memberships WHERE tenant=? LIMIT 1', tenant).length,
        'This workspace is already set up. Sign in or contact its administrator.', 409);
      requireThat(!this.rows('SELECT token FROM invites WHERE tenant=? AND role=? AND used=0 AND expires>? LIMIT 1', tenant, 'admin', Date.now()).length,
        'An administrator invitation is already pending. Use the invitation link already created.', 409);
    }
    requireThat(!this.rows('SELECT m.user_id,m.staff_id,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=? AND u.email=?',tenant,email.toLowerCase()).length,'This person already has a workspace account. Edit their roles instead of inviting again.',409);
    this.rows('UPDATE invites SET used=1 WHERE tenant=? AND email=? AND used=0',tenant,email.toLowerCase());
    if(staffId) {
      requireThat(!this.rows("SELECT user_id FROM memberships WHERE tenant=? AND staff_id=?",tenant,staffId).length,'This researcher already has an account. The account holder can change their sign-in email in Account settings.',409);
      this.rows('UPDATE invites SET used=1 WHERE tenant=? AND staff_id=? AND used=0',tenant,staffId);
    }
    this.rows(
      "INSERT INTO invites VALUES(?,?,?,?,?,?,?,0)",
      hash,
      email.toLowerCase(),
      name,
      tenant,
      role,
      staffId,
      Date.now() + 7 * 86400e3,
    );
    this.rows('INSERT INTO invitation_roles VALUES(?,?)',hash,JSON.stringify(assigned));
    });
    return raw;
  }
  async authenticate(raw: string, tenant: string): Promise<Actor | null> {
    this.ensureOwners();
    const hash = await digest(raw);
    const u = this.rows(
      "SELECT u.*,m.tenant,m.role,m.staff_id FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=u.id WHERE s.token=? AND s.expires>? AND m.tenant=? AND m.status=?",
      hash,
      Date.now(),
      tenant,
      "active",
    )[0];
    const resolved=u?this.details(u):null;
    return u
      ? {
          id: u.id,
          email: u.email,
          name: resolved!.name,
          roles: resolved!.roles,
          accessRoles: resolved!.accessRoles,
          permissions: resolved!.permissions,
          roleNames: Object.fromEntries(roleDefinitions(this,u.tenant).map(r=>[r.id,r.name])),
          tenant: u.tenant,
          role: u.role,
          staffId: resolved!.staff_id,
        }
      : null;
  }
  async login(body: any, ip: string) {
    this.limit("login:" + ip);
    const email = text(body.email, 254).toLowerCase();
    this.limit("email:" + email);
    requireThat(String(body.password??'').length<=128,'Email or password is incorrect.',401);
    const u = this.rows("SELECT * FROM users WHERE email=?", email)[0];
    requireThat(
      u && passwordOK(String(body.password ?? ""), u.password),
      "Email or password is incorrect.",
      401,
    );
    return this.session(u.id);
  }
  async session(id: string) {
    const raw = token();
    this.rows(
      "INSERT INTO sessions VALUES(?,?,?)",
      await digest(raw),
      id,
      Date.now() + 7 * 86400e3,
    );
    this.rows("DELETE FROM sessions WHERE expires<?", Date.now());
    const memberships = this.rows(
      "SELECT tenant,role FROM memberships WHERE user_id=? AND status=?",
      id,
      "active",
    );
    return { token: raw, memberships };
  }
  async invitationInfo(raw: string, ip: string) {
    this.limit('invite-info:' + ip, 60);
    const i = this.rows('SELECT email,name,tenant,used,expires FROM invites WHERE token=?', await digest(raw))[0];
    if (!i) return {status:'invalid'};
    if (i.expires < Date.now() && !i.used) return {status:'expired'};
    return {status:i.used?'used':'active',email:i.email,name:i.name,tenant:i.tenant,hasAccount:!!this.rows('SELECT id FROM users WHERE email=?',i.email)[0]};
  }
  async accept(body: any, ip: string) {
    this.limit("invite:" + ip);
    const hash = await digest(String(body.token ?? ""));
    const invite = this.rows(
      "SELECT * FROM invites WHERE token=? AND used=0 AND expires>?",
      hash,
      Date.now(),
    )[0];
    requireThat(
      invite,
      "This invitation has expired or has already been used.",
      400,
    );
    const email = text(body.email, 254).toLowerCase();
    requireThat(
      email === invite.email,
      "Use the email address on your invitation.",
    );
    const password = String(body.password ?? "");
    requireThat(
      password.length >= 12 && password.length <= 128,
      "Use a password between 12 and 128 characters.",
    );
    let u = this.rows("SELECT * FROM users WHERE email=?", email)[0];
    if (u)
      requireThat(
        passwordOK(password, u.password),
        "This email already has an account. Use its existing password.",
        401,
      );
    const id = u?.id ?? crypto.randomUUID();
    const hashPassword = u?.password ?? passwordHash(password);
    this.ctx.storage.transactionSync(() => {
      const current = this.rows(
        "SELECT used FROM invites WHERE token=?",
        hash,
      )[0];
      requireThat(current && !current.used, "Invitation already used.");
      if(invite.staff_id) requireThat(!this.rows('SELECT user_id FROM memberships WHERE tenant=? AND staff_id=?',invite.tenant,invite.staff_id).length,'This researcher is already linked to an account. Ask your administrator.',409);
      requireThat(!this.rows('SELECT user_id FROM memberships WHERE tenant=? AND user_id=?',invite.tenant,id).length,'This account already belongs to this workspace. Sign in or contact your administrator.',409);
      if (!u)
        this.rows(
          "INSERT INTO users VALUES(?,?,?,?)",
          id,
          email,
          invite.name,
          hashPassword,
        );
      const invitationRoles=JSON.parse(this.rows('SELECT roles FROM invitation_roles WHERE token=?',hash)[0]?.roles||JSON.stringify([invite.role]));
      validateAssignedRoles(this,invite.tenant,invitationRoles);
      const acceptedStaff='person:'+id;
      this.rows(
        "INSERT OR IGNORE INTO memberships VALUES(?,?,?,?,?)",
        id,
        invite.tenant,
        invite.role,
        acceptedStaff,
        "active",
      );
      const assigned=this.rows('SELECT roles FROM invitation_roles WHERE token=?',hash)[0];
      if(assigned)this.rows('INSERT INTO member_profiles VALUES(?,?,?,?,1)',id,invite.tenant,assigned.roles,invite.name);
      this.rows("UPDATE invites SET used=1 WHERE token=?", hash);
    });
    return this.session(id);
  }
  async changePassword(raw: string, body: any) {
    const hash = await digest(raw);
    const nextToken = token(), nextHash = await digest(nextToken);
    return this.ctx.storage.transactionSync(() => {
      const u = this.rows('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?', hash, Date.now())[0];
      requireThat(u, 'Please sign in again.', 401);
      // Attempt counter is outside the rollback below; see changePasswordAttempt.
      const current = String(body.currentPassword ?? ''), next = String(body.newPassword ?? '');
      requireThat(current.length <= 128 && passwordOK(current, u.password), 'Current password is incorrect.', 401);
      requireThat(next.length >= 12 && next.length <= 128, 'Use a password between 12 and 128 characters.');
      requireThat(next === String(body.confirmPassword ?? ''), 'New passwords do not match.');
      requireThat(next !== current, 'Choose a different new password.');
      this.rows('UPDATE users SET password=? WHERE id=?', passwordHash(next), u.id);
      this.rows('INSERT INTO account_events VALUES(?,?,?,?)',crypto.randomUUID(),u.id,'password-changed',new Date().toISOString());
      this.rows('DELETE FROM sessions WHERE user_id=?', u.id);
      this.rows('INSERT INTO sessions VALUES(?,?,?)', nextHash, u.id, Date.now()+7*86400e3);
      return {token:nextToken};
    });
  }
  async changePasswordAttempt(raw: string, body: any, ip: string) {
    this.limit('password-ip:'+ip, 10);
    const session = this.rows('SELECT user_id FROM sessions WHERE token=? AND expires>?', await digest(raw), Date.now())[0];
    requireThat(session, 'Please sign in again.', 401);
    this.limit('password-user:'+session.user_id, 5);
    return this.changePassword(raw, body);
  }
  async pendingInvitations(tenant:string) {
    return this.rows('SELECT token id,email,name,role,staff_id,expires FROM invites WHERE tenant=? AND used=0 AND expires>?',tenant,Date.now()).map(i=>({...i,roles:JSON.parse(this.rows('SELECT roles FROM invitation_roles WHERE token=?',i.id)[0]?.roles||JSON.stringify([i.role]))}));
  }
  async requestEmailChange(raw:string,body:any,ip:string) {
    this.limit('email-change-ip:'+ip,10);
    const sessionHash=await digest(raw);
    const u=this.rows('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',sessionHash,Date.now())[0];
    requireThat(u,'Please sign in again.',401);
    this.limit('email-change-user:'+u.id,3);
    const password=String(body.currentPassword??'');
    requireThat(password.length<=128&&passwordOK(password,u.password),'Current password is incorrect.',401);
    const email=text(body.email,254).toLowerCase();
    requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email.');
    requireThat(email!==u.email,'Enter a different email address.');
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
    const codeHash=await digest(u.id+':'+code);
    this.ctx.storage.transactionSync(()=>{
      requireThat(this.rows('SELECT token FROM sessions WHERE token=? AND expires>?',sessionHash,Date.now()).length,'Please sign in again.',401);
      requireThat(!this.rows('SELECT id FROM users WHERE email=?',email).length,'This email cannot be used for this account.',409);
      const pending=this.rows('SELECT created FROM email_changes WHERE user_id=?',u.id)[0];
      requireThat(!pending||Date.now()-pending.created>=60000,'Wait one minute before requesting another code.',429);
      this.rows('INSERT OR REPLACE INTO email_changes VALUES(?,?,?,?,?,?,?)',u.id,email,u.email,sessionHash,codeHash,Date.now()+600000,Date.now());
      this.rows('INSERT INTO account_events VALUES(?,?,?,?)',crypto.randomUUID(),u.id,'email-change-requested',new Date().toISOString());
    });
    return {email,code,id:crypto.randomUUID()};
  }
  async confirmEmailChange(raw:string,body:any,ip:string) {
    this.limit('email-confirm-ip:'+ip,15);
    const sessionHash=await digest(raw);
    const session=this.rows('SELECT user_id FROM sessions WHERE token=? AND expires>?',sessionHash,Date.now())[0];
    requireThat(session,'Please sign in again.',401);
    this.limit('email-confirm-user:'+session.user_id,5);
    const codeHash=await digest(session.user_id+':'+text(body.code,6));
    const rawToken=token(),tokenHash=await digest(rawToken);
    return this.ctx.storage.transactionSync(()=>{
      const u=this.rows('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',sessionHash,Date.now())[0];
      requireThat(u,'Please sign in again.',401);
      const pending=this.rows('SELECT * FROM email_changes WHERE user_id=?',u.id)[0];
      requireThat(pending&&pending.session_hash===sessionHash&&pending.expires>Date.now()&&pending.old_email===u.email,'Request a new email verification code.');
      requireThat(/^\d{6}$/.test(String(body.code||''))&&pending.code_hash===codeHash,'Incorrect verification code.');
      requireThat(!this.rows('SELECT id FROM users WHERE email=?',pending.email).length,'This email cannot be used for this account.',409);
      this.rows('UPDATE users SET email=? WHERE id=?',pending.email,u.id);
      this.rows('DELETE FROM email_changes WHERE user_id=?',u.id);
      this.rows('DELETE FROM sessions WHERE user_id=?',u.id);
      this.rows('INSERT INTO sessions VALUES(?,?,?)',tokenHash,u.id,Date.now()+7*86400e3);
      this.rows('INSERT INTO account_events VALUES(?,?,?,?)',crypto.randomUUID(),u.id,'email-changed',new Date().toISOString());
      return {token:rawToken,email:pending.email,oldEmail:u.email,id:crypto.randomUUID()};
    });
  }
  async logout(raw: string) {
    this.rows("DELETE FROM sessions WHERE token=?", await digest(raw));
  }
  async members(tenant: string) {
    this.ensureOwners();
    const definitions=roleDefinitions(this,tenant);
    return this.rows('SELECT u.id,u.email,u.name,m.tenant,m.role,m.staff_id,m.status FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=?',tenant).map(m=>this.details(m,definitions));
  }
  async revoke(tenant:string,id:string,actor:string) {
    const members=await this.members(tenant),current=members.find(m=>m.id===actor),target=members.find(m=>m.id===id);
    requireThat(current&&target,'Account not found.',404);
    return this.updateMember({...current,tenant} as Actor,{...target,status:'revoked'});
  }
  async list(raw: string) {
    return this.rows(
      "SELECT m.tenant,m.role FROM sessions s JOIN memberships m ON m.user_id=s.user_id WHERE s.token=? AND s.expires>? AND m.status=?",
      await digest(raw),
      Date.now(),
      "active",
    );
  }
}

