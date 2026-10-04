import {companyLogo} from './company-logo';
import {lookupGeography,signGeography,verifyGeographies} from './geography-lookup';
import {readJSONBody} from './request-security';
import {backupPrefix} from './backup-service';
import {companySuggestions} from './company-enrichment';
import { Identity, digest } from "./identity";
import { Workspace } from "./workspace";
import { sendInvitationEmail,sendRoleEmail,sendAccountEmail } from './invitation-email';
import { fetchJobs, readCRMToken } from './recruitcrm';
import {hasRole,canPlan,canPartnerReview, requireThat, text, roles } from "./domain";
export { Identity, Workspace };
interface Env {
  IDENTITY: DurableObjectNamespace<Identity>;
  WORKSPACE: DurableObjectNamespace<Workspace>;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  SETUP_KEY?: string;
  TENANT_SETUP_IDS?: string;
  BACKUPS?: R2Bucket;
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
const geographyCatalogCache=new Map<string,any>();
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
        const expected=req.headers.get('X-Expected-User');
        if(expected) {
          const current=await identity.sessionUser(rawCookie);
          if(!current||current.id!==expected)throw Object.assign(new Error('The signed-in account changed in another tab. Reload before continuing.'),{status:409,code:'SESSION_CHANGED'});
        }
        let body: any = {};
        if (req.method === "POST") body=await readJSONBody(req);
        if (url.pathname.startsWith('/api/candidate/')) {
          const tenant=text(url.searchParams.get('workspace')||body.workspace,100);
          requireThat(/^[a-zA-Z0-9_-]+$/.test(tenant),'Invalid invitation.',404);
          const w:any=env.WORKSPACE.getByName(tenant);
          if(url.pathname==='/api/candidate/code'&&req.method==='POST') {
            requireThat(env.RESEND_API_KEY&&env.INVITATION_FROM,'Email verification is temporarily unavailable. Contact your partner.',503);
            const c=await w.candidateCode(body,ip);
            const status=await sendRoleEmail(env,c.email,'code',c.code,crypto.randomUUID());
            requireThat(status==='accepted','Code delivery could not be confirmed. Wait one minute and try again.',503);
            res=json({ok:true});
          } else if(url.pathname==='/api/candidate/verify'&&req.method==='POST') {
            const s=await w.candidateVerify(body,ip);
            res=json({ok:true},200,{'Set-Cookie':`candidate_session=${s.token}; Path=/api/candidate; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`});
          } else if(url.pathname==='/api/candidate/page'&&req.method==='POST') {
            const session=req.headers.get('Cookie')?.match(/(?:^|; )candidate_session=([^;]*)/)?.[1]||'';
            res=json(await w.candidatePage(session,body.token));
          } else res=json({error:'Not found.'},404);
        } else if (url.pathname === '/api/public-brief' && req.method === 'GET') {
          const tenant=text(url.searchParams.get('workspace'),100),token=text(url.searchParams.get('token'),100);
          requireThat(/^[a-zA-Z0-9_-]+$/.test(tenant)&&/^[a-f0-9-]{72}$/.test(token),'Brief not found.',404);
          const brief=await (env.WORKSPACE.getByName(tenant) as any).publicBrief(token);
          requireThat(brief,'This brief is no longer shared.',404);res=json(brief);
        } else if (setup) {
          requireThat(
            req.method === "POST" &&
              env.SETUP_KEY &&
              req.headers.get("Authorization") === `Bearer ${env.SETUP_KEY}`,
            "Not found.",
            404,
          );
          requireThat(
            typeof body.tenant==='string' && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(body.tenant) && ["xqtiv","agent-test",...(env.TENANT_SETUP_IDS||'').split(',').map(s=>s.trim()).filter(Boolean)].includes(body.tenant),
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
        } else if (url.pathname === '/api/change-password') {
          requireThat(req.method === 'POST', 'Method not allowed.', 405);
          const result = await identity.changePasswordAttempt(rawCookie, body, ip);
          res = json({ok:true},200,{'Set-Cookie':cookie(result.token)});
        } else if (url.pathname === '/api/change-email/request') {
          requireThat(req.method==='POST','Method not allowed.',405);
          requireThat(env.RESEND_API_KEY&&env.INVITATION_FROM,'Email verification is not configured. Ask your administrator.',503);
          const result=await identity.requestEmailChange(rawCookie,body,ip);
          const status=await sendAccountEmail(env,result.email,'code',result.code,result.id);
          requireThat(status==='accepted','Code delivery could not be confirmed. Your sign-in email has not changed. Wait one minute and request another code.',503);
          res=json({ok:true,email:result.email});
        } else if (url.pathname === '/api/change-email/confirm') {
          requireThat(req.method==='POST','Method not allowed.',405);
          const result=await identity.confirmEmailChange(rawCookie,body,ip);
          const notificationStatus=await sendAccountEmail(env,result.oldEmail,'changed',result.email,result.id);
          res=json({ok:true,email:result.email,notificationStatus},200,{'Set-Cookie':cookie(result.token)});
        } else if (url.pathname === "/api/logout") {
          requireThat(req.method === "POST", "Method not allowed.", 405);
          await identity.logout(rawCookie);
          res = json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
        } else if(url.pathname==='/api/session'&&req.method==='GET') {
          const current=await identity.sessionUser(rawCookie);requireThat(current,'Please sign in again.',401);res=json(current);
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
          if(url.pathname.startsWith('/api/backups/')) {
            requireThat(hasRole(a,'super_admin'),'Workspace owner permission required.',403);
            if(url.pathname==='/api/backups/status'&&req.method==='GET')res=json(await workspace.backupStatus(a));
            else if(url.pathname==='/api/backups/run'&&req.method==='POST') {
              await identity.limit('backup:'+a.tenant,3);
              res=json(await workspace.backupNow(a,await identity.members(a.tenant)));
            } else if(url.pathname==='/api/backups/export'&&req.method==='POST') {
              await identity.limit('export:'+a.tenant,5);
              const bytes=await workspace.exportBusiness(a,await identity.members(a.tenant));
              res=new Response(bytes,{headers:{'Content-Type':'application/zip','Cache-Control':'no-store','Content-Disposition':'attachment; filename="business-export.zip"'}});
            } else if(url.pathname==='/api/backups/download'&&req.method==='POST') {
              requireThat(env.BACKUPS,'Private backup storage is not connected.',503);
              requireThat(typeof body.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(body.id),'Invalid backup ID.');
              const key=backupPrefix(a.tenant)+body.id;
              const manifest=await env.BACKUPS.get(key+'.manifest.json');requireThat(manifest,'Completed backup not found.',404);
              const file=await env.BACKUPS.get(key+'.zip');requireThat(file,'Backup file not found.',404);
              res=new Response(file.body,{headers:{'Content-Type':'application/zip','Cache-Control':'no-store','Content-Disposition':'attachment; filename="business-backup.zip"'}});
            } else res=json({error:'Not found.'},404);
          }
          else if (url.pathname.startsWith('/api/crm/')) {
            requireThat(hasRole(a,'admin'),'Administrator permission required.',403);
            const token = readCRMToken(env.RECRUITCRM_TOKENS,a.tenant);
            if(url.pathname.startsWith('/api/crm/candidates/')&&req.method==='POST'){
              requireThat(typeof token==='string'&&token.length>0,'RecruitCRM is not connected for this workspace.',409);
              const action=url.pathname.slice('/api/crm/candidates/'.length);
              if(action==='list')res=json(await workspace.crmCandidateImports(a));
              else if(action==='start')res=json(await workspace.crmCandidateStart(a,text(body.search_id),token));
              else if(action==='preview')res=json(await workspace.crmCandidatePreview(a,text(body.id)));
              else if(action==='fetch-next')res=json(await workspace.crmCandidateFetchNext(a,text(body.id),token));
              else if(action==='apply-next')res=json(await workspace.crmCandidateApply(a,text(body.id),body.stages));
              else res=json({error:'Not found.'},404);
            }
            else if(url.pathname === '/api/crm/status' && req.method === 'GET') {
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
                if(!item.search_id&&!Object.prototype.hasOwnProperty.call(item,'partner_id')) {
                  const saved=(await workspace.crmState(a)).jobs.find((j:any)=>j.external_id===item.external_id);
                  if(saved?.saved_partner_id) {item.partner_id=saved.saved_partner_id;}
                }
                if(Object.prototype.hasOwnProperty.call(item,'partner_id')) {
                  const partner=item.partner_id?members.find((m:any)=>m.id===item.partner_id&&m.status==='active'&&canPartnerReview(m)):null;
                  requireThat(!item.partner_id||partner,'Choose an active engagement partner.');
                  item.partner=partner?.name || '';
                }
              }
              res = json(await workspace.applyCRM(a,body.jobs));
            }
            else res = json({error:'Not found.'},404);
          }
          else if (url.pathname === "/api/state" && req.method === "GET") {
            const partners=(await identity.members(a.tenant)).filter((m:any)=>m.status==='active' && canPartnerReview(m)).map((m:any)=>({id:m.id,name:m.name}));
            const people=(await identity.members(a.tenant)).filter((m:any)=>m.status==='active').map((m:any)=>({id:m.id,name:m.name,role:m.role,roles:m.roles,staff_id:m.staff_id,status:m.status}));
            if(env.BACKUPS)await workspace.ensureBackupSchedule(a.tenant);
            const state=await workspace.state(a,await identity.members(a.tenant));
            res = json({...state,partners,people,staff:state.staff?.filter((s:any)=>people.some((p:any)=>p.staff_id===s.id)).map((s:any)=>({...s,name:people.find((p:any)=>p.staff_id===s.id)?.name||s.name,archived:people.some((p:any)=>p.staff_id===s.id&&hasRole(p,'researcher'))?0:1}))});
          }
          else if (url.pathname === '/api/geography-lookup'&&req.method==='POST') {
            requireThat(canPlan(a)||['data_quality','researcher','partner','engagement'].some(role=>hasRole(a,role as any)),'Candidate editing permission required.',403);
            await identity.limit('geography-lookup:'+a.tenant+':'+a.id,90);
            const labels=await lookupGeography(body.query,async key=>{
              requireThat(/^(index|[a-f0-9]+-[a-f0-9]+)$/.test(key),'Invalid location catalog key.');
              const cached=geographyCatalogCache.get(key);if(cached)return cached;
              const response=await env.ASSETS.fetch(new Request(new URL('/geography/'+key+'.json',url.origin)));
              requireThat(response.ok&&response.headers.get('Content-Type')?.includes('application/json'),'Location catalog unavailable.',503);
              const data=await response.json();
              if(geographyCatalogCache.size>=9)geographyCatalogCache.delete([...geographyCatalogCache.keys()].find(k=>k!=='index')!);
              geographyCatalogCache.set(key,data);return data;
            });
            res=json(await Promise.all(labels.map(label=>signGeography(label,rawCookie,a.tenant))));
          }
          else if (url.pathname === '/api/company-logo'&&req.method==='GET') {
            res=await companyLogo(url.searchParams.get('domain')||'');
          }
          else if (url.pathname === '/api/company-lookup'&&req.method==='POST') {
            requireThat(canPlan(a),'Planning permission required.',403);
            await identity.limit('company-lookup:'+a.id,30);
            res=json(await companySuggestions(text(body.name,200)));
          }
          else if (url.pathname === '/api/candidate-invites'&&req.method==='POST') {
            if(body.action==='list')res=json(await workspace.candidateInvites(a,text(body.role_id)));
            else if(body.action==='revoke')res=json(await workspace.candidateRevoke(a,text(body.id)));
            else {
              requireThat(body.action==='send','Unknown invitation action.');
              requireThat(env.RESEND_API_KEY&&env.INVITATION_FROM,'Configure invitation email before inviting candidates.',409);
              const invite=await workspace.candidateInvite(a,body);
              const link=`${url.origin}/role-invite?workspace=${encodeURIComponent(a.tenant)}#${invite.token}`;
              const emailStatus=await sendRoleEmail(env,invite.email,'invitation',link,invite.id);
              res=json({id:invite.id,emailStatus});
            }
          }
          else if (url.pathname === '/api/research' && req.method === 'POST') {
            // Never trust a caller-supplied list of verified locations.
            delete body.verified_geographies;
            if(body.action==='candidate-tags')body.verified_geographies=await verifyGeographies(body.geography_choices,rawCookie,a.tenant);
            delete body.geography_choices;
            res=json(await workspace.research(a,body,await identity.members(a.tenant)));
          }
          else if(url.pathname==='/api/members/update'&&req.method==='POST') {
            requireThat(hasRole(a,'admin'),'Administrator permission required.',403);
            const members=await identity.members(a.tenant),old=members.find((m:any)=>m.id===body.id);
            requireThat(old,'Account not found.',404);
            requireThat(Array.isArray(body.roles)&&body.roles.length>0&&body.roles.every((r:any)=>roles.includes(r)),'Choose at least one valid role.');
            requireThat(Number(body.version)===old.version,'This account changed. Reload before saving.',409);
            requireThat(hasRole(a,'super_admin')||(!hasRole(old,'super_admin')&&!body.roles.includes('super_admin')),'Only a super admin can change a super admin account.',403);
            res=json(await identity.updateMember(a,body));
          }
          else if(url.pathname==='/api/workspace-reset'&&req.method==='POST') {
            const people=await identity.resetTestPeople(a,{preview:true}); // Verifies original owner, not merely admin.
            if(body.action==='preview')res=json({people,...await workspace.previewReset(a)});
            else if(body.action==='save-baseline')res=json(await workspace.saveCleanBaseline(a,{...people,members:await identity.members(a.tenant)}));
            else if(body.action==='backups')res=json(await workspace.resetBackups(a));
            else if(body.action==='backup')res=json(await workspace.resetBackup(a,text(body.id,100)));
            else {
              requireThat(body.action==='reset','Unknown reset action.');
              requireThat(body.peopleSignature===people.signature,'People changed. Preview the reset again.',409);
              requireThat(text(body.confirmEmail,254).toLowerCase()===people.keep.email,'Enter your sign-in email to confirm.');
              // Snapshot + operational deletion are atomic. If identity cleanup fails, the backup remains
              // and the UI reports the partial result; retrying previews the remaining people safely.
              const result=await workspace.resetWorkspace(a,body,{...people,members:await identity.members(a.tenant)});
              try {
                await identity.resetTestPeople(a,{signature:people.signature,confirmEmail:body.confirmEmail});
                await workspace.syncPeople(await identity.members(a.tenant));
                res=json({...result,ok:true});
              } catch {
                res=json({...result,ok:false,error:'Workspace data was cleared and backed up, but people cleanup did not finish. Preview and run the reset again to remove remaining workspace accounts.'});
              }
            }
          }
          else if(url.pathname==='/api/people/reset'&&req.method==='POST'){const result=await identity.resetTestPeople(a,body);if(!body.preview)await workspace.syncPeople(await identity.members(a.tenant));res=json(result);}
          else if(url.pathname==='/api/invitations/cancel'&&req.method==='POST')res=json(await identity.cancelInvitation(a,text(body.id,100)));
          else if (url.pathname === "/api/mutate" && req.method === "POST") {
            requireThat(!['staff','staff-edit','staff-archive'].includes(body.kind),'Manage accepted accounts and roles in People & access. Standalone researcher records are retired.',410);
            requireThat(!['entry','review','reopen'].includes(body.kind),'Manual count entry is retired. Add candidate mappings and use their review workflow.',410);
            if(['search','search-owner','crm-owner'].includes(body.kind)) {
              const partner=body.partner_id ? (await identity.members(a.tenant)).find((m:any)=>m.id===body.partner_id && m.status==='active' && canPartnerReview(m)) : null;
              requireThat(!body.partner_id || partner,'Choose an active engagement partner.');
              body.partner=partner?.name || '';
            }
            res = json(await workspace.mutate(a, body.kind, body, await identity.members(a.tenant)));
          }
          else if (url.pathname === "/api/bulk" && req.method === "POST") {
            requireThat(Array.isArray(body.changes)&&body.changes.every((b:any)=>b.kind==='assignment-edit'),'Manual count entry is retired. Add candidate mappings instead.',410);
            res = json({saved: await workspace.bulk(a, body.changes)});
          }
          else if (url.pathname === "/api/invite" && req.method === "POST") {
            requireThat(
              hasRole(a,'admin'),
              "Administrator permission required.",
              403,
            );
            const assigned=Array.isArray(body.roles)?body.roles:[body.role];
            requireThat(assigned.length>0&&assigned.every((r:any)=>roles.includes(r)), "Choose a permission role.");
            requireThat(!assigned.includes('super_admin')||hasRole(a,'super_admin'),'Only a super admin can grant super admin access.',403);
            const members=await identity.members(a.tenant),email=text(body.email,254).toLowerCase();
            requireThat(!members.some((m:any)=>m.email===email),'This person already has an account here. Edit their roles instead.',409);
            const invite = await identity.invite(
              text(body.email, 254),
              text(body.name, 100),
              a.tenant,
              assigned[0],
              null,
              false,
              assigned,
            );
            const invitationUrl = `${url.origin}/join/${invite}`;
            const emailStatus = await sendInvitationEmail(env, text(body.email, 254).toLowerCase(), invitationUrl);
            res = json({ url: invitationUrl, emailStatus });
          } else if(url.pathname==='/api/staff-directory'&&req.method==='GET') {
            requireThat(hasRole(a,'admin'),'Administrator permission required.',403);
            res=json({members:await identity.members(a.tenant),invitations:await identity.pendingInvitations(a.tenant)});
          } else if (url.pathname === "/api/members" && req.method === "GET") {
            requireThat(
              hasRole(a,'admin'),
              "Administrator permission required.",
              403,
            );
            res = json(await identity.members(a.tenant));
          } else if (url.pathname === "/api/revoke" && req.method === "POST") {
            requireThat(
              hasRole(a,'admin'),
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
          code: e.code,
          error: e.status
            ? e.message
            : "The request could not be completed. Please check your input and try again.",
        },
        e.status ?? 500,
      );
    }
    const headers = new Headers(res.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    if(url.protocol==='https:')headers.set("Strict-Transport-Security","max-age=31536000");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Frame-Options", "DENY");
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    return new Response(res.body, { status: res.status, headers });
  },
};
