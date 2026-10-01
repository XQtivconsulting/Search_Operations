/** Extractive, local-only summary. Every excerpt is copied from the supplied transcript. */
export function summarizeTranscript(source:string):string[]{
 const chunks=String(source||'').split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map(s=>s.trim()).filter(s=>s.length>=24);
 if(!chunks.length)return source.trim()?[source.trim().slice(0,480)]:[];
 const words=(s:string)=>s.toLowerCase().match(/[a-z]{4,}/g)||[];
 const stop=new Set(['that','this','with','have','from','they','there','would','could','about','what','your','just','really','were','been','will','yeah','okay','thanks','thank']);
 const freq=new Map<string,number>();for(const c of chunks)for(const w of new Set(words(c)))if(!stop.has(w))freq.set(w,(freq.get(w)||0)+1);
 const ranked=chunks.map((text,index)=>({text,index,score:[...new Set(words(text))].reduce((n,w)=>n+(stop.has(w)?0:Math.min(freq.get(w)||0,5)),0)/Math.sqrt(Math.max(words(text).length,1))})).sort((a,b)=>b.score-a.score||a.index-b.index);
 const selected:typeof ranked=[];const seen=new Set<string>();for(const row of ranked){const key=row.text.toLowerCase();if(seen.has(key))continue;seen.add(key);selected.push(row);if(selected.length===5)break;}
 return selected.sort((a,b)=>a.index-b.index).map(r=>r.text.length>480?r.text.slice(0,480)+'…':r.text);
}
