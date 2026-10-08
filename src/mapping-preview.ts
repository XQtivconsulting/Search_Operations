type R=Record<string,any>;
// Excluding a row needs no network call. Clear the signature so import must revalidate.
export function skipMappingRow(preview:R,row:number):R{
 return {...preview,signature:null,plan:preview.plan.map((p:R)=>p.row===row?{...p,error:undefined,needs_choice:false,result:'Skip',candidate_result:'Skipped',options:[],warnings:[]}:p)};
}

export function mappingImportSummary(plan:R[]){
 const summary={create:0,enrich:0,update:0,unchanged:0,skipped:0,unresolved:0};
 for(const row of plan){if(row.error||row.needs_choice)summary.unresolved++;else if(row.result==='Create mapping'){if(row.existing_mapping_id)summary.enrich++;else summary.create++;}else if(row.result==='Update attribution')summary.update++;else if(row.result.startsWith('Existing mapping'))summary.unchanged++;else summary.skipped++;}
 return summary;
}
export function readyMappingRows(rows:R[],plan:R[]){
 const unresolved=new Set(plan.filter(r=>r.error||r.needs_choice).map(r=>r.row));
 return rows.map(r=>unresolved.has(r.row)?{...r,choice:'skip'}:r);
}
