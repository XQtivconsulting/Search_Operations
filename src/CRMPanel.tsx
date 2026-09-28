import React, {useEffect,useState} from 'react';
export function CRMPanel({searches,api,reload}:{searches:any[];api:(path:string,body?:unknown)=>Promise<any>;reload:()=>Promise<void>}) {
  const [state,setState]=useState<any>(null),[selected,setSelected]=useState<Set<string>>(new Set()),[clients,setClients]=useState<Record<string,string>>({});
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [sort,setSort]=useState({key:'title',direction:1});
  const clientName=(j:any)=>j.company_name || searches.find(s=>s.external_id===j.external_id)?.client || clients[j.external_id] || '';
  const value=(j:any,key:string)=>key==='client'?clientName(j):key==='selected'?Number(selected.has(j.external_id)):j[key];
  const rows=[...(state?.jobs || [])].sort((a:any,b:any)=>String(value(a,sort.key) ?? '').localeCompare(String(value(b,sort.key) ?? ''),undefined,{numeric:true,sensitivity:'base'})*sort.direction);
  const heading=(key:string,label:string)=><th aria-sort={sort.key===key?(sort.direction===1?'ascending':'descending'):'none'}><button className="sort-heading" onClick={()=>setSort({key,direction:sort.key===key?-sort.direction:1})}>{label} <span aria-hidden="true">{sort.key===key?(sort.direction===1?'↑':'↓'):'↕'}</span></button></th>;
  const load=async()=>setState(await api('crm/status'));
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  async function fetchPreview() {
    setBusy(true);setError('');setNotice('');
    try{await api('crm/fetch',{});setSelected(new Set());setClients({});await load();setNotice('Jobs fetched. Review and select the changes to apply.');}catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function apply() {
    setBusy(true);setError('');setNotice('');
    try{
      const jobs=state.jobs.filter((j:any)=>selected.has(j.external_id)).map((j:any)=>{
        const s=searches.find(s=>s.external_id===j.external_id);
        return {external_id:j.external_id,fetched_at:j.fetched_at,search_id:s?.id,version:s?.version,client:clients[j.external_id]};
      });
      const result=await api('crm/apply',{jobs});setSelected(new Set());await reload();await load();setNotice(`${result.count} searches updated. Sourcing output and planning history are preserved.`);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="panel crm-panel"><div className="section-head"><div><h2>RecruitCRM</h2><p>Fetch jobs, review matches, then apply selected changes.</p></div><button className="primary" disabled={!state?.configured||busy} onClick={fetchPreview}>{busy?'Working…':'Fetch job preview'}</button></div>
    {state&&!state.configured&&<p className="source-note">Not connected. Your administrator needs to configure the workspace’s RecruitCRM API token on the server.</p>}
    <p className="fine">RecruitCRM owns job titles, company names and status. This workspace owns weekly plans, targets, mappings and internal approvals. Outreach remains in RecruitCRM.</p>
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    {!!state?.jobs.length&&<><div className="sheet-toolbar"><button disabled={!selected.size||selected.size>200||busy} onClick={apply}>Apply {selected.size} selected</button><span className="fine">Up to 200 per batch. Client names come from RecruitCRM companies. Enter a name only when missing.</span></div><div className="sheet-scroll"><table className="sheet-table"><thead><tr>{heading('selected','Select')}{heading('external_id','CRM ID')}{heading('title','Job title')}{heading('status','Status')}{heading('client','Client name')}</tr></thead><tbody>{rows.map((j:any)=>{
      const matches=searches.filter(s=>s.external_id===j.external_id),s=matches[0];return <tr key={j.external_id}><td><input type="checkbox" aria-label={`Select ${j.title}`} disabled={busy||matches.length>1} checked={selected.has(j.external_id)} onChange={e=>{const n=new Set(selected);e.target.checked?n.add(j.external_id):n.delete(j.external_id);setSelected(n);}}/></td><td>{j.external_id}</td><td>{j.title}{s&&s.title!==j.title&&<small>Was: {s.title}</small>}</td><td>{j.status}{s&&s.status!==j.status&&<small>Was: {s.status}</small>}</td><td>{matches.length>1?'Duplicate CRM ID — reconcile first':j.company_name?<>{j.company_name}{s&&s.client!==j.company_name&&<small>Was: {s.client}</small>}</>:s?s.client:<input aria-label={`Client for ${j.title}`} placeholder="Enter client name" value={clients[j.external_id]||''} onChange={e=>setClients({...clients,[j.external_id]:e.target.value})}/>}</td></tr>;
    })}</tbody></table></div></>}
    {state&&<p className="fine">Latest activity: {state.runs[0]?`${state.runs[0].status} ${state.runs[0].count} jobs at ${state.runs[0].created_at}`:'No synchronization yet'}</p>}
  </section>;
}
