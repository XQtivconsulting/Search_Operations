import {engagementAssignees} from './engagement-domain';
import {canTeamReview} from './team-review';
import {canReceiveEngagementAssignment} from './engagement-assignment';
type R=Record<string,any>;
export function mappingNextOwner(mapping:R,data:R):string{
 const people:R[]=data.people||[],records:R[]=data.research?.records||[],search=data.searches?.find((s:R)=>s.id===mapping.role_id);
 const names=(ids:string[])=>[...new Set(ids)].map(id=>people.find(p=>p.id===id&&p.status!=='removed'&&p.status!=='revoked'&&p.status!=='inactive')?.name).filter(Boolean).join(', ')||'Unassigned';
 if(mapping.status==='Imported')return names(engagementAssignees(records,mapping.role_id).filter(id=>people.some(p=>p.id===id&&canReceiveEngagementAssignment(p as any))));
 if(mapping.status==='Peer review')return names(people.filter(p=>(!p.status||p.status==='active')&&canTeamReview(p,mapping,search,data.team_members||[],data.assignments||[])).map(p=>p.id));
 if(['Approved','Rejected'].includes(mapping.status))return '—';
 return names([['Draft','Needs information'].includes(mapping.status)?mapping.mapper_id:mapping.status==='Partner review'?search?.partner_id:mapping.reviewer_id].filter(Boolean));
}
