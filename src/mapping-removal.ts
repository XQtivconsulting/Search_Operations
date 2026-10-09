import {hasPermission} from './access-policy';
export function canRemoveDraft(a:any,m:any,search:any){
 return m?.kind==='mapping'&&m.status==='Draft'&&!m.submitted_at&&!m.cycle&&!m.peer_decision&&!m.partner_decision&&!m.peer_reviewed_at&&!m.partner_reviewed_at&&!m.historical&&
 ((m.mapper_id===a.id&&hasPermission(a,'candidates.add'))||(search?.partner_id===a.id&&hasPermission(a,'reviews.partner')));
}
