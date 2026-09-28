export type CRMFilters={id:string;title:string;statuses:string[]|null;companies:string[]|null;partners:string[]|null};
export const emptyCRMFilters=():CRMFilters=>({id:'',title:'',statuses:null,companies:null,partners:null});
export function filterCRMRows<T extends {external_id:string;title:string;status:string}>(rows:T[],filters:CRMFilters,client:(r:T)=>string,partner:(r:T)=>string):T[] {
 const includes=(allowed:string[]|null,value:string)=>allowed===null||allowed.includes(value);
 return rows.filter(r=>r.external_id.toLowerCase().includes(filters.id.toLowerCase().trim())&&r.title.toLowerCase().includes(filters.title.toLowerCase().trim())&&includes(filters.statuses,r.status)&&includes(filters.companies,client(r))&&includes(filters.partners,partner(r)));
}
