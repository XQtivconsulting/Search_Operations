type R=Record<string,any>;
export const interviewStatuses=['Not started','Scheduled','Completed','Cancelled'];
export const interviewOutcomes=['Pending','Progressing','Rejected'];
export const candidateMatches=(candidate:R|undefined,query:string)=>query.trim().toLowerCase().split(/\s+/).filter(Boolean).every(term=>[candidate?.name,candidate?.first_name,candidate?.last_name,candidate?.company,candidate?.email,candidate?.phone].join(' ').toLowerCase().includes(term));
export const pipelineUsesList=(layout:string,role:string,query:string)=>layout==='List'||!role||!!query.trim();
export const interviewTone=(round:R)=>round.outcome==='Rejected'?'rejected':round.outcome==='Progressing'?'progressing':round.status==='Scheduled'?'scheduled':round.status==='Completed'?'awaiting':'neutral';
export const inInterviewTracker=(row:R,group:string)=>!!row.recommended_on||!!row.interviews?.length||['recommended','accepted','interviews','offer','placed'].includes(row.stage_id)||['Client Process','Placed'].includes(group);
