import {displayDate} from './dates';
export function submissionReadiness(strategy:any,today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date())){
 if(!strategy?.active||!strategy?.cutover)return 'This search needs an approved search strategy before mappings can be submitted. Ask the engagement partner or planner to approve it in Search repository → Search strategy. Your mapping can remain saved as a draft.';
 if(today<strategy.cutover)return 'Candidate submissions open on '+displayDate(strategy.cutover)+'. You can save this mapping as a draft until then.';
 return '';
}
