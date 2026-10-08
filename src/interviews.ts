type R=Record<string,any>;
export const interviewStatuses=['Not started','To be scheduled','Scheduled','Rescheduled','Completed','Cancelled'];
export const interviewOutcomes=['Pending','Progressing','Rejected','Positive','Negative','Mixed','Hold'];
export const candidateMatches=(candidate:R|undefined,query:string)=>query.trim().toLowerCase().split(/\s+/).filter(Boolean).every(term=>[candidate?.name,candidate?.first_name,candidate?.last_name,candidate?.company,candidate?.email,candidate?.phone].join(' ').toLowerCase().includes(term));
export const interviewTone=(round:R)=>['Rejected','Negative'].includes(round.outcome)?'rejected':['Progressing','Positive'].includes(round.outcome)?'progressing':['Scheduled','Rescheduled'].includes(round.status)?'scheduled':round.status==='Completed'?'awaiting':'neutral';
export const inInterviewTracker=(row:R,group:string)=>!!row.recommended_on||!!row.interviews?.length||['recommended','accepted','interviews','offer','placed'].includes(row.stage_id)||['Client Process','Placed'].includes(group);

export const matchesInterviewTracker=(row:R,group:string,includeAwaiting=false)=>inInterviewTracker(row,group)||(includeAwaiting&&row.stage_id==='shortlist');
