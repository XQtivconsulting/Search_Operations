import {hasRole,canPartnerReview} from './domain';
type R=Record<string,any>;
/** Shared team-stage eligibility. Formal partner review remains a separate permission. */
export function canTeamReview(actor:R,mapping:R,search:R|undefined,roster:R[],assignments:R[]=[]):boolean{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
 const planned=assignments.filter(r=>r.search_id===mapping.role_id&&r.work_date<=today),latest=planned.map(r=>r.work_date).sort().at(-1);
 const teams=mapping.team_id?[mapping.team_id]:planned.filter(r=>r.work_date===latest).map(r=>r.team_id);
 return hasRole(actor,'super_admin')||!!search&&search.partner_id===actor.id&&canPartnerReview(actor)||hasRole(actor,'researcher')&&roster.some(m=>teams.includes(m.team_id)&&m.staff_id===(actor.staffId||actor.staff_id));
}
