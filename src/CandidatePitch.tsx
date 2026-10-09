import React,{useEffect,useState} from 'react';
import {displayDateTime} from './dates';
type R=Record<string,any>;
export function CandidatePitch({data,role,api,reload,onDirty}:{data:R;role:string;api:(p:string,b?:unknown)=>Promise<any>;reload:()=>Promise<void>;onDirty:(v:boolean)=>void}){
 const doc=(data.research?.records||[]).find((r:R)=>r.kind==='pitch'&&r.role_id===role);
 const [draft,setDraft]=useState<{id?:string;version?:number;content:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{onDirty(!!draft);return()=>onDirty(false)},[!!draft]);
 const history=(data.research?.events||[]).filter((e:R)=>e.record_id===doc?.id&&e.action==='pitch-save').sort((a:R,b:R)=>String(b.created_at).localeCompare(String(a.created_at)));
 const edit=()=>{setDraft({id:doc?.id,version:doc?.version,content:doc?.content||''});setError('');setNotice('')};
 return <section className="panel candidate-pitch"><div className="section-head"><div><h2>Pitch</h2></div>{!draft&&<button className="primary" onClick={edit}>{doc?.content?'Edit pitch':'Add pitch'}</button>}</div>
 {doc?.updated_at&&<p className="fine">Last edited by {doc.updated_name||'Workspace member'} · {displayDateTime(doc.updated_at)}</p>}
 {draft?<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setNotice('');try{await api('research',{action:'pitch-save',role_id:role,...draft});await reload();setDraft(null);setNotice('Pitch saved.')}catch(e:any){setError(e.message)}finally{setBusy(false)}}}><label>Pitch text<textarea rows={14} maxLength={20000} disabled={busy} value={draft.content} onChange={e=>setDraft({...draft,content:e.target.value})} placeholder="Describe the opportunity, why it is compelling, the impact of the role, and the talking points to use with candidates."/></label><p className="fine">{draft.content.length.toLocaleString()} / 20,000 characters · Internal working text</p><div className="row-actions"><button className="primary" disabled={busy}>{busy?'Saving…':'Save pitch'}</button><button type="button" disabled={busy} onClick={()=>{if(draft.content===(doc?.content||'')||confirm('Discard unsaved pitch changes?')){setDraft(null);setError('')}}}>Cancel</button></div></form>:doc?.content?<div className="document-text" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:'16px 0'}}>{doc.content}</div>:<p className="sheet-empty">No pitch yet. Add the talking points the team should use when approaching candidates.</p>}
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="fine" role="status">{notice}</p>}
 {!!history.length&&<details className="mapping-history"><summary>Edit history ({history.length})</summary>{history.map((e:R)=><article key={e.id}><strong>{e.data.after?.updated_name||'Workspace member'} · {displayDateTime(e.created_at)}</strong><details><summary>View saved pitch</summary><p className="document-text" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{e.data.after?.content||'Pitch cleared'}</p></details></article>)}</details>}
 </section>;
}
