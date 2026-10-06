import {IconAction} from './IconAction';
import {FloppyDisk} from '@phosphor-icons/react';
import {SortableTable} from './SortableTable';
import {CRMCandidateImport} from './CRMCandidateImport';
import React, {useEffect,useState} from 'react';
import {ColumnFilter} from './ColumnFilter';
import {emptyCRMFilters,filterCRMRows,CRMFilters} from './crm-view';
export function CRMPanel({searches,partners,api,reload}:{searches:any[];partners:{id:string;name:string}[];api:(path:string,body?:unknown)=>Promise<any>;reload:()=>Promise<void>}) {
  const [state,setState]=useState<any>(null),[selected,setSelected]=useState<Set<string>>(new Set()),[clients,setClients]=useState<Record<string,string>>({});
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [filters,setFilters]=useState<CRMFilters>(emptyCRMFilters),[owners,setOwners]=useState<Record<string,string>>({});
  const [sort,setSort]=useState({key:'title',direction:1});
  const clientName=(j:any)=>j.company_name || searches.find(s=>s.external_id===j.external_id)?.client || clients[j.external_id] || '';
  const local=(j:any)=>searches.find(s=>s.external_id===j.external_id);
  const partnerName=(j:any)=>local(j)?.partner || j.saved_partner || 'Not assigned';
  const ownerValue=(j:any)=>owners[j.external_id] ?? local(j)?.partner_id ?? j.saved_partner_id ?? '';
  const changeFilter=(patch:Partial<CRMFilters>)=>{setFilters({...filters,...patch});setSelected(new Set());};
  const options=(field:(j:any)=>string)=>[...new Set<string>((state?.jobs || []).map(field))].sort((a,b)=>a.localeCompare(b));
  async function saveOwner(j:any) {
    const s=local(j);setBusy(true);setError('');setNotice('');
    try{await api('mutate',s?{kind:'search-owner',id:s.id,version:s.version,partner_id:ownerValue(j)}:{kind:'crm-owner',external_id:j.external_id,version:j.partner_version,partner_id:ownerValue(j)});await reload();await load();setOwners(v=>{const n={...v};delete n[j.external_id];return n;});setNotice(`Engagement partner saved for ${j.title}.`);}catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  const value=(j:any,key:string)=>key==='client'?clientName(j):key==='partner'?partnerName(j):key==='selected'?Number(selected.has(j.external_id)):j[key];
  const rows=filterCRMRows<any>(state?.jobs || [],filters,clientName,partnerName).sort((a:any,b:any)=>String(value(a,sort.key) ?? '').localeCompare(String(value(b,sort.key) ?? ''),undefined,{numeric:true,sensitivity:'base'})*sort.direction);
  const selectedCount=rows.filter((j:any)=>selected.has(j.external_id)).length;
  const heading=(key:string,label:string)=><th aria-sort={sort.key===key?(sort.direction===1?'ascending':'descending'):'none'}><button className="sort-heading" onClick={()=>setSort({key,direction:sort.key===key?-sort.direction:1})}>{label} <span aria-hidden="true">{sort.key===key?(sort.direction===1?'↑':'↓'):'↕'}</span></button></th>;
  const load=async()=>setState(await api('crm/status'));
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  async function fetchPreview() {
    setBusy(true);setError('');setNotice('');
    try{const result=await api('crm/fetch',{});setSelected(new Set());setClients({});await load();await reload();setNotice(`RecruitCRM refreshed. ${result.updated||0} existing searches updated across the app. Select new searches to add them to the repository.`);}catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  async function apply() {
    setBusy(true);setError('');setNotice('');
    try{
      const jobs=rows.filter((j:any)=>selected.has(j.external_id)).map((j:any)=>{
        const s=searches.find(s=>s.external_id===j.external_id);
        return {external_id:j.external_id,fetched_at:j.fetched_at,search_id:s?.id,version:s?.version,partner_version:j.partner_version,client:clients[j.external_id],...(Object.prototype.hasOwnProperty.call(owners,j.external_id)?{partner_id:owners[j.external_id]}:{})};
      });
      const result=await api('crm/apply',{jobs});setSelected(new Set());setOwners(v=>Object.fromEntries(Object.entries(v).filter(([id])=>!selected.has(id))));await reload();await load();setNotice(`${result.count} searches updated. Sourcing output and planning history are preserved.`);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="panel crm-panel"><div className="section-head"><div><h2>RecruitCRM</h2><p>Refresh updates job titles, client names and statuses for existing searches throughout the app. Select new searches to add them. Engagement partners can be saved independently.</p></div><button className="primary" disabled={!state?.configured||busy} onClick={fetchPreview}>{busy?'Working…':'Refresh from RecruitCRM'}</button></div>
    {state&&!state.configured&&<p className="source-note">Not connected. Your administrator needs to configure the workspace’s RecruitCRM API token on the server.</p>}
    <p className="fine">RecruitCRM owns job titles, company names and status. This workspace owns weekly plans, targets, mappings and internal approvals. Candidate history can be imported one search at a time below.</p>
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    {!!state?.jobs.length&&<><div className="sheet-toolbar"><button disabled={!selectedCount||selectedCount>200||busy} onClick={apply}>Add / update {selectedCount} selected in repository</button><button disabled={busy||!rows.length} onClick={()=>setSelected(new Set(rows.filter((j:any)=>searches.filter(s=>s.external_id===j.external_id).length<=1).slice(0,200).map((j:any)=>j.external_id)))}>{rows.length>200?'Select first 200 shown':'Select shown'}</button><button onClick={()=>{setFilters(emptyCRMFilters());setSelected(new Set());}} disabled={busy}>Clear filters</button><span className="fine">Showing {rows.length} of {state.jobs.length} jobs. Filters clear row selection. Up to 200 per import.</span></div><div className="sheet-scroll"><SortableTable stateKey="CRMPanel.table1" className="sheet-table"><thead><tr>{heading('selected','Add / update')}{heading('external_id','CRM ID')}{heading('title','Job title')}{heading('status','Status')}{heading('client','Client name')}{heading('partner','Engagement partner')}</tr><tr className="column-filters"><th></th><th><input aria-label="Filter CRM ID" placeholder="Contains…" value={filters.id} onChange={e=>changeFilter({id:e.target.value})}/></th><th><input aria-label="Filter job title" placeholder="Contains…" value={filters.title} onChange={e=>changeFilter({title:e.target.value})}/></th><th><ColumnFilter label="statuses" options={options(j=>j.status)} selected={filters.statuses} onChange={statuses=>changeFilter({statuses})}/></th><th><ColumnFilter label="companies" options={options(clientName)} selected={filters.companies} onChange={companies=>changeFilter({companies})}/></th><th><ColumnFilter label="partners" options={options(partnerName)} selected={filters.partners} onChange={partners=>changeFilter({partners})}/></th></tr></thead><tbody>{rows.map((j:any)=>{
      const matches=searches.filter(s=>s.external_id===j.external_id),s=matches[0];return <tr key={j.external_id}><td><input type="checkbox" aria-label={`Select ${j.title}`} disabled={busy||matches.length>1} checked={selected.has(j.external_id)} onChange={e=>{const n=new Set(selected);e.target.checked?n.add(j.external_id):n.delete(j.external_id);setSelected(n);}}/></td><td>{j.external_id}</td><td>{j.title}<small>{s?'In Search Repository':'Not added to repository'}</small>{s&&s.title!==j.title&&<small>Was: {s.title}</small>}</td><td>{j.status}{s&&s.status!==j.status&&<small>Was: {s.status}</small>}</td><td>{matches.length>1?'Duplicate CRM ID — reconcile first':j.company_name?<>{j.company_name}{s&&s.client!==j.company_name&&<small>Was: {s.client}</small>}</>:s?s.client:<input aria-label={`Client for ${j.title}`} placeholder="Enter client name" value={clients[j.external_id]||''} onChange={e=>setClients({...clients,[j.external_id]:e.target.value})}/>}</td><td className="partner-cell">{s&&((s.partner&&!s.partner_id)||Object.prototype.hasOwnProperty.call(owners,j.external_id))&&<small>Current: {s.partner || 'Not assigned'}</small>}<div className="partner-controls"><select aria-label={`Engagement partner for ${j.title} (${j.external_id})`} disabled={busy||matches.length>1} value={ownerValue(j)} onChange={e=>setOwners({...owners,[j.external_id]:e.target.value})}><option value="">Not assigned</option>{s?.partner_id&&!partners.some(p=>p.id===s.partner_id)&&<option value={s.partner_id} disabled>{s.partner} (inactive)</option>}{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><IconAction label="Save Partner" accessibleLabel={`Save Partner for ${j.title}`} disabled={busy||matches.length>1||!Object.prototype.hasOwnProperty.call(owners,j.external_id)} onClick={()=>saveOwner(j)}><FloppyDisk size={17}/></IconAction></div></td></tr>;
    })}{!rows.length&&<tr><td colSpan={6}>No jobs match these filters.</td></tr>}</tbody></SortableTable></div></>}
    {state&&<p className="fine">Latest activity: {state.runs[0]?`${state.runs[0].status} ${state.runs[0].count} jobs at ${state.runs[0].created_at}`:'No synchronization yet'}</p>}
    <CRMCandidateImport searches={searches} api={api} reload={reload}/>
  </section>;
}
