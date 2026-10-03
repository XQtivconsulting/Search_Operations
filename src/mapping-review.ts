import {canPartnerReview} from './domain';
import {canTeamReview} from './team-review';
type R=Record<string,any>;
/** Mirrors review authorization for presentation; the server still authorizes every write. */
export function mappingReviewAction(actor:R,mapping:R,search:R|undefined,roster:R[]){
 const label=mapping.status==='Peer review'?'Team review':mapping.status==='Partner review'?'Partner review':'';
 if(!label)return {label,allowed:false,reason:''};
 if(mapping.status==='Peer review'){
  const allowed=canTeamReview(actor,mapping,search,roster);
  return {label,allowed,reason:allowed?'':'A sourcing team member, the search partner or a super admin can review.'};
 }
 if(search?.partner_id!==actor.id)return {label,allowed:false,reason:'Only the assigned search partner can complete this review.'};
 if(actor.id===mapping.mapper_id||!!actor.staffId&&actor.staffId===mapping.staff_id)return {label,allowed:false,reason:'You mapped this candidate. Partner review requires a different assigned search partner.'};
 const allowed=canPartnerReview(actor);
 return {label,allowed,reason:allowed?'':'Partner review permission is required.'};
}

export function partnerReviewConflict(mapping:R,search:R|undefined,people:R[]){
 const partner=people.find(p=>p.id===search?.partner_id);
 return mapping.status==='Partner review'&&!!search?.partner_id&&(search.partner_id===mapping.mapper_id||!!partner?.staff_id&&partner.staff_id===mapping.staff_id);
}
