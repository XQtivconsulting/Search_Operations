import React,{useEffect,useState} from 'react';
import {canPlan} from './domain';
type R=Record<string,any>;
export function EffortConfirmation({data,staff,date,api,reload,onDirty}:{data:R;staff:string;date:string;api:(p:string,b?:unknown)=>Promise<any>;reload:()=>Promise<void>;onDirty:(v:boolean)=>void}){
 const version=(data.effortDays||[]).find((r:R)=>r.staff_id===staff&&r.work_date===date)?.version||0;
 return <EffortForm key={staff+date+version} {...{data,staff,date,api,reload,onDirty,version}}/>;
}
function EffortForm({data,staff,date,api,reload,onDirty,version}:R){
 const saved=(data.effort||[]).filter((r:R)=>r.staff_id===staff&&r.work_date===date);
 const pairs=new Map<string,R>();
 for(const a of data.assignments.filter((a:R)=>a.work_date===date&&data.entries.some((e:R)=>e.assignment_id===a.id&&e.staff_id===staff)))pairs.set(a.search_id+':'+a.team_id,{search_id:a.search_id,team_id:a.team_id});
 for(const m of (data.research?.records||[]).filter((m:R)=>m.kind==='mapping'&&m.staff_id===staff&&m.work_date===date))pairs.set(m.role_id+':'+m.team_id,{search_id:m.role_id,team_id:m.team_id});
 for(const e of saved)pairs.set(e.search_id+':'+e.team_id,e);
 const initial=[...pairs.values()].map((r,i)=>({...r,days:saved.find((e:R)=>e.search_id===r.search_id&&e.team_id===r.team_id)?.days??(version?0:(Math.floor(100/pairs.size)+(i<100%pairs.size?1:0))/100)}));
 const [items,setItems]=useState<R[]>(initial),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[role,setRole]=useState(''),[team,setTeam]=useState('');
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty]);
 const total=items.reduce((n,r)=>n+Number(r.days||0),0),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
 const edit=(i:number,days:string)=>{setItems(items.map((r,j)=>j===i?{...r,days}:r));setDirty(true);};
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('mutate',{kind:'effort',staff_id:staff,work_date:date,version,items});setDirty(false);await reload();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <details className="effort-confirmation"><summary>Person-days · {date} · {version?'Confirmed — edit if needed':'Needs confirmation'}</summary><form onSubmit={save}><p className="fine">Confirm time spent, even with no mappings. Split your day across searches; use 0 for work not done. Suggestions are not saved until confirmed.</p>{items.map((r,i)=><label className="effort-row" key={r.search_id+':'+r.team_id}><span>{data.searches.find((s:R)=>s.id===r.search_id)?.client} · {data.searches.find((s:R)=>s.id===r.search_id)?.title}<small>{data.teams.find((t:R)=>t.id===r.team_id)?.name}</small></span><input aria-label={'Person-days for '+data.searches.find((s:R)=>s.id===r.search_id)?.title} type="number" min="0" max="1" step="0.01" value={r.days} disabled={busy||date>today} onChange={e=>edit(i,e.target.value)}/></label>)}<div className="sheet-toolbar"><label>Add search<select value={role} onChange={e=>setRole(e.target.value)}><option value="">Select search</option>{data.searches.map((s:R)=><option key={s.id} value={s.id}>{s.client} · {s.title}</option>)}</select></label><label>Team<select value={team} onChange={e=>setTeam(e.target.value)}><option value="">Select team</option>{data.teams.filter((t:R)=>canPlan(data.actor)||data.team_members.some((m:R)=>m.staff_id===staff&&m.team_id===t.id)).map((t:R)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button type="button" disabled={busy||!role||!team||items.some(r=>r.search_id===role&&r.team_id===team)} onClick={()=>{setItems([...items,{search_id:role,team_id:team,days:0}]);setDirty(true);}}>Add</button></div><div className="row-actions"><span>{total.toFixed(2)} / 1 person-day · {(total*8).toFixed(1)} estimated hours</span><button disabled={busy||!items.length||total>1.000001||date>today} type="submit">{busy?'Saving…':'Confirm person-days'}</button></div>{date>today&&<p className="fine">Future effort cannot be confirmed.</p>}{error&&<p className="error" role="alert">{error}</p>}</form></details>;
}
