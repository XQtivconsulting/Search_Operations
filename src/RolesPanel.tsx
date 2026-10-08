import React,{useEffect,useState} from 'react';
import {permissionGroups,roleTemplates,RoleDefinition} from './access-policy';
import {Popup} from './Popup';
export function RolesPanel({api,reload,onDirty}:{api:(path:string,body?:unknown)=>Promise<any>;reload:()=>Promise<void>;onDirty:(v:boolean)=>void}){
 const [roles,setRoles]=useState<RoleDefinition[]>([]),[loaded,setLoaded]=useState(false),[query,setQuery]=useState(''),[draft,setDraft]=useState<Partial<RoleDefinition>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function read(){const r=await api('roles');setRoles(r.roles);setLoaded(true);}
 useEffect(()=>{read().catch(e=>setError(e.message));},[]);
 useEffect(()=>{onDirty(!!draft||busy);return()=>onDirty(false);},[!!draft,busy]);
 async function save(action:'save'|'delete'){
  if(action==='delete'&&!confirm(`Delete the role “${draft?.name}”?`))return;
  setBusy(true);setError('');try{await api('roles',{...draft,action});setDraft(null);setMessage(action==='save'?'Role permissions saved. They apply on the next request.':'Role deleted.');await read();await reload();}catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 return <section className="panel roles-panel"><div className="section-head"><div><h2>Roles & permissions</h2><p className="fine">Choose a template, then adjust individual permissions. People with multiple roles receive their combined permissions.</p></div><button className="primary" disabled={!loaded||busy} onClick={()=>{setError('');setDraft({name:'',description:'',permissions:[]});}}>Create role</button></div>
 <article className="role-card"><h3>Super Admin · Workspace owner</h3><p>Full workspace access · Protected role</p></article><label className="role-search">Find role<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name or permission"/></label>
 {error&&!draft&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 {!loaded?<p>Loading roles…</p>:<div className="role-cards">{roles.filter(r=>[r.name,r.description,...r.permissions.map(id=>permissionGroups.find(p=>p.id===id)?.label||id)].join(' ').toLowerCase().includes(query.toLowerCase())).map(r=><article className="role-card" key={r.id}><div className="section-head"><h3>{r.name}</h3><button onClick={()=>{setError('');setDraft({...r,permissions:[...r.permissions]});}}>Edit</button></div><p>{r.description||'Custom role'}</p><small>{r.users||0} people · {r.invitations||0} invitations · {r.permissions.length} permissions</small><details><summary>View permissions</summary><ul>{r.permissions.map(id=><li key={id}>{permissionGroups.find(p=>p.id===id)?.label}</li>)}</ul></details>{!r.permissions.length&&<p className="fine">No permissions assigned</p>}</article>)}</div>}
 <p className="fine">Super Admin is the protected workspace owner. Only the owner authorizes application code and deployment changes through GitHub and Cloudflare; an app role does not grant repository access. Editing permissions include the required viewing access. Assignment, tenant and audit protections always apply.</p>
 {draft&&<Popup title={draft.id?'Edit '+draft.name:'Create role'} onClose={()=>{if(!busy&&confirm('Discard unsaved role changes?'))setDraft(null);}}><form className="role-editor" onSubmit={e=>{e.preventDefault();save('save');}}>
 <label>Role name<input autoFocus required maxLength={80} disabled={busy} value={draft.name||''} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <label>Description<input maxLength={500} disabled={busy} value={draft.description||''} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
 <label>Apply permission template<select disabled={busy} value="" onChange={e=>{const t=roleTemplates.find(t=>t.id===e.target.value);if(t)setDraft({...draft,permissions:[...t.permissions]});}}><option value="">Choose template…</option>{roleTemplates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}<option value="" disabled>Templates replace the selection below</option></select></label>
 {[...new Set(permissionGroups.map(p=>p.group))].map(group=><fieldset key={group} disabled={busy}><legend>{group}</legend>{permissionGroups.filter(p=>p.group===group).map(p=><label className="permission-choice" key={p.id}><input type="checkbox" checked={draft.permissions?.includes(p.id)||false} onChange={e=>setDraft({...draft,permissions:e.target.checked?[...(draft.permissions||[]),p.id]:(draft.permissions||[]).filter(id=>id!==p.id)})}/><span><strong>{p.label}</strong><small>{p.description}</small></span></label>)}</fieldset>)}
 {draft.id&&<p className="fine">Changes affect {draft.users||0} people and {draft.invitations||0} pending invitations using this role.</p>}{error&&<p role="alert" className="error">{error}</p>}
 <div className="row-actions"><button className="primary" disabled={busy}>{busy?'Saving…':'Save role'}</button><button type="button" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button>{draft.id&&<button type="button" disabled={busy||!!draft.users||!!draft.invitations} title={draft.users||draft.invitations?'Reassign people and cancel invitations first':'Delete unused role'} onClick={()=>save('delete')}>Delete role</button>}</div>
 </form></Popup>}
 </section>;
}
