import React,{useState} from 'react';
export function TeamsPanel({data,api,reload,onAdd}:{data:any;api:(p:string,b?:unknown)=>Promise<any>;reload:()=>Promise<void>;onAdd:()=>void}) {
 const [edit,setEdit]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <section className="panel"><div className="section-head"><div><h2>Research teams</h2><p>Choose the researchers in each team. New assignments use this roster.</p></div><button onClick={onAdd}>Add team</button></div>
 {!data.teams.length&&<p>Create your first team, then select its researchers.</p>}
 {data.teams.map((t:any)=><div className="work-row" key={t.id}><strong>{t.name}</strong><span>{data.team_members.filter((m:any)=>m.team_id===t.id).map((m:any)=>data.staff.find((s:any)=>s.id===m.staff_id)?.name).join(', ')||'No members yet'}</span><button onClick={()=>{setEdit({...t,staff_ids:data.team_members.filter((m:any)=>m.team_id===t.id).map((m:any)=>m.staff_id)});setError('');}}>Edit members</button></div>)}
 {edit&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="team-title"><div className="section-head"><h2 id="team-title">{edit.name} researchers</h2><button disabled={busy} onClick={()=>setEdit(null)}>Cancel</button></div><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('mutate',{kind:'team-members',id:edit.id,version:edit.roster_version,staff_ids:edit.staff_ids});await reload();setEdit(null);}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>
 <p className="fine">Existing assignments keep their original researchers. Membership does not grant app access; invite colleagues separately.</p>
 {!data.staff.length&&<p>Add researchers in People and access first.</p>}
 {data.staff.map((s:any)=><label className="checkbox" key={s.id}><input type="checkbox" disabled={busy} checked={edit.staff_ids.includes(s.id)} onChange={e=>setEdit({...edit,staff_ids:e.target.checked?[...edit.staff_ids,s.id]:edit.staff_ids.filter((id:string)=>id!==s.id)})}/>{s.name}</label>)}
 {error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Saving…':'Save team members'}</button></form></section></div>}
 </section>;
}
