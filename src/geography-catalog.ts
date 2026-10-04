export type LocationEntry=[label:string,search:string,name:string,kind:'city'|'state',abbreviation?:string];
export type LocationIndex={states:LocationEntry[];shards:string[];cities:number;source:string};
export const locationText=(v:string)=>v.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export const locationShard=(v:string)=>Array.from(locationText(v).slice(0,2)).map(c=>c.codePointAt(0)!.toString(16)).join('-');
export function matchingLocations(entries:LocationEntry[],query:string){
 const q=locationText(query),terms=q.split(' ');
 return entries.filter(e=>(e[2].startsWith(terms[0])||e[4]===q)&&terms.every(t=>e[1].includes(t))).sort((a,b)=>{
  const score=(e:LocationEntry)=>e[2]===q?0:e[1].split(' ').includes(q)?1:e[2].startsWith(q)?2:3;
  return score(a)-score(b)||a[0].localeCompare(b[0]);
 }).map(e=>e[0]);
}
