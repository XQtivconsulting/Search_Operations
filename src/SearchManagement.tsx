import React,{useState} from 'react';
import {Popup} from './Popup';
import {isCRMManaged,searchStatuses} from './search-management';
export function SearchManagement({search,api,reload,onDirty=()=>{}}:{search:any;api:(path:string,body?:unknown)=>Promise<any>;reload:()=>Promise<void>;onDirty?:(dirty:boolean)=>void}){
 const [draft,setDraft]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const open=()=>{setDraft({...search,take_over:false});setError('');};
 const close=()=>{setDraft(null);onDirty(false);};
 const change=(patch:any)=>{setDraft({...draft,...patch});onDirty(true);};
 const crm=draft&&isCRMManaged(draft),editable=draft&&(!crm||draft.take_over);
 async function save(){setBusy(true);setError('');try{await api('mutate',{kind:'search-manage',id:draft.id,version:draft.version,title:draft.title,client:draft.client,status:draft.status,take_over:draft.take_over});await reload();close();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <><button onClick={open}>Search settings</button>{draft&&<Popup title="Search settings" onClose={()=>{if(!busy)close();}}><div className="search-settings-form"><p>Managed in: <strong>{crm?'RecruitCRM':'This app'}</strong></p>{crm&&<><label className="checkbox search-settings-takeover"><input type="checkbox" checked={draft.take_over} disabled={busy} onChange={e=>change({take_over:e.target.checked})}/> Manage this search in this app</label>{draft.take_over&&<p className="search-settings-note">RecruitCRM will stop updating this search. Existing candidates, plans and history stay linked.</p>}</>}<label>Search name<input value={draft.title} disabled={!editable||busy} onChange={e=>change({title:e.target.value})}/></label><label>Client<input value={draft.client} disabled={!editable||busy} onChange={e=>change({client:e.target.value})}/></label><label>Search status<select value={draft.status} disabled={!editable||busy} onChange={e=>change({status:e.target.value})}>{!searchStatuses.includes(draft.status)&&<option>{draft.status}</option>}{searchStatuses.map(status=><option key={status}>{status}</option>)}</select></label><div className="search-settings-footer">{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={!editable||busy||!draft.title.trim()||!draft.client.trim()} onClick={save}>{busy?'Saving…':crm?'Switch and save':'Save changes'}</button></div></div></Popup>}</>;
}

