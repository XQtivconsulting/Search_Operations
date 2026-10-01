import {hasRole} from './domain';
type R=Record<string,any>;
/** Shared team-stage eligibility. Formal partner review remains a separate permission. */
export function canTeamReview(actor:R,mapping:R,search:R|undefined,roster:R[]):boolean{
 return hasRole(actor,'super_admin')||!!search&&search.partner_id===actor.id&&hasRole(actor,'partner')||hasRole(actor,'researcher')&&roster.some(m=>m.team_id===mapping.team_id&&m.staff_id===(actor.staffId||actor.staff_id));
}
