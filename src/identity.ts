import { DurableObject } from "cloudflare:workers";
import { identitySchema } from "./schema";
import { passwordHash, passwordOK } from "./password";
import { Actor, AccessRole, requireThat, text, roles } from "./domain";
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
  }
  rows(q: string, ...p: (string | number | null)[]): any[] {
    return this.ctx.storage.sql.exec(q, ...p).toArray();
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
  ) {
    requireThat(roles.includes(role), "Invalid permission role.");
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
    });
    return raw;
  }
  async authenticate(raw: string, tenant: string): Promise<Actor | null> {
    const hash = await digest(raw);
    const u = this.rows(
      "SELECT u.*,m.tenant,m.role,m.staff_id FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=u.id WHERE s.token=? AND s.expires>? AND m.tenant=? AND m.status=?",
      hash,
      Date.now(),
      tenant,
      "active",
    )[0];
    return u
      ? {
          id: u.id,
          email: u.email,
          name: u.name,
          tenant: u.tenant,
          role: u.role,
          staffId: u.staff_id,
        }
      : null;
  }
  async login(body: any, ip: string) {
    this.limit("login:" + ip);
    const email = text(body.email, 254).toLowerCase();
    this.limit("email:" + email);
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
      if (!u)
        this.rows(
          "INSERT INTO users VALUES(?,?,?,?)",
          id,
          email,
          invite.name,
          hashPassword,
        );
      this.rows(
        "INSERT OR IGNORE INTO memberships VALUES(?,?,?,?,?)",
        id,
        invite.tenant,
        invite.role,
        invite.staff_id,
        "active",
      );
      this.rows("UPDATE invites SET used=1 WHERE token=?", hash);
    });
    return this.session(id);
  }
  async logout(raw: string) {
    this.rows("DELETE FROM sessions WHERE token=?", await digest(raw));
  }
  async members(tenant: string) {
    return this.rows(
      "SELECT u.id,u.email,u.name,m.role,m.staff_id,m.status FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant=?",
      tenant,
    );
  }
  async revoke(tenant: string, id: string, actor: string) {
    requireThat(id !== actor, "You cannot revoke your own access.");
    this.rows(
      "UPDATE memberships SET status=? WHERE tenant=? AND user_id=?",
      "revoked",
      tenant,
      id,
    );
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
