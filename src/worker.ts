import { Identity, digest } from "./identity";
import { Workspace } from "./workspace";
import { sendInvitationEmail } from './invitation-email';
import { fetchJobs, readCRMToken } from './recruitcrm';
import { requireThat, text, roles } from "./domain";
export { Identity, Workspace };
interface Env {
  IDENTITY: DurableObjectNamespace<Identity>;
  WORKSPACE: DurableObjectNamespace<Workspace>;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  SETUP_KEY?: string;
  RECRUITCRM_TOKENS?: string;
  RESEND_API_KEY?: string;
  INVITATION_FROM?: string;
}
const json = (
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });
const cookie = (token: string, max = 604800) =>
  `search_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${max}`;
export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    let res: Response;
    try {
      if (!url.pathname.startsWith("/api/")) res = await env.ASSETS.fetch(req);
      else {
        requireThat(
          ["GET", "POST"].includes(req.method),
          "Method not allowed.",
          405,
        );
        const setup = url.pathname === "/api/setup";
        if (req.method === "POST" && !setup)
          requireThat(
            req.headers.get("Origin") === url.origin,
            "Request origin not allowed.",
            403,
          );
        const rawCookie =
          req.headers
            .get("Cookie")
            ?.match(/(?:^|; )search_session=([^;]*)/)?.[1] ?? "";
        const identity: any = env.IDENTITY.getByName("identity-v1");
        const ip = await digest(req.headers.get("CF-Connecting-IP") ?? "local");
        let body: any = {};
        if (req.method === "POST") {
          requireThat(
            Number(req.headers.get("Content-Length") ?? 0) < 8e6,
            "Request is too large.",
            413,
          );
          const raw = await req.text();
          requireThat(raw.length < 8e6, "Request is too large.", 413);
          body = JSON.parse(raw);
        }
        if (setup) {
          requireThat(
            req.method === "POST" &&
              env.SETUP_KEY &&
              req.headers.get("Authorization") === `Bearer ${env.SETUP_KEY}`,
            "Not found.",
            404,
          );
          requireThat(
            body.tenant === "xqtiv" || body.tenant === "agent-test",
            "Invalid setup workspace.",
          );
          const workspace: any = env.WORKSPACE.getByName(body.tenant);
          const imported = body.workbook
            ? await workspace.importWorkbook(body.workbook)
            : null;
          const invitation = await identity.invite(
            body.email,
            body.name,
            body.tenant,
            "admin",
            null,
            true,
          );
          const invitationUrl = `${url.origin}/join/${invitation}`;
          const emailStatus = await sendInvitationEmail(env, text(body.email, 254).toLowerCase(), invitationUrl);
          res = json({ imported, invitation, emailStatus });
        } else if (url.pathname === '/api/invitation' && req.method === 'POST') {
          res = json(await identity.invitationInfo(text(body.token,200),ip));
        } else if (
          url.pathname === "/api/login" ||
          url.pathname === "/api/accept"
        ) {
          requireThat(req.method === "POST", "Method not allowed.", 405);
          const result = url.pathname.endsWith("login")
            ? await identity.login(body, ip)
            : await identity.accept(body, ip);
          res = json({ memberships: result.memberships }, 200, {
            "Set-Cookie": cookie(result.token),
          });
        } else if (url.pathname === "/api/logout") {
          requireThat(req.method === "POST", "Method not allowed.", 405);
          await identity.logout(rawCookie);
          res = json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
        } else if (url.pathname === "/api/workspaces") {
          res = json({ memberships: await identity.list(rawCookie) });
        } else {
          const tenant =
            req.headers.get("X-Workspace") ??
            url.searchParams.get("workspace") ??
            "xqtiv";
          const a = await identity.authenticate(rawCookie, tenant);
          requireThat(a, "Please sign in to this workspace.", 401);
          const workspace: any = env.WORKSPACE.getByName(a.tenant);
          if (url.pathname.startsWith('/api/crm/')) {
            requireThat(a.role === 'admin','Administrator permission required.',403);
            const token = readCRMToken(env.RECRUITCRM_TOKENS,a.tenant);
            if(url.pathname === '/api/crm/status' && req.method === 'GET') {
              try {res = json({configured:!!token,...await workspace.crmState(a)});}
              catch {throw Object.assign(new Error('The app could not load its RecruitCRM integration records. Report storage error CRM_STATUS.'),{status:500});}
            }
            else if(url.pathname === '/api/crm/fetch' && req.method === 'POST') {
              requireThat(typeof token === 'string' && token.length > 0,'RecruitCRM is not connected for this workspace.',409);
              const jobs = await fetchJobs(token);
              try {res = json(await workspace.stageCRM(a,jobs));}
              catch {throw Object.assign(new Error('RecruitCRM jobs were fetched, but the app could not save the preview. Existing searches were not changed. Report storage error CRM_PREVIEW.'),{status:500});}
            } else if(url.pathname === '/api/crm/apply' && req.method === 'POST') {
              requireThat(Array.isArray(body.jobs),'Select jobs to import.');
              const members=await identity.members(a.tenant);
              for(const item of body.jobs) {
                if(Object.prototype.hasOwnProperty.call(item,'partner_id')) {
                  const partner=item.partner_id?members.find((m:any)=>m.id===item.partner_id&&m.status==='active'&&['admin','founder','partner'].includes(m.role)):null;
                  requireThat(!item.partner_id||partner,'Choose an active engagement partner.');
                  item.partner=partner?.name || '';
                }
              }
              res = json(await workspace.applyCRM(a,body.jobs));
            }
            else res = json({error:'Not found.'},404);
          }
          else if (url.pathname === "/api/state" && req.method === "GET") {
            const partners=(await identity.members(a.tenant)).filter((m:any)=>m.status==='active' && ['admin','founder','partner'].includes(m.role)).map((m:any)=>({id:m.id,name:m.name}));
            res = json({...await workspace.state(a),partners});
          }
          else if (url.pathname === "/api/mutate" && req.method === "POST") {
            if(['search','search-owner'].includes(body.kind)) {
              const partner=body.partner_id ? (await identity.members(a.tenant)).find((m:any)=>m.id===body.partner_id && m.status==='active' && ['admin','founder','partner'].includes(m.role)) : null;
              requireThat(!body.partner_id || partner,'Choose an active engagement partner.');
              body.partner=partner?.name || '';
            }
            res = json(await workspace.mutate(a, body.kind, body));
          }
          else if (url.pathname === "/api/bulk" && req.method === "POST")
            res = json({saved: await workspace.bulk(a, body.changes)});
          else if (url.pathname === "/api/invite" && req.method === "POST") {
            requireThat(
              a.role === "admin",
              "Administrator permission required.",
              403,
            );
            requireThat(roles.includes(body.role), "Choose a permission role.");
            const state = await workspace.state(a);
            requireThat(
              !body.staffId ||
                state.staff.some((s: any) => s.id === body.staffId),
              "Unknown staff record.",
            );
            const invite = await identity.invite(
              text(body.email, 254),
              text(body.name, 100),
              a.tenant,
              body.role,
              body.staffId || null,
            );
            const invitationUrl = `${url.origin}/join/${invite}`;
            const emailStatus = await sendInvitationEmail(env, text(body.email, 254).toLowerCase(), invitationUrl);
            res = json({ url: invitationUrl, emailStatus });
          } else if (url.pathname === "/api/members" && req.method === "GET") {
            requireThat(
              a.role === "admin",
              "Administrator permission required.",
              403,
            );
            res = json(await identity.members(a.tenant));
          } else if (url.pathname === "/api/revoke" && req.method === "POST") {
            requireThat(
              a.role === "admin",
              "Administrator permission required.",
              403,
            );
            await identity.revoke(a.tenant, body.id, a.id);
            res = json({ ok: true });
          } else res = json({ error: "Not found." }, 404);
        }
      }
    } catch (e: any) {
      res = json(
        {
          error: e.status
            ? e.message
            : "The request could not be completed. Please check your input and try again.",
        },
        e.status ?? 400,
      );
    }
    const headers = new Headers(res.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Frame-Options", "DENY");
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    return new Response(res.body, { status: res.status, headers });
  },
};
