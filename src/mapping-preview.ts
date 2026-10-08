type R=Record<string,any>;
// Excluding a row needs no network call. Clear the signature so import must revalidate.
export function skipMappingRow(preview:R,row:number):R{
 return {...preview,signature:null,plan:preview.plan.map((p:R)=>p.row===row?{...p,error:undefined,needs_choice:false,result:'Skip',candidate_result:'Skipped',options:[],warnings:[]}:p)};
}
