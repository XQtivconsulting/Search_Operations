type R=Record<string,any>;
export const noteGroups=['Interview notes','General notes','Stage updates'] as const;
export type NoteGroup=typeof noteGroups[number];
export function belongsToNoteGroup(note:R,group:NoteGroup){
 const interview=!!note.interview||/^Interview(?: ·|$)/.test(note.type)||note.type==='Screening call'||note.note_group==='Interview notes';
 const transition=note.type==='Stage update'||!!(note.from_stage_id&&note.to_stage_id&&note.from_stage_id!==note.to_stage_id);
 if(note.type==='Assessment link')return false;
 return group==='Interview notes'?interview:group==='Stage updates'?transition:!interview&&!transition;
}
export function candidateEngagementState(mapping:R,journey?:R){
 if(!journey){
  if(mapping.status==='Approved')return {label:'Not started',detail:'Sourcing approved · engagement handoff pending',tone:'neutral'};
  if(mapping.status==='Rejected')return {label:'Not started',detail:'Not approved in sourcing',tone:'neutral'};
  return {label:'Not started',detail:'Awaiting sourcing partner approval',tone:'neutral'};
 }
 if(!journey.approved)return {label:'Paused',detail:'Sourcing review reopened · awaiting sourcing partner approval',tone:'amber'};
 const tone=journey.funnel_group==='Placed'?'green':journey.funnel_group==='Exited'?'muted':'blue';
 return {label:journey.stage,detail:journey.search_closed?'Search is closed to further outreach':'',tone};
}
