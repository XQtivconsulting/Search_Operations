import {requireThat,text} from './domain';
export type Criterion={id:string;label:string;requirement:string};
export function cleanCriteria(value:any):Criterion[]{
 requireThat(Array.isArray(value),'Provide a list of strategy criteria.');
 const ids=new Set<string>();return value.map((c:any)=>{const id=text(c.id,100),label=text(c.label,150),requirement=text(c.requirement,1500);requireThat(id&&label&&!ids.has(id),'Each criterion needs a unique ID and a name.');ids.add(id);requireThat(!/\b(age|date of birth|birth year|young|old)\b/i.test(label),'Use job-related experience or qualifications instead of age criteria.');return {id,label,requirement};});
}
export function cleanEvidence(value:any,criteria:Criterion[],required=false){return Object.fromEntries(criteria.map(c=>{const v=value?.[c.id]||{},answer={text:text(v.text,5000),not_applicable:v.not_applicable===true};requireThat(!required||answer.text,`Provide evidence or explain why “${c.label}” is not applicable.`);return [c.id,answer];}));}
