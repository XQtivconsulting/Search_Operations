import {text,safeLink,requireThat} from './domain';
export type PageSection={heading:string;body:string;source_page?:number};
export type RolePage={title?:string;client?:string;origin?:string;source_text?:string;source_hash?:string;source_pages?:number;subtitle:string;location:string;reports_to:string;team:string;mandate:string;partner_name:string;partner_note:string;video:string;booking_url:string;sections:PageSection[];source_name:string};
export function videoEmbed(raw:string){if(!raw)return '';let u:URL;try{u=new URL(raw);}catch{return '';}
 if(u.protocol!=='https:'||u.username||u.password)return '';
 if(['www.youtube.com','youtube.com','youtu.be','www.youtube-nocookie.com'].includes(u.hostname)){const id=u.hostname==='youtu.be'?u.pathname.slice(1):u.pathname.startsWith('/embed/')?u.pathname.split('/')[2]:u.searchParams.get('v');return id&&/^[\w-]{11}$/.test(id)?'https://www.youtube-nocookie.com/embed/'+id:'';}
 if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(u.hostname)){const id=u.pathname.split('/').filter(Boolean).pop();const h=u.searchParams.get('h');return id&&/^\d+$/.test(id)?'https://player.vimeo.com/video/'+id+(h&&/^[a-f0-9]+$/.test(h)?'?h='+h:''):'';}
 return '';
}
const normalized=(v:string)=>v.replace(/\s+/g,' ').trim();
export function cleanRolePage(b:any):RolePage {
 const sections=b?.sections;requireThat(Array.isArray(sections)&&sections.length>0&&sections.length<=120,'Add 1–120 page sections.');requireThat(JSON.stringify(sections).length<=110000,'Keep the page under 80,000 text characters.');
 const video=safeLink(b.video);requireThat(!video||videoEmbed(video),'Use a YouTube or Vimeo video link.');
 const sourceOnly=b.origin==='document',source=String(b.source_text||'');
 if(sourceOnly){requireThat(source.length>0&&source.length<=80000,'The document source is missing or too long. Upload it again.');requireThat(/^[a-f0-9]{64}$/.test(b.source_hash||''),'Upload the source document again.');}
 const checked=(v:any,max:number)=>{const value=String(v||'').trim();requireThat(value.length<=max,'A document field is too long. Split it into smaller sections.');if(sourceOnly&&value)requireThat(value.split(/\n\s*\n/).every(part=>normalized(source).includes(normalized(part))),'Document-only pages can use only wording from the uploaded file. Upload a revised file to change the wording.');return value;};
 return {title:checked(b.title,1000),client:checked(b.client,500),origin:sourceOnly?'document':'manual',source_text:sourceOnly?source:'',source_hash:sourceOnly?b.source_hash:'',source_pages:Number(b.source_pages)||0,
 subtitle:checked(b.subtitle,500),location:checked(b.location,300),reports_to:checked(b.reports_to,300),team:checked(b.team,300),mandate:checked(b.mandate,500),partner_name:checked(b.partner_name,200),partner_note:checked(b.partner_note,5000),video,booking_url:safeLink(b.booking_url),source_name:text(b.source_name,200),
 sections:sections.map((s:any)=>{requireThat(String(s.heading||'').trim()||String(s.body||'').trim()||b.title,'Each section needs content.');return {heading:checked(s.heading,1000),body:checked(s.body,80000),...(s.source_page?{source_page:Number(s.source_page)}:{})};})};
}
export function sectionsFromText(value:string):PageSection[]{
 const chunks=value.replace(/\r/g,'').split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean),sections:PageSection[]=[];
 let heading='The opportunity',body:string[]=[];
 const looksLikeHeading=(s:string)=>s.length<=100&&!s.includes('\n')&&!/[.!?]$/.test(s);
 const flush=()=>{if(body.length){sections.push({heading,body:body.join('\n\n')});body=[];}};
 chunks.forEach((chunk,i)=>{if(looksLikeHeading(chunk)&&chunks[i+1]&&!looksLikeHeading(chunks[i+1])){flush();heading=chunk.replace(/^#+\s*/,'');}else body.push(chunk);});
 flush();return sections.length?sections:[{heading:'The opportunity',body:value.trim()}];
}
