import React,{useEffect,useRef,useState} from 'react';
import {exactCompanyWebsite,websiteNameKey} from './company-website-match';
type R=Record<string,any>;
export function CompanyWebsiteLookup({edit,setEdit,api}:{edit:R;setEdit:React.Dispatch<React.SetStateAction<R|null>>;api:(p:string,b?:unknown)=>Promise<any>}){
 const [matches,setMatches]=useState<R[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const attempted=useRef('');
 useEffect(()=>{
  setBusy(false);setMatches([]);setMessage('');
  const name=String(edit.name||'').trim(),key=websiteNameKey(name);
  if(edit.website||name.length<2||attempted.current===key)return;
  let active=true;const timer=setTimeout(async()=>{
   attempted.current=key;setBusy(true);setMessage('');setMatches([]);
   try{const rows=await api('company-lookup',{name});if(!active)return;const match=exactCompanyWebsite(name,rows);
    if(match){setEdit(previous=>previous&&!previous.website&&websiteNameKey(previous.name||'')===key?{...previous,website:match.website}:previous);setMessage('Website found from public company records. Save company to keep it.');}
    else{setMatches(rows.filter((r:R)=>r.website));setMessage(rows.some((r:R)=>r.website)?'Choose the matching company website.':'No website match found. You can enter it above.');}
   }catch(e:any){if(active)setMessage(e.message||'Website lookup unavailable. You can enter it above.');}finally{if(active)setBusy(false);}
  },600);return()=>{active=false;clearTimeout(timer);};
 },[edit.name,retry]);
 return <div className="company-website-matches">{busy?<p role="status" className="fine">Finding company website…</p>:message&&<p role="status" className="fine">{message}</p>}{!edit.website&&matches.map(c=><article key={c.id}><strong>{c.name}</strong><p className="fine">{c.description}</p><a href={c.website} target="_blank" rel="noreferrer">{c.website}</a> <button type="button" onClick={()=>{setEdit(previous=>previous?{...previous,website:c.website}:previous);setMatches([]);setMessage('Save company to keep this website.');}}>Use website</button></article>)}{!edit.website&&<button type="button" disabled={busy||!edit.name?.trim()} onClick={()=>{attempted.current='';setRetry(v=>v+1);}}>Find website</button>}</div>;
}
