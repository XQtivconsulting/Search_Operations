export function hoursPerPersonDay(data:any):number{const n=Number(data.sourcingSettings?.hoursPerDay??8);return Number.isFinite(n)&&n>0&&n<=24?n:8;}
export const defaultSourcingSettings={hoursPerDay:8,version:0};
