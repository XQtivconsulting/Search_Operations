type R=Record<string,any>;
export function companyCoverage(target:R,records:R[]){
 const candidates=new Set(records.filter(m=>m.kind==='mapping'&&m.role_id===target.role_id&&m.status==='Approved'&&(m.target_id===target.id||m.company_id===target.company_id)).map(m=>m.candidate_id||m.id));
 const planned=target.expected===null||target.expected===undefined||target.expected===''?null:Number(target.expected);
 return {planned,actual:candidates.size,remaining:planned===null?null:Math.max(0,planned-candidates.size)};
}
export function coverageAlert(target:R,records:R[]){
 if(target.coverage_flag)return 'Coverage mismatch — partner review';
 if(['Need help','Blocked'].includes(target.status))return 'Need help — partner review';
 const {planned,actual}=companyCoverage(target,records);
 return ['Completed','No relevant talent'].includes(target.status)&&planned!==null&&planned!==actual?`${actual} approved / ${planned} planned — partner review`:'';
}
