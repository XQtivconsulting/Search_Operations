import React,{useEffect,useRef,useState} from 'react';
import {SearchPicker} from './SearchPicker';
import {displayDateTime} from './dates';
type R=Record<string,any>;
export function CRMCandidateImport({searches,api,reload}:{searches:R[];api:(p:string,b?:unknown)=>Promise<any>;reload:()=>Promise<void>}){
 const [search,setSearch]=useState(''),[preview,setPreview]=useState<R|null>(null),[runs,setRuns]=useState<R[]>([]),[stages,setStages]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(0);
 const stopped=useRef(false);useEffect(()=>{stopped.current=false;api('crm/candidates/list',{}).then(setRuns).catch(e=>setError(e.message));return()=>{stopped.current=true;};},[]);
 const accept=(p:R)=>{setPreview(p);setStages(p.stage_map||Object.fromEntries(p.stages.map((s:R)=>[s.id,s.target])));setPage(0);};
 async function run(mode:'start'|'fetch'|'apply'|'open',id?:string){
  stopped.current=false;setBusy(true);setError('');let p=preview;
  try{
   if(mode==='start'){p=await api('crm/candidates/start',{search_id:search});accept(p!);}
   if(mode==='open'){p=await api('crm/candidates/preview',{id});setSearch(p!.search_id);accept(p!);}
   if(mode==='start'||mode==='fetch')while(p?.status==='Fetching'&&!stopped.current){p=await api('crm/candidates/fetch-next',{id:p.id});setPreview(p);setStages(Object.fromEntries(p!.stages.map((s:R)=>[s.id,s.target])));}
   if(mode==='apply'){while(p&&p.status!=='Completed'&&!stopped.current){p=await api('crm/candidates/apply-next',{id:p.id,stages});setPreview(p);}await reload();}
   if(!stopped.current)setRuns(await api('crm/candidates/list',{}));
  }catch(e:any){setError(e.message);if(p?.id){try{const latest=await api('crm/candidates/preview',{id:p.id});setPreview(latest);}catch{}}}
  finally{setBusy(false);}
 }
 const ready=preview?.status==='Ready',applying=preview?.status==='Importing',complete=preview?.status==='Completed';
 const conflicts=preview?.items.filter((i:R)=>i.conflict).length||0,allMapped=preview?.stages.every((s:R)=>stages[s.id]);
 return <section className="crm-conversion"><div className="section-head"><div><h2>Import candidates by search</h2><p>Preview one RecruitCRM job, confirm its hiring stages, then import candidates, notes and hiring history.</p></div></div>
 <div className="sheet-toolbar"><SearchPicker searches={searches.filter(s=>s.external_id)} value={search} onChange={id=>{setSearch(id);setPreview(null);setError('');}} disabled={busy}/><button className="primary" disabled={busy||!search} onClick={()=>run('start')}>Fetch candidate preview</button>{busy&&<button onClick={()=>{stopped.current=true;}}>Pause after current candidate</button>}</div>
 <p className="fine">Add the job to Search Repository first. Refresh RecruitCRM jobs once if its source identifier is missing. This is a one-way import into this app; RecruitCRM is unchanged.</p>
 {!!runs.length&&<label>Recent previews / resume<select disabled={busy} value={preview?.id||''} onChange={e=>{if(e.target.value)run('open',e.target.value);}}><option value="">Choose a previous preview</option>{runs.map(r=><option key={r.id} value={r.id}>{searches.find(s=>s.id===r.search_id)?.title||'Search'} · {r.status} · {displayDateTime(r.created_at)}</option>)}</select></label>}
 {error&&<p className="error" role="alert">{error}</p>}
 {preview&&<>{preview.authorWarning&&<p className="notice">{preview.authorWarning}</p>}<p role="status" className="notice">{preview.status} · {preview.loaded} / {preview.total} candidates fetched · {preview.applied} imported{conflicts?` · ${conflicts} identity conflicts`:''}</p>
 <p className="fine">Existing populated profile fields and local sourcing/pipeline progress are retained. Missing contact fields are filled. Repeated notes and transitions are not duplicated. Imported mappings are historical, with no invented partner approval or researcher credit. Missing historical dates remain unknown.</p>
 {(ready||applying||complete)&&<><h3>Confirm hiring stage matches</h3><div className="sheet-scroll"><table className="sheet-table"><thead><tr><th>RecruitCRM stage</th><th>Engagement stage in this app</th></tr></thead><tbody>{preview.stages.map((s:R)=><tr key={s.id}><td>{s.label}<small>CRM stage ID {s.id}</small></td><td><select aria-label={'Map '+s.label} disabled={busy||!ready} value={stages[s.id]||''} onChange={e=>setStages({...stages,[s.id]:e.target.value})}><option value="">Choose matching stage</option>{preview.pipeline.map((t:R)=><option key={t.id} value={t.id}>{t.group} · {t.label}</option>)}</select></td></tr>)}</tbody></table></div></>}
 <div className="sheet-scroll"><table className="sheet-table"><thead><tr><th>Candidate</th><th>CRM stage</th><th>Match / outcome</th><th>Notes</th><th>History</th></tr></thead><tbody>{preview.items.slice(page*25,(page+1)*25).map((i:R)=><tr key={i.slug}><td>{i.name}<small>{i.slug}</small></td><td>{i.stage}</td><td>{i.conflict||i.match}{i.retained&&<small>Existing mapping and pipeline retained</small>}{i.result&&<small>Imported · {i.result.notes} new notes · {i.result.history} new history entries</small>}</td><td>{i.ready?i.notes:'Pending'}</td><td>{i.ready?i.history:'Pending'}</td></tr>)}</tbody></table></div>
 <div className="row-actions"><button disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page+1} of {Math.max(1,Math.ceil(preview.total/25))}</span><button disabled={(page+1)*25>=preview.total} onClick={()=>setPage(page+1)}>Next</button>{preview.status==='Fetching'&&<button disabled={busy} onClick={()=>run('fetch')}>Resume fetching</button>}{(ready||applying)&&<button className="primary" disabled={busy||!preview.total||!!conflicts||!allMapped} onClick={()=>run('apply')}>{applying?'Resume import':'Import this search’s '+preview.total+' candidates'}</button>}</div>
 <p className="fine">Scope: currently assigned candidates, candidate notes and this job’s hiring-stage history exposed by RecruitCRM. Unassigned past candidates, email threads, call recordings and file downloads require separate conversion support.</p></>}
 </section>;
}
