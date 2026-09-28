import {day} from './domain';
export function weekStart(value:string):string {
  const d=new Date(day(value)+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
  return d.toISOString().slice(0,10);
}
export function addDays(value:string,n:number):string {
  const d=new Date(day(value)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}
export const weekDays=(value:string)=>Array.from({length:7},(_,i)=>addDays(weekStart(value),i));
