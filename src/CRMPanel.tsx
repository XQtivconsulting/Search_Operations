import {InterviewImport} from './InterviewImport';
import {HistoricalMappingImport} from './HistoricalMappingImport';
import {SearchRegister,SearchExcelImport} from './SearchRegister';
import {isCRMManaged} from './search-management';
import {SearchManagement} from './SearchManagement';
import {useViewState} from './ViewState';
import {IconAction} from './IconAction';
import {FloppyDisk} from '@phosphor-icons/react';
import {SortableTable} from './SortableTable';
import {CRMCandidateImport} from './CRMCandidateImport';
import React, {useEffect,useState} from 'react';
import {ColumnFilter} from './ColumnFilter';
import {emptyCRMFilters,filterCRMRows,CRMFilters} from './crm-view';
export function CRMPanel({searches,partners,api,reload}:{searches:any[];partners:{id:string;name:string}[];api:(path:string,body?:unknown)=>Promise<any>;reload:()=>Promise<void>}) {
  const [excelOpen,setExcelOpen]=useState(false);
  const [section,setSection]=useViewState('CRMPanel.section','searches');
  const [state,setState]=useState<any>(null),[selected,setSelected]=useState<Set<string>>(new Set()),[clients,setClients]=useState<Record<string,string>>({});
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [filters,setFilters]=useState<CRMFilters>(emptyCRMFilters),[owners,setOwners]=useState<Record<string,string>>({});
  const [numbers,setNumbers]=useState<Record<string,string>>({}),[sequenceStart,setSequenceStart]=useState('');
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
  const value=(j:any,key:string)=>key==='search_number'?Number(numbers[j.external_id]??local(j)?.search_number??0):key==='client'?clientName(j):key==='partner'?partnerName(j):key==='selected'?Number(selected.has(j.external_id)):j[key];
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
        return {external_id:j.external_id,fetched_at:j.fetched_at,search_id:s?.id,version:s?.version,search_number:numbers[j.external_id]??s?.search_number,partner_version:j.partner_version,client:clients[j.external_id],...(Object.prototype.hasOwnProperty.call(owners,j.external_id)?{partner_id:owners[j.external_id]}:{})};
      });
      const result=await api('crm/apply',{jobs});setSelected(new Set());setNumbers({});setOwners(v=>Object.fromEntries(Object.entries(v).filter(([id])=>!selected.has(id))));await reload();await load();setNotice(`${result.count} searches updated. Sourcing output and planning history are preserved.`);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  function numberSelected(){
    let next=Number(sequenceStart||state?.next_search_number||1);
    if(!Number.isSafeInteger(next)||next<1){setError('Choose a positive whole starting XQtiv Search ID.');return;}
    const assigned={...numbers},used=new Set(searches.map(s=>s.search_number).filter(Boolean));
    for(const j of [...rows].filter(j=>selected.has(j.external_id)&&!local(j)?.search_number).sort((a,b)=>String(a.external_id).localeCompare(String(b.external_id),undefined,{numeric:true}))){
      while(used.has(next))next++;
      assigned[j.external_id]=String(next);used.add(next++);
    }
    setNumbers(assigned);setError('');
  }
  return <section className="panel crm-panel"><nav className="research-tabs" aria-label="Integration sections"><button aria-pressed={section==='register'} className={section==='register'?'primary':''} onClick={()=>setSection('register')}>All searches</button><button aria-pressed={section==='searches'} className={section==='searches'?'primary':''} onClick={()=>setSection('searches')}>Import searches</button><button aria-pressed={section==='candidates'} className={section==='candidates'?'primary':''} onClick={()=>setSection('candidates')}>Import candidates by search</button><button aria-pressed={section==='mappings'} className={section==='mappings'?'primary':''} onClick={()=>setSection('mappings')}>Import mappings</button><button aria-pressed={section==='interviews'} className={section==='interviews'?'primary':''} onClick={()=>setSection('interviews')}>Import interviews</button><button aria-pressed={section==='extension'} className={section==='extension'?'primary':''} onClick={()=>setSection('extension')}>Profile Mapper</button></nav>{section==='extension'&&<div className="section-head"><h2>Profile Mapper</h2><a className="primary" href="/downloads/xrp-profile-mapper.zip" download>Download extension</a></div>}{section==='searches'&&<><div className="section-head"><h2>Import searches</h2><button onClick={()=>setExcelOpen(true)}>Import Excel</button><button className="primary" disabled={!state?.configured||busy} onClick={fetchPreview}>{busy?'Working…':'Refresh from RecruitCRM'}</button></div>
    {state&&!state.configured&&<p className="source-note">Not connected. Your administrator needs to configure the workspace’s RecruitCRM API token on the server.</p>}

    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    {!!state?.jobs.length&&<><div className="sheet-toolbar"><button disabled={!selectedCount||selectedCount>200||busy} onClick={apply}>Add / update {selectedCount} selected in repository</button><button disabled={busy||!rows.length} onClick={()=>setSelected(new Set(rows.filter((j:any)=>searches.filter(s=>s.external_id===j.external_id).length<=1&&(!local(j)||isCRMManaged(local(j)))).slice(0,200).map((j:any)=>j.external_id)))}>{rows.length>200?'Select first 200 shown':'Select shown'}</button><button onClick={()=>{setFilters(emptyCRMFilters());setSelected(new Set());}} disabled={busy}>Clear filters</button><label>Start XQtiv Search IDs at<input aria-label="Starting XQtiv Search ID" type="number" min="1" max="2147483647" value={sequenceStart} placeholder={String(state.next_search_number||1)} onChange={e=>setSequenceStart(e.target.value)}/></label><button disabled={busy||!selectedCount} onClick={numberSelected}>Number selected searches</button><span className="fine">Showing {rows.length} of {state.jobs.length} jobs. Filters clear row selection. Up to 200 per import.</span></div><div className="sheet-scroll"><SortableTable stateKey="CRMPanel.table1" className="sheet-table"><thead><tr>{heading('selected','Add / update')}{heading('search_number','XQtiv Search ID')}{heading('external_id','CRM ID')}{heading('title','Job title')}{heading('status','Status')}{heading('client','Client name')}{heading('partner','Engagement partner')}</tr><tr className="column-filters"><th></th><th></th><th><input aria-label="Filter CRM ID" placeholder="Contains…" value={filters.id} onChange={e=>changeFilter({id:e.target.value})}/></th><th><input aria-label="Filter job title" placeholder="Contains…" value={filters.title} onChange={e=>changeFilter({title:e.target.value})}/></th><th><ColumnFilter label="statuses" options={options(j=>j.status)} selected={filters.statuses} onChange={statuses=>changeFilter({statuses})}/></th><th><ColumnFilter label="companies" options={options(clientName)} selected={filters.companies} onChange={companies=>changeFilter({companies})}/></th><th><ColumnFilter label="partners" options={options(partnerName)} selected={filters.partners} onChange={partners=>changeFilter({partners})}/></th></tr></thead><tbody>{rows.map((j:any)=>{
      const matches=searches.filter(s=>s.external_id===j.external_id),s=matches[0];return <tr key={j.external_id}><td><input type="checkbox" aria-label={`Select ${j.title}`} disabled={busy||matches.length>1||!!s&&!isCRMManaged(s)} checked={selected.has(j.external_id)} onChange={e=>{const n=new Set(selected);e.target.checked?n.add(j.external_id):n.delete(j.external_id);setSelected(n);}}/></td><td><input type="number" min="1" max="2147483647" step="1" aria-label={`XQtiv Search ID for ${j.title}`} disabled={busy||matches.length>1||!!s&&!isCRMManaged(s)} placeholder="Auto" value={numbers[j.external_id]??s?.search_number??''} onChange={e=>setNumbers({...numbers,[j.external_id]:e.target.value})}/></td><td>{j.external_id}</td><td>{j.title}<small>{s?(isCRMManaged(s)?'Managed in RecruitCRM':'Managed in this app'):'Not added to repository'}</small>{s&&s.title!==j.title&&<small>Was: {s.title}</small>}</td><td>{j.status}{s&&s.status!==j.status&&<small>Was: {s.status}</small>}</td><td>{matches.length>1?'Duplicate CRM ID — reconcile first':j.company_name?<>{j.company_name}{s&&s.client!==j.company_name&&<small>Was: {s.client}</small>}</>:s?s.client:<input aria-label={`Client for ${j.title}`} placeholder="Enter client name" value={clients[j.external_id]||''} onChange={e=>setClients({...clients,[j.external_id]:e.target.value})}/>}</td><td className="partner-cell">{s&&((s.partner&&!s.partner_id)||Object.prototype.hasOwnProperty.call(owners,j.external_id))&&<small>Current: {s.partner || 'Not assigned'}</small>}<div className="partner-controls"><select aria-label={`Engagement partner for ${j.title} (${j.external_id})`} disabled={busy||matches.length>1} value={ownerValue(j)} onChange={e=>setOwners({...owners,[j.external_id]:e.target.value})}><option value="">Not assigned</option>{s?.partner_id&&!partners.some(p=>p.id===s.partner_id)&&<option value={s.partner_id} disabled>{s.partner} (inactive)</option>}{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><IconAction label="Save Partner" accessibleLabel={`Save Partner for ${j.title}`} disabled={busy||matches.length>1||!Object.prototype.hasOwnProperty.call(owners,j.external_id)} onClick={()=>saveOwner(j)}><FloppyDisk size={17}/></IconAction></div>{s&&<SearchManagement search={s} api={api} reload={reload}/>}</td></tr>;
    })}{!rows.length&&<tr><td colSpan={7}>No jobs match these filters.</td></tr>}</tbody></SortableTable></div></>}
    {state&&<p className="fine">Latest activity: {state.runs[0]?`${state.runs[0].status} ${state.runs[0].count} jobs at ${state.runs[0].created_at}`:'No synchronization yet'}</p>}
    </>}{section==='register'&&<SearchRegister searches={searches} api={api} reload={reload}/>} {excelOpen&&<SearchExcelImport api={api} reload={reload} close={()=>setExcelOpen(false)}/>} {section==='interviews'&&<InterviewImport api={api} reload={reload}/>} {section==='mappings'&&<HistoricalMappingImport api={api} reload={reload}/>} {section==='candidates'&&<CRMCandidateImport searches={searches} api={api} reload={reload}/>}
  </section>;
}
