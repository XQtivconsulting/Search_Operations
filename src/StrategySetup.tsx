import React,{useEffect,useState} from 'react';
import {PencilSimple} from '@phosphor-icons/react';
import {StrategyCriteriaEditor} from './StrategyEvidence';
import {criterionWeights} from './fit-score';
import {displayDate} from './dates';
type R=Record<string,any>;
export function StrategySetup({data,role,manager,api,reload,onDirty,onNavigate,onClone}:{data:R;role:string;manager:boolean;api:(p:string,b?:unknown)=>Promise<any>;reload:()=>Promise<void>;onDirty:(v:boolean)=>void;onNavigate:(tab:string)=>void;onClone:()=>void}){
 const records:R[]=data.research?.records||[],doc=records.find(r=>r.kind==='strategy'&&r.role_id===role);
 const canEdit=manager||records.some(t=>t.kind==='task'&&t.role_id===role&&t.owner_id===data.actor.id&&t.status!=='Cancelled'&&t.task_type==='Search strategy');
 const [content,setContent]=useState(doc?.draft||''),[criteria,setCriteria]=useState<R[]>(doc?.criteria||[]),[editing,setEditing]=useState(!doc),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [cutover,setCutover]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date()));
 const dirty=content!==(doc?.draft||'')||JSON.stringify(criteria)!==JSON.stringify(doc?.criteria||[]);
 useEffect(()=>{setContent(doc?.draft||'');setCriteria(doc?.criteria||[]);setEditing(!doc);},[role,doc?.version]);
 useEffect(()=>{onDirty(dirty||busy);return()=>onDirty(false);},[dirty,busy]);
 async function save(action:string){setBusy(true);setError('');try{await api('research',{action,role_id:role,id:doc?.id,version:doc?.version,content,criteria,cutover});await reload();setEditing(false);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 const targets=records.filter(r=>r.kind==='target'&&r.role_id===role),weights=criterionWeights(doc?.criteria||[]),editMode=canEdit&&editing;
 const changedApproved=doc?.active&&(doc.active!==doc.draft||JSON.stringify(doc.active_criteria||[])!==JSON.stringify(doc.criteria||[]));
 return <section className="panel strategy-setup strategy-workspace">
 <div className="strategy-heading"><div><div className="strategy-title"><h2>Search strategy</h2><span className={'strategy-status '+(doc?.status==='Approved'?'approved':'')}>{dirty?'Unsaved changes':doc?.status||'Not created'}</span></div>{doc?.active&&<p className="fine">Approved v{doc.revision}{doc.cutover?' · Tracking from '+displayDate(doc.cutover):''}{doc.status==='Draft'?' · Approved version remains active':''}</p>}</div>
 <div className="strategy-buttons">{canEdit&&(editMode?<><button disabled={busy} onClick={()=>{setContent(doc?.draft||'');setCriteria(doc?.criteria||[]);setEditing(false);setError('')}}>Cancel</button><button className="primary" disabled={busy||!content.trim()||!!doc&&!dirty} onClick={()=>save('strategy-save')}>{busy?'Saving…':'Save draft'}</button></>:<button className="primary" disabled={busy} onClick={()=>setEditing(true)}><PencilSimple size={17}/>{doc?'Edit strategy':'Create strategy'}</button>)}</div></div>
 {error&&<p className="error" role="alert">{error}</p>}
 <div className="strategy-section">{editMode?<label>Search approach<textarea rows={5} required disabled={busy} value={content} onChange={e=>setContent(e.target.value)} placeholder="Search approach, target profiles and priorities"/></label>:<><h3>Search approach</h3><p className="document-text">{doc?.draft||'No search strategy yet.'}</p></>}</div>
 <div className="strategy-section">{editMode?<fieldset disabled={busy} className="strategy-criteria-fieldset"><StrategyCriteriaEditor value={criteria} onChange={setCriteria}/></fieldset>:<><h3>Fit criteria <span className="fine">({(doc?.criteria||[]).length})</span></h3>{doc?.criteria?.length?<div className="table-scroll"><table className="sheet-table strategy-criteria-table"><thead><tr><th>Criterion</th><th>Requirement</th><th>Weight</th></tr></thead><tbody>{doc.criteria.map((c:R,i:number)=><tr key={c.id}><td><strong>{c.label}</strong></td><td>{c.requirement||'—'}</td><td>{Number(weights[i].toFixed(2))}%</td></tr>)}</tbody></table></div>:<p className="fine">No fit criteria added.</p>}</>}</div>
 {manager&&doc?.status==='Draft'&&!editMode&&<div className="strategy-approval">{!doc.cutover&&<label>Candidate tracking start date<input type="date" value={cutover} disabled={busy} onChange={e=>setCutover(e.target.value)}/></label>}<button className="primary" disabled={busy||dirty||!doc.cutover&&!cutover} onClick={()=>save('strategy-approve')}>Approve strategy</button></div>}
 {changedApproved&&<details className="strategy-approved"><summary>View approved version</summary><p className="document-text">{doc.active}</p>{(doc.active_criteria||[]).map((c:R)=><p key={c.id}><strong>{c.label}</strong>{c.requirement?' · '+c.requirement:''}</p>)}</details>}
 <div className="strategy-footer"><button disabled={dirty||busy} onClick={()=>onNavigate('Target companies')}>Target companies · {targets.length}</button>{manager&&<button disabled={dirty||busy} onClick={onClone}>Clone from another search</button>}</div>
 </section>;
}
