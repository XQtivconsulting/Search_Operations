// Layout inference only. All displayed wording is copied from document text.
export type DocumentLine={text:string;x:number;y:number;width:number;size:number;bold:boolean;page:number;heading?:boolean;font?:string;breakBefore?:boolean};
export type DocumentSection={heading:string;body:string;source_page?:number};
const bullet=/^(?:[•●▪◦‣\-–]|\d+[.)])\s+/;
export function pdfLines(items:any[],styles:Record<string,any>,page:number):DocumentLine[]{
 const fragments=items.filter(i=>'str' in i&&i.str.trim()).map(i=>({text:i.str,x:i.transform[4],y:i.transform[5],width:i.width||0,size:Math.abs(i.height)||Math.hypot(i.transform[2],i.transform[3])||12,bold:/bold|black|semibold|demi/i.test(i.fontName+' '+(styles[i.fontName]?.fontFamily||'')),page,font:i.fontName}));
 const lines:DocumentLine[]=[];
 for(const f of fragments.sort((a,b)=>b.y-a.y||a.x-b.x)){
  const prior=[...lines].reverse().find(l=>Math.abs(l.y-f.y)<=Math.max(2,Math.min(l.size,f.size)*.25)&&f.x>=l.x&&f.x-(l.x+l.width)<Math.max(24,f.size*3));
  if(prior){const gap=f.x-(prior.x+prior.width);prior.text+=(gap>f.size*.1&&!/\s$/.test(prior.text)&&!/^\s/.test(f.text)?' ':'')+f.text;prior.width=Math.max(prior.width,f.x+f.width-prior.x);prior.size=Math.max(prior.size,f.size);prior.bold=prior.bold&&f.bold;}
  else lines.push({...f});
 }
 return lines.sort((a,b)=>b.y-a.y||a.x-b.x);
}
function readingOrder(lines:DocumentLine[]):DocumentLine[]{
 // Detect a persistent gutter; full-width headings split vertical bands.
 if(lines.length<8)return lines;
 const left=Math.min(...lines.map(l=>l.x)),right=Math.max(...lines.map(l=>l.x+l.width));
 let split=0,score=0;
 for(let x=left+(right-left)*.3;x<left+(right-left)*.7;x+=10){const a=lines.filter(l=>l.x+l.width<x-6),b=lines.filter(l=>l.x>x+6),cross=lines.length-a.length-b.length;if(a.length>=3&&b.length>=3&&cross<lines.length*.2){const n=Math.min(a.length,b.length)-cross;if(n>score){score=n;split=x;}}}
 if(!split)return lines;
 const labels=lines.filter(l=>l.x<split&&l.x+l.width<split);
 if(labels.length&&labels.filter(l=>/^(?:reports? to|location|company|team|mandate|search led by|employment type|compensation|job title)\s*:?$/i.test(l.text.trim())).length>=labels.length*.6)return lines.map(l=>({...l,breakBefore:l.x<split}));
 const out:DocumentLine[]=[],band:DocumentLine[]=[];
 const flush=()=>{if(!band.length)return;const a=band.filter(l=>l.x<split),b=band.filter(l=>l.x>=split);if(b[0])b[0]={...b[0],breakBefore:true};out.push(...a,...b);band.length=0;};
 for(const line of lines){if(line.x<split&&line.x+line.width>split){flush();out.push(line);}else band.push(line);}flush();return out;
}
export function layoutDocument(input:DocumentLine[]){
 const pages=[...new Set(input.map(l=>l.page))],lines=pages.flatMap(p=>readingOrder(input.filter(l=>l.page===p)));
 if(!lines.length)throw new Error('No selectable text found. Use a text-based PDF or Word document.');
 // Weighted modal font represents body text even on heading-heavy pages.
 const weights=new Map<number,number>();for(const l of lines){const size=Math.round(l.size);weights.set(size,(weights.get(size)||0)+l.text.length);}const bodySize=[...weights].sort((a,b)=>b[1]-a[1])[0][0];
 const first=lines.filter(l=>l.page===pages[0]).slice(0,12);const large=first.filter(l=>l.text.length<220&&!bullet.test(l.text)&&l.size>=bodySize*1.3);const titleLine=large.sort((a,b)=>b.size-a.size)[0]||first.find(l=>l.heading)||first.find(l=>l.text.length<180&&!bullet.test(l.text));
 const titleLines:DocumentLine[]=titleLine?[titleLine]:[];
 if(titleLine){const at=lines.indexOf(titleLine);for(let i=at+1;i<Math.min(at+3,lines.length);i++){const l=lines[i],prior=titleLines[titleLines.length-1];if(l.page===titleLine.page&&Math.abs(l.size-titleLine.size)<.5&&Math.abs(l.x-titleLine.x)<30&&prior.y-l.y>0&&prior.y-l.y<titleLine.size*1.6)titleLines.push(l);else break;}}
 const title=titleLines.map(l=>l.text.trim()).join(' ');
 const titleIndex=titleLine?lines.indexOf(titleLine):0;
 const subtitleLines=titleIndex>0&&titleIndex<=2?lines.slice(0,titleIndex).filter(l=>l.page===titleLine?.page&&l.text.length<120):[];
 const subtitle=subtitleLines.map(l=>l.text.trim()).join(' ');
 const fonts=new Map<string,number>();for(const l of lines)if(l.font)fonts.set(l.font,(fonts.get(l.font)||0)+l.text.length);const bodyFont=[...fonts].sort((a,b)=>b[1]-a[1])[0]?.[0];
 const familiarHeading=/^(?:(?:the |about (?:the )?)?(?:role|company|opportunity|position|team)|(?:role |position |company )?(?:overview|summary|purpose)|(?:key |main |core )?(?:responsibilities|requirements|qualifications|competencies|skills|deliverables)|what (?:you|we) (?:bring|offer|expect|will do)|(?:your |the )?mandate|candidate profile|experience(?: and qualifications)?|interview process|next steps|location|compensation|benefits)\s*:?$/i;
 const sections:DocumentSection[]=[];let heading='',paragraphs:string[]=[],current='',previous:DocumentLine|undefined,sourcePage=1;
 const flushParagraph=()=>{if(current.trim())paragraphs.push(current.trim());current='';};
 const flushSection=()=>{flushParagraph();if(heading||paragraphs.length)sections.push({heading,body:paragraphs.join('\n\n'),source_page:sourcePage});paragraphs=[];heading='';};
 for(const line of lines){if(titleLines.includes(line)||subtitleLines.includes(line)){flushParagraph();previous=line;continue;}const t=line.text.trim();const isHeading=line.heading===true||(!bullet.test(t)&&t.length<160&&(line.size>=bodySize*1.17||line.bold&&line.size>=bodySize*.95||familiarHeading.test(t)||line.font&&bodyFont&&line.font!==bodyFont&&t.length<90&&line.size>=bodySize*.95)&&!/[.;]$/.test(t));
  if(isHeading){flushSection();heading=t;sourcePage=line.page;previous=line;continue;}
  const newBullet=bullet.test(t),lastBullet=!!previous&&bullet.test(previous.text.trim());
  const gap=previous?previous.y-line.y:0;
  const separate=!!previous&&(line.breakBefore||line.page!==previous.page||gap>Math.max(line.size,previous.size)*1.65||line.x<previous.x-16||newBullet||lastBullet&&gap>line.size*1.4);
  if(separate)flushParagraph();
  current+=(current?' ':'')+t;previous=line;
 }
 flushSection();if(!sections.length&&title)sections.push({heading:'',body:''});
 return {title,subtitle,sections,source_text:lines.map(l=>l.text.trim()).join('\n'),source_pages:pages.length};
}
export function freshDocumentPage(document:{title:string;subtitle?:string;sections:DocumentSection[];source_text:string;source_pages:number},name:string,hash:string){
 // Intentionally accepts no previous page, role, client, partner or chat context.
 return {...document,origin:'document',source_name:name,source_hash:hash,client:'',subtitle:document.subtitle||'',location:'',reports_to:'',team:'',mandate:'',partner_name:'',partner_note:'',video:'',booking_url:''};
}
