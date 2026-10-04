type Candidate=Record<string,any>;
export function linkedin(value:unknown):string {
 const raw=String(value??'').replace(/[\s\u200B-\u200D\uFEFF]/g,'');
 let u:URL;try{u=new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw)?raw:'https://'+raw);}catch{throw new Error('Enter a LinkedIn profile URL.');}
 if(!['https:','http:'].includes(u.protocol)||!['linkedin.com','www.linkedin.com','m.linkedin.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/in\/[^/]+\/?$/i.test(u.pathname))throw new Error('Use linkedin.com/in/profile.');
 let slug:string;try{slug=decodeURIComponent(u.pathname.split('/')[2]).replace(/[\s\u200B-\u200D\uFEFF]/g,'').toLowerCase();}catch{throw new Error('Enter a valid LinkedIn profile URL.');}
 if(!slug||/[\/\\?#]/.test(slug))throw new Error('Enter a valid LinkedIn profile URL.');
 return 'https://www.linkedin.com/in/'+encodeURIComponent(slug);
}
export function linkedinKey(value:unknown){try{return linkedin(value);}catch{return '';}}
export function sameLinkedin(a:unknown,b:unknown){const key=linkedinKey(a);return !!key&&key===linkedinKey(b);}
const normalized=(s:unknown)=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
function near(a:string,b:string){if(a===b)return true;if(Math.min(a.length,b.length)<4||Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length===b.length&&a[i]===b[j+1]&&a[i+1]===b[j]){i+=2;j+=2;continue;}if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return edits+(a.length-i)+(b.length-j)<=1;}
export function candidateMatches(candidates:Candidate[],form:Candidate){
 const url=linkedinKey(form.url),slug=normalized(url.split('/in/')[1]),first=normalized(form.first_name),last=normalized(form.last_name),full=first+last;
 return candidates.filter(c=>c.id!==form.id).map(candidate=>{const key=linkedinKey(candidate.url),exact=!!url&&key===url;const cf=normalized(candidate.first_name),cl=normalized(candidate.last_name),cn=normalized(candidate.name||cf+cl);const nameMatch=first.length>=2&&last.length>=2&&(near(full,cn)||(near(first,cf)&&near(last,cl)));const urlMatch=slug.length>=4&&near(slug,normalized(key.split('/in/')[1]));return {candidate,exact,reason:exact?'Same LinkedIn account':urlMatch?'Similar LinkedIn account':'Similar name',score:exact?3:urlMatch?2:nameMatch?1:0};}).filter(m=>m.score>0).sort((a,b)=>b.score-a.score||String(a.candidate.name).localeCompare(String(b.candidate.name))).slice(0,6);
}
