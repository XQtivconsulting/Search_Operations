import React,{useEffect,useState} from 'react';
import {StrategyCriteriaEditor} from './StrategyEvidence';
type R=Record<string,any>;
export function StrategySetup({data,role,manager,api,reload,onDirty,onNavigate,onClone}:{data:R;role:string;manager:boolean;api:(p:string,b?:unknown)=>Promise<any>;reload:()=>Promise<void>;onDirty:(v:boolean)=>void;onNavigate:(tab:string)=>void;onClone:()=>void}){
 const records:R[]=data.research?.records||[],doc=records.find(r=>r.kind==='strategy'&&r.role_id===role);
 const canEdit=manager||records.some(t=>t.kind==='task'&&t.role_id===role&&t.owner_id===data.actor.id&&t.status!=='Cancelled'&&t.task_type==='Search strategy');
 const [content,setContent]=useState(doc?.draft||''),[criteria,setCriteria]=useState<R[]>(doc?.criteria||[]),[editing,setEditing]=useState(!doc),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [cutover,setCutover]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date()));
 const dirty=content!==(doc?.draft||'')||JSON.stringify(criteria)!==JSON.stringify(doc?.criteria||[]);
 useEffect(()=>{setContent(doc?.draft||'');setCriteria(doc?.criteria||[]);setEditing(!doc);},[role,doc?.version]);
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty]);
 async function save(action:string){setBusy(true);setError('');try{await api('research',{action,role_id:role,id:doc?.id,version:doc?.version,content,criteria,cutover});await reload();setEditing(false);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 const targets=records.filter(r=>r.kind==='target'&&r.role_id===role);
 return <section className="panel strategy-setup"><div className="section-head"><div><h2>Search strategy</h2><p>Start with where and how you will find candidates. A company and a keyword search are enough for a first strategy.</p></div><strong>{doc?.status||'Not created'}</strong></div>
 <div className="strategy-steps"><span>1. Save a strategy</span><span>2. Approve for team submissions</span><span>3. Map and review candidates</span></div>
 {canEdit&&editing?<><label>Search approach<textarea required value={content} onChange={e=>setContent(e.target.value)} placeholder="For example: Search Example Company for sales leaders using the keywords enterprise sales and life sciences. Start in the US."/></label><details open={criteria.length>0}><summary>Fit criteria (optional)</summary><StrategyCriteriaEditor value={criteria} onChange={setCriteria}/></details><div className="research-actions"><button className="primary" disabled={busy||!content.trim()||!!doc&&!dirty} onClick={()=>save('strategy-save')}>{busy?'Saving…':'Save draft'}</button>{doc&&<button disabled={busy} onClick={()=>{setContent(doc.draft);setCriteria(doc.criteria||[]);setEditing(false);}}>Discard changes</button>}</div></>:<><p className="document-text">{doc?.draft||'No strategy yet. You can already add candidate drafts and target companies.'}</p>{(doc?.criteria||[]).map((c:R)=><p key={c.id}><strong>{c.label}</strong> · {c.requirement}</p>)}{canEdit&&<button disabled={busy} onClick={()=>setEditing(true)}>{doc?'Edit strategy':'Create strategy'}</button>}</>}
 {doc?.active&&<p className="fine">Approved version {doc.revision} · Candidate tracking from {doc.cutover}. {doc.status==='Draft'?'The previous approved version remains in use until this draft is approved.':''}</p>}
 {doc?.active&&doc.active!==doc.draft&&<details><summary>Current approved strategy</summary><p className="document-text">{doc.active}</p></details>}
 {manager&&doc?.status==='Draft'&&<div className="research-actions">{!doc.cutover&&<label>Candidate tracking start date<input type="date" value={cutover} onChange={e=>setCutover(e.target.value)}/></label>}<button className="primary" disabled={busy||dirty||!doc.cutover&&!cutover} onClick={()=>save('strategy-approve')}>Approve saved strategy</button>{dirty&&<span>Save your changes before approval.</span>}</div>}
 {error&&<p className="error" role="alert">{error}</p>}
 <div className="section-head"><div><h3>{targets.length} target companies</h3><p>Coverage can be set later. Adding a candidate draft automatically adds their current company.</p></div><div className="research-actions"><button disabled={dirty||busy} onClick={()=>onNavigate('Target companies')}>Open target companies</button>{manager&&<button disabled={dirty||busy} onClick={onClone}>Clone target companies</button>}<button disabled={dirty||busy} onClick={()=>onNavigate('Candidate mappings')}>Open candidates</button></div></div>
 </section>;
}
