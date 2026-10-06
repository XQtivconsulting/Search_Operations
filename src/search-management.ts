export const searchStatuses=['Open','On Hold','Closed','Abandoned','Canceled'] as const;
export function isCRMManaged(search:{external_id?:string|null;crm_managed?:number}) {
 return !!search.external_id&&!search.external_id.startsWith('LOCAL-')&&search.crm_managed!==0;
}
