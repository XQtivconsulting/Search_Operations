import { requireThat, text } from './domain';
export type CRMJob = {external_id:string; title:string; status:string; company_slug:string};
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
    const parsed = new URL(url);
    requireThat(parsed.origin === 'https://api.recruitcrm.io' && parsed.pathname === '/v1/jobs' && !parsed.username && !parsed.password, 'RecruitCRM returned an unexpected pagination URL.',502);
    seen.add(url);
    const response = await transport(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
    requireThat(response.status !== 429, 'RecruitCRM rate limit reached. Wait and retry the sync.',429);
    requireThat(response.ok, `RecruitCRM request failed (${response.status}). Check the connection and retry.`,502);
    const body = await response.json() as any;
    requireThat(Array.isArray(body.data), 'RecruitCRM returned an unexpected response.',502);
    for(const raw of body.data) {const job=normalizeJob(raw); jobs.set(job.external_id,job);}
    requireThat(jobs.size <= 10000,'RecruitCRM returned too many jobs for one sync.',502);
    url = !body.next_page_url || body.next_page_url === 'null' ? null : String(body.next_page_url);
  }
  return [...jobs.values()];
}
