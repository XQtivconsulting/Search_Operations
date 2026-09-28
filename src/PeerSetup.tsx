import React,{useState} from 'react';
type R=Record<string,any>;
export function PeerSetup({data,api,reload}:{data:R;api:(p:string,b?:unknown)=>Promise<any>;reload:()=>Promise<void>}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const records:R[]=data.research?.records||[],people:R[]=(data.people||[]).filter((p:R)=>p.role==='researcher'&&p.staff_id);
 async function save(team:string,staff:string,reviewer:string){const old=records.find(r=>r.kind==='peer-route'&&r.team_id===team&&r.staff_id===staff);setBusy(true);setError('');setMessage('');try{await api('research',{action:'peer-route',id:old?.id,version:old?.version,team_id:team,staff_id:staff,reviewer_staff_id:reviewer});await reload();setMessage('Reviewer pairing saved.');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <section className="panel"><h2>Who reviews whose work?</h2><p>Choose another researcher in the same team. You can set pairings before inviting people; an active researcher account is required to submit and review work.</p>{error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{data.teams.map((t:R)=>{
  const staffIds:string[]=data.team_members.filter((m:R)=>m.team_id===t.id).map((m:R)=>m.staff_id),teamStaff:R[]=data.staff.filter((s:R)=>staffIds.includes(s.id)),teamPeople=people.filter(p=>staffIds.includes(p.staff_id));
  return <section key={t.id}><h3>{t.name}</h3>{staffIds.length<2&&<p className="fine">Add at least two researchers to this team to choose a reviewer.</p>}<table className="sheet-table"><thead><tr><th>Researcher</th><th>Reviewed by</th><th>Setup</th></tr></thead><tbody>{teamStaff.map(s=>{
   const p=teamPeople.find(p=>p.staff_id===s.id),options=teamStaff.filter(q=>q.id!==s.id),route=records.find(r=>r.kind==='peer-route'&&r.team_id===t.id&&r.staff_id===s.id),legacy=records.find(r=>r.kind==='team-reviewer'&&r.team_id===t.id);
   const savedStaff=route?.reviewer_staff_id||teamPeople.find(q=>q.id===route?.reviewer_id)?.staff_id;
   const valid=options.find(q=>q.id===savedStaff),activeOptions=options.filter(q=>teamPeople.some(p=>p.staff_id===q.id)),fallback=options.find(q=>q.id===teamPeople.find(p=>p.id===legacy?.reviewer_id)?.staff_id);
   // An explicit departed pairing must be corrected, never displayed as an automatic replacement.
   const current=valid?.id||(route?'':activeOptions.length===1?activeOptions[0].id:fallback?.id)||'';
   const reviewerActive=teamPeople.some(q=>q.staff_id===current);
   const status=!options.length?'Add a teammate':route&&!valid?'Selected reviewer is unavailable — choose another':!p?'Researcher account not active':current&&!reviewerActive?'Reviewer account not active':valid?'Assigned':activeOptions.length===1?'Automatic pairing':fallback?'Existing team default':'Choose a reviewer';
   return <tr key={s.id}><td>{s.name}</td><td><select aria-label={'Reviewer for '+s.name+' in '+t.name} disabled={busy||!options.length} value={current} onChange={e=>save(t.id,s.id,e.target.value)}><option value="" disabled>{options.length?'Choose a teammate':'No teammate available'}</option>{options.map(q=><option key={q.id} value={q.id}>{q.name}{teamPeople.some(p=>p.staff_id===q.id)?'':' (account not active)'}</option>)}</select></td><td>{status}</td></tr>;
  })}</tbody></table></section>;
 })}<p className="fine">Pairings apply to new submissions. Pending reviews keep their reviewer; use Reassign peer on the mapping to change it. Reviewers who leave the team cannot complete its peer reviews.</p></section>;
}
