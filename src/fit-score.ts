export const fitLabels=['Does not fit','Limited fit','Partial fit','Meets requirement','Strong fit'];
export function criterionWeights(criteria:any[]=[]):number[]{return criteria.map(c=>c.weight==null?100/Math.max(1,criteria.length):Number(c.weight));}
export function equalWeights(criteria:any[]=[]){const base=Math.floor(10000/Math.max(1,criteria.length));return criteria.map((c,i)=>({...c,weight:(base+(i<10000-base*criteria.length?1:0))/100}));}
export function fitSummary(criteria:any[]=[],evidence:any={}){
 const weights=criterionWeights(criteria),weightFor=(c:any)=>weights[criteria.indexOf(c)];
 const applicable=criteria.filter(c=>!evidence[c.id]?.not_applicable);
 const rated=applicable.filter(c=>Number.isInteger(evidence[c.id]?.rating)&&evidence[c.id].rating>=1&&evidence[c.id].rating<=5);
 const complete=criteria.length>0&&rated.length===applicable.length,weightTotal=applicable.reduce((n,c)=>n+weightFor(c),0);
 return {rated:rated.length,total:applicable.length,excluded:criteria.length-applicable.length,complete,score:complete&&rated.length&&weightTotal>0?rated.reduce((n,c)=>n+evidence[c.id].rating*weightFor(c),0)/weightTotal:null,allMeet:criteria.length>0&&criteria.every(c=>!evidence[c.id]?.not_applicable&&evidence[c.id]?.rating>=4)};
}
export function mappingFit(mapping:any,criteria:any[]){
 const snapshot=mapping.criteria_snapshot||[];
 const comparable=criteria.length>0&&criteria.length===snapshot.length&&criteria.every(c=>snapshot.some((s:any)=>s.id===c.id&&s.label===c.label&&s.requirement===c.requirement));
 return {...fitSummary(comparable?criteria:snapshot,mapping.evidence),comparable};
}

export function matchesCriterionFilters(evidence:any,rules:Record<string,number>,mode='all'){
 const checks=Object.entries(rules).map(([id,min])=>!evidence?.[id]?.not_applicable&&Number.isInteger(evidence?.[id]?.rating)&&evidence[id].rating>=min);
 return !checks.length||(mode==='any'?checks.some(Boolean):checks.every(Boolean));
}
