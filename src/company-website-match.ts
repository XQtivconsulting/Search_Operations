type R=Record<string,any>;
export const websiteNameKey=(name:string)=>name.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');
export function exactCompanyWebsite(name:string,rows:R[]):R|undefined{
 const matches=rows.filter(r=>websiteNameKey(r.name||'')===websiteNameKey(name));
 if(matches.length!==1)return;
 try{const url=new URL(matches[0].website);if(url.protocol==='https:'&&!url.username&&!url.password)return matches[0];}catch{}
}
