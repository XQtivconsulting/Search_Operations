import {effectiveDecision} from './search-decisions';
type R=Record<string,any>;
export const searchStatuses=['Open','Closed','Abandoned','Cancelled'];
export function searchStatus(value:unknown):string {
 const status=String(value||'Unknown').trim();
 if(/^cancell?ed$/i.test(status))return 'Cancelled';
 return searchStatuses.find(s=>s.toLowerCase()===status.toLowerCase())||status;
}
export function matchesPlanningSearch(search:R,priorities:R[],week:string,decisions:string[]|null,statuses:string[]|null,roles:string[]|null=null){
 return (roles===null||roles.includes(search.id))&&(statuses===null||statuses.includes(searchStatus(search.status)))&&(decisions===null||decisions.includes(effectiveDecision(priorities,search.id,week)?.disposition||'Not decided'));
}
