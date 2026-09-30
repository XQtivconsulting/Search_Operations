export const fitLabels=['Does not fit','Limited fit','Partial fit','Meets requirement','Strong fit'];
export function fitSummary(criteria:any[]=[],evidence:any={}){
 const applicable=criteria.filter(c=>!evidence[c.id]?.not_applicable);
 const rated=applicable.filter(c=>Number.isInteger(evidence[c.id]?.rating)&&evidence[c.id].rating>=1&&evidence[c.id].rating<=5);
 const complete=criteria.length>0&&rated.length===applicable.length;
 return {rated:rated.length,total:applicable.length,excluded:criteria.length-applicable.length,complete,score:complete&&rated.length?rated.reduce((n,c)=>n+evidence[c.id].rating,0)/rated.length:null,allMeet:criteria.length>0&&criteria.every(c=>!evidence[c.id]?.not_applicable&&evidence[c.id]?.rating>=4)};
}
export function mappingFit(mapping:any,criteria:any[]){
 const snapshot=mapping.criteria_snapshot||[];
 const comparable=criteria.length>0&&criteria.length===snapshot.length&&criteria.every(c=>snapshot.some((s:any)=>s.id===c.id&&s.label===c.label&&s.requirement===c.requirement));
 return {...fitSummary(snapshot,mapping.evidence),comparable};
}
