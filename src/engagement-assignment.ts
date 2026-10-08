import {hasPermission} from './access-policy';
type Person={id:string;name?:string;status?:string;role?:unknown;roles?:unknown;permissions?:unknown};
/** The picker and server must agree, including custom roles and revoked accounts. */
export const canReceiveEngagementAssignment=(person:Person)=>person.status==='active'&&(hasPermission(person,'engagement.work')||hasPermission(person,'engagement.interviews'));
export function unavailableEngagementAssignments(people:Person[],selected:string[]){
 const byId=new Map(people.map(p=>[p.id,p]));
 return [...new Set(selected)].filter(id=>!byId.has(id)||!canReceiveEngagementAssignment(byId.get(id)!)).map(id=>({id,name:byId.get(id)?.name||'Former or unavailable member'}));
}
