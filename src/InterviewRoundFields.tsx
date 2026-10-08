import React from 'react';
import {interviewStatuses,interviewOutcomes} from './interviews';
type R=Record<string,any>;
export function InterviewRoundFields({round,onChange}:{round:R;onChange:(patch:R)=>void}){
 return <><div className="interview-round-fields"><label>Interview status<select value={round.status} onChange={e=>onChange({status:e.target.value,...(e.target.value!=='Completed'?{outcome:'Pending'}:{}),...(e.target.value!=='Cancelled'?{cancelled_on:''}:{})})}>{interviewStatuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Interview date<input type="date" value={round.date||''} required={['Scheduled','Rescheduled','Completed'].includes(round.status)} onChange={e=>onChange({date:e.target.value})}/></label>{round.status==='Cancelled'&&<label>Date cancelled<input type="date" required value={round.cancelled_on||''} onChange={e=>onChange({cancelled_on:e.target.value})}/></label>}{round.status==='Completed'&&<label>Interview outcome<select value={round.outcome} onChange={e=>onChange({outcome:e.target.value})}>{interviewOutcomes.map(s=><option key={s}>{s}</option>)}</select></label>}</div></>;
}
