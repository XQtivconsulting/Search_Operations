export const ageFilters=['Under 30','30–39','40–49','50–59','60+','Not recorded'];
export const genderFilters=['Female','Male','Non-binary','Self-described','Prefer not to say','Not recorded'];
export function matchesAge(age:unknown,filter:string){
 const missing=age===null||age===undefined||age===''||!Number.isFinite(Number(age));
 if(filter==='Not recorded')return missing;if(missing)return false;
 const n=Number(age);return filter==='Under 30'?n<30:filter==='30–39'?n>=30&&n<40:filter==='40–49'?n>=40&&n<50:filter==='50–59'?n>=50&&n<60:filter==='60+'?n>=60:true;
}
