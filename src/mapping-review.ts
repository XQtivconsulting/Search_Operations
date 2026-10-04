import {canPartnerReview} from './domain';
import {canTeamReview} from './team-review';
type R=Record<string,any>;
/** Mirrors review authorization for presentation; the server still authorizes every write. */
export function mappingReviewAction(actor:R,mapping:R,search:R|undefined,roster:R[],assignments:R[]=[]){
 const label=mapping.status==='Peer review'?'Team review':mapping.status==='Partner review'?'Partner review':'';
 if(!label)return {label,allowed:false,reason:''};
 if(mapping.status==='Peer review'){
  const allowed=canTeamReview(actor,mapping,search,roster,assignments);
  return {label,allowed,reason:allowed?'':'A sourcing team member, the search partner or a super admin can review.'};
 }
 if(search?.partner_id!==actor.id)return {label,allowed:false,reason:'Only the assigned search partner can complete this review.'};
 const allowed=canPartnerReview(actor);
 return {label,allowed,reason:allowed?'':'Partner review permission is required.'};
}
