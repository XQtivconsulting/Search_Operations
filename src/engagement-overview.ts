import {dailyEngagementRows,matchesQueue,queueLabels} from './engagement-daily';
import {searchEngagementRows} from './engagement-workspace';
import {engagementAssignees} from './engagement-domain';
import {matchesSearchStatus} from './SearchFilters';
type R=Record<string,any>;
export const engagementBuckets=[
 {id:'all',label:'All candidates',hint:'Candidate-search mappings, including sourcing and completed outcomes.'},
 {id:'active',label:'Active',hint:'Approved candidates in active stages on open searches.'},
 {id:'overdue',label:'Overdue',hint:'Active candidates past the configured stage-age threshold.'},
 {id:'due',label:'Due today',hint:'Active candidates at the configured stage-age threshold.'},
 {id:'new',label:'New today',hint:'Active sourcing handoffs received today, US Eastern time.'},
 {id:'coming',label:'Awaiting approval',hint:'Mappings awaiting sourcing partner approval; engagement has not started.'},
 {id:'unscheduled',label:'Unscheduled',hint:'Active candidates with no stage threshold or an unknown stage start.'},
];
export const engagementBucketLabel=(id:string)=>engagementBuckets.find(b=>b.id===id)?.label||queueLabels[id]||'All candidates';
/** A single population powers summaries, search totals, list and Kanban. */
export function engagementOverviewRows(records:R[],searches:R[],now:number):R[]{
 const daily=new Map(dailyEngagementRows(records,searches,now).map(r=>[r.mapping_id,r]));
 return searchEngagementRows(records,searches,now).map(r=>({...r,...daily.get(r.mapping_id)}));
}
export function matchesEngagementBucket(row:R,bucket:string):boolean{
 if(bucket==='coming')return row.pending&&row.sourcing_status==='Partner review'&&!row.search_closed;
 if(bucket==='attention')return !!row.attention;
 return !!matchesQueue(row,bucket);
}
export function engagementCounts(rows:R[]):Record<string,number>{
 const counts:Record<string,number>=Object.fromEntries([...engagementBuckets.map(b=>b.id),'placed'].map(id=>[id,0]));
 for(const row of rows)for(const key of Object.keys(counts))if(matchesEngagementBucket(row,key))counts[key]++;
 return counts;
}
export function engagementSearchScope(searches:R[],records:R[],actorId:string,status:string,scope:string):R[]{
 return searches.filter(s=>matchesSearchStatus(s,status)&&(scope!=='mine'||s.partner_id===actorId||engagementAssignees(records,s.id).includes(actorId)));
}
export function groupEngagementRows(rows:R[]):Map<string,R[]>{
 const grouped=new Map<string,R[]>();for(const row of rows){const list=grouped.get(row.role_id)||[];list.push(row);grouped.set(row.role_id,list);}return grouped;
}
