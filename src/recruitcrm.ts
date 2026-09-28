import { requireThat, text } from './domain';
export type CRMJob = {external_id:string; title:string; status:string; company_slug:string};
export function readCRMToken(raw: string | undefined, tenant: string): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  let token: unknown;
  if (value.startsWith('{') || value.startsWith('[') || value.startsWith('"')) {
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch { throw Object.assign(new Error('RecruitCRM secret is not valid JSON. In Cloudflare, save either the token alone or an object with an xqtiv entry.'), {status:409}); }
    if (typeof parsed === 'string') token = tenant === 'xqtiv' ? parsed : null;
    else {
      requireThat(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'RecruitCRM secret must be a token or an object keyed by workspace.',409);
      token = Object.prototype.hasOwnProperty.call(parsed,tenant) ? (parsed as Record<string,unknown>)[tenant] : null;
    }
  } else token = tenant === 'xqtiv' ? value : null;
  if (token == null) return null;
  requireThat(typeof token === 'string', 'RecruitCRM token must be text. Check the Cloudflare secret value.',409);
  const cleaned = token.trim().replace(/^Bearer\s+/i,'');
  requireThat(cleaned.length > 0 && !/\s/.test(cleaned), 'RecruitCRM token contains spaces or line breaks. Copy only the API token into the Cloudflare secret.',409);
  return cleaned;
}
export function normalizeJob(job:any): CRMJob {
  requireThat(job && (typeof job.id === 'string' || typeof job.id === 'number') && String(job.id).length > 0, 'RecruitCRM returned a job without an ID.',502);
  requireThat(typeof job.name === 'string' && job.name.trim(), 'RecruitCRM returned a job without a name.',502);
  return {external_id:String(job.id),title:text(job.name),status:text(job.job_status?.label) || 'Unknown',company_slug:text(job.company_slug)};
}
export async function fetchJobs(token:string, transport:typeof fetch = fetch):Promise<CRMJob[]> {
  let url: string | null = 'https://api.recruitcrm.io/v1/jobs';
  const seen = new Set<string>(), jobs = new Map<string,CRMJob>();
  while(url) {
    requireThat(!seen.has(url) && seen.size < 100, 'RecruitCRM pagination exceeded the supported sync size.',502);
    let parsed: URL;
    try { parsed = new URL(url); }
    catch { throw Object.assign(new Error('RecruitCRM returned an invalid pagination URL.'), {status:502}); }
    requireThat(parsed.origin === 'https://api.recruitcrm.io' && parsed.pathname === '/v1/jobs' && !parsed.username && !parsed.password, 'RecruitCRM returned an unexpected pagination URL.',502);
    seen.add(url);
    let response: Response;
    try {
      response = await transport(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
    } catch (error: any) {
      const timeout = ['TimeoutError','AbortError'].includes(error?.name);
      throw Object.assign(new Error(timeout
        ? 'RecruitCRM did not respond within 30 seconds. No searches were imported. Please retry.'
        : 'The server could not reach RecruitCRM. No searches were imported. Please retry; if this persists, report connection error CRM_NETWORK.'), {status:502});
    }
    requireThat(response.status !== 401 && response.status !== 403, 'RecruitCRM rejected access. Check that the API token is active and your RecruitCRM plan permits public API access.',502);
    requireThat(response.status !== 429, 'RecruitCRM rate limit reached. Wait and retry the sync.',429);
    requireThat(response.ok, `RecruitCRM request failed (${response.status}). Check the connection and retry.`,502);
    let body: any;
    try { body = await response.json(); }
    catch { throw Object.assign(new Error('RecruitCRM returned a response that was not valid JSON. No searches were imported. Report response error CRM_RESPONSE.'),{status:502}); }
    requireThat(Array.isArray(body.data), 'RecruitCRM returned an unexpected response.',502);
    for(const raw of body.data) {const job=normalizeJob(raw); jobs.set(job.external_id,job);}
    requireThat(jobs.size <= 10000,'RecruitCRM returned too many jobs for one sync.',502);
    url = !body.next_page_url || body.next_page_url === 'null' ? null : String(body.next_page_url);
  }
  return [...jobs.values()];
}
