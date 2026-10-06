import {addDays,weekStart} from './planning';
export const reportingPeriods=[['today','Today'],['week','This week'],['month','This month'],['lastMonth','Last month'],['quarter','This quarter'],['lastQuarter','Last quarter'],['custom','Custom'],['year','This year']] as const;
export const isReportingPeriod=(value:string)=>reportingPeriods.some(([key])=>key===value);
/** Fiscal year April–March. Current periods stop today; completed periods include their full end date. */
export function reportingRange(period:string,today:string,from='',to=''){
 const [year,month]=today.split('-').map(Number);
 const start=(y:number,m:number)=>new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
 const quarterMonth=Math.floor((month-1)/3)*3;
 if(period==='week')return {from:weekStart(today),to:today};
 if(period==='month')return {from:start(year,month-1),to:today};
 if(period==='lastMonth')return {from:start(year,month-2),to:addDays(start(year,month-1),-1)};
 if(period==='quarter')return {from:start(year,quarterMonth),to:today};
 if(period==='lastQuarter')return {from:start(year,quarterMonth-3),to:addDays(start(year,quarterMonth),-1)};
 if(period==='year')return {from:start(month>=4?year:year-1,3),to:today};
 if(period==='custom'){const end=to&&to<today?to:today;return {from:from&&from<=end?from:end,to:end};}
 return {from:today,to:today};
}
