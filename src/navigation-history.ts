export type Visit={page:string;candidateId:string;[key:string]:any};
export type NavigationHistory={past:Visit[];present:Visit|null;future:Visit[]};
export const emptyHistory=():NavigationHistory=>({past:[],present:null,future:[]});
export const visitKey=(input:Visit)=>{const v=normalizeEngagementVisit(input);return v.page+'|'+(v.page==='Candidates'?v.candidateId:v.page==='Search repository'?(v.selected||'')+'|'+(v.repoTab||''):v.page==='Pipeline'?(v.viewStates?.Pipeline?.['Engagement.role']||''):'');};
export function recordVisit(h:NavigationHistory,v:Visit):NavigationHistory{
 if(!v.page)return emptyHistory();
 if(!h.present)return {...h,present:v};
 if(visitKey(h.present)===visitKey(v))return {...h,present:v};
 return {past:[...h.past,h.present].slice(-50),present:v,future:[]};
}
export function travelHistory(h:NavigationHistory,direction:'back'|'forward'):NavigationHistory{
 if(direction==='back'){const v=h.past.at(-1);return v?{past:h.past.slice(0,-1),present:v,future:[h.present!,...h.future]}:h;}
 const v=h.future[0];return v?{past:[...h.past,h.present!],present:v,future:h.future.slice(1)}:h;
}

/** Restore old queue browser-history entries into the same workspace, not a second screen. */
export function normalizeEngagementVisit<T extends Visit>(visit:T):T{
 if(visit.page!=='Daily Work')return visit;
 const old=visit.viewStates?.['Daily Work']||{};
 return {...visit,page:'Pipeline',engagementStart:{role:'',mapping:'',stage:''},viewStates:{...visit.viewStates,Pipeline:{
  ...visit.viewStates?.Pipeline,'Engagement.role':'','Engagement.unifiedLayout':'Searches','Engagement.queueBucket':'all',
  'Engagement.scope':old['EngagementDaily.scope']||'all','Engagement.searchStatus':old['EngagementDaily.status']||'open',
  'Engagement.candidateQuery':'','Engagement.group':'all','Engagement.focus':''
 }}};
}
