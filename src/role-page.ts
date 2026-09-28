import {text,safeLink,requireThat} from './domain';
export type PageSection={heading:string;body:string};
export type RolePage={subtitle:string;location:string;reports_to:string;team:string;mandate:string;partner_name:string;partner_note:string;video:string;booking_url:string;sections:PageSection[];source_name:string};
export function videoEmbed(raw:string){if(!raw)return '';let u:URL;try{u=new URL(raw);}catch{return '';}
 if(u.protocol!=='https:'||u.username||u.password)return '';
 if(['www.youtube.com','youtube.com','youtu.be','www.youtube-nocookie.com'].includes(u.hostname)){const id=u.hostname==='youtu.be'?u.pathname.slice(1):u.pathname.startsWith('/embed/')?u.pathname.split('/')[2]:u.searchParams.get('v');return id&&/^[\w-]{11}$/.test(id)?'https://www.youtube-nocookie.com/embed/'+id:'';}
 if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(u.hostname)){const id=u.pathname.split('/').filter(Boolean).pop();const h=u.searchParams.get('h');return id&&/^\d+$/.test(id)?'https://player.vimeo.com/video/'+id+(h&&/^[a-f0-9]+$/.test(h)?'?h='+h:''):'';}
 return '';
}
export function cleanRolePage(b:any):RolePage {const sections=b?.sections;requireThat(Array.isArray(sections)&&sections.length>0&&sections.length<=60,'Add 1–60 page sections.');requireThat(JSON.stringify(sections).length<=80000,'Keep the page under 80,000 characters.');const video=safeLink(b.video);requireThat(!video||videoEmbed(video),'Use a YouTube or Vimeo video link.');return {subtitle:text(b.subtitle,500),location:text(b.location,300),reports_to:text(b.reports_to,300),team:text(b.team,300),mandate:text(b.mandate,500),partner_name:text(b.partner_name,200),partner_note:text(b.partner_note,5000),video,booking_url:safeLink(b.booking_url),source_name:text(b.source_name,200),sections:sections.map((s:any)=>{requireThat(text(s.heading,200)&&text(s.body,20000),'Each section needs a heading and content.');requireThat(String(s.body).length<=20000,'Split long sections into smaller sections.');return {heading:text(s.heading,200),body:text(s.body,20000)};})};}
export function sectionsFromText(value:string):PageSection[]{
 const chunks=value.replace(/\r/g,'').split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean),sections:PageSection[]=[];
 let heading='The opportunity',body:string[]=[];
 const looksLikeHeading=(s:string)=>s.length<=100&&!s.includes('\n')&&!/[.!?]$/.test(s);
 const flush=()=>{if(body.length){sections.push({heading,body:body.join('\n\n')});body=[];}};
 chunks.forEach((chunk,i)=>{if(looksLikeHeading(chunk)&&chunks[i+1]&&!looksLikeHeading(chunks[i+1])){flush();heading=chunk.replace(/^#+\s*/,'');}else body.push(chunk);});
 flush();return sections.length?sections:[{heading:'The opportunity',body:value.trim()}];
}
