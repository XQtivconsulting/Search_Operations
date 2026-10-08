import {useViewState} from './ViewState';
import {SortableTable} from './SortableTable';
import React,{useEffect,useState} from 'react';
import {canPlan,hasRole} from './domain';
import {dailyEngagementRows,matchesQueue,queueLabels} from './engagement-daily';
import {engagementSearchClosed,engagementAssignees} from './engagement-domain';
import {SearchStatusFilter,matchesSearchStatus} from './SearchFilters';
type R=Record<string,any>;
export function EngagementDaily({data,onWork,onCandidate,onSearch}:any){
 const [now,setNow]=useState(Date.now()),[scope,setScope]=useViewState('EngagementDaily.scope','mine'),[status,setStatus]=useViewState('EngagementDaily.status','open'),[query,setQuery]=useViewState('EngagementDaily.query','');
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const records:R[]=data.research.records,actor=data.actor,manager=canPlan(actor),name=(id:string)=>data.people.find((p:R)=>p.id===id)?.name||'Former member';
 const searches=data.searches.filter((s:R)=>matchesSearchStatus(s,status)&&(!query||`${s.search_number} ${s.client} ${s.title}`.toLowerCase().includes(query.toLowerCase()))&&(scope==='all'||manager||s.partner_id===actor.id||engagementAssignees(records,s.id).includes(actor.id)));
 const rows=dailyEngagementRows(records,data.searches,now).filter(r=>searches.some((s:R)=>s.id===r.role_id)&&(scope==='all'||manager||data.searches.find((s:R)=>s.id===r.role_id)?.partner_id===actor.id||r.members.includes(actor.id)));
 const coming=records.filter(r=>(scope==='all'||manager||data.searches.find((s:R)=>s.id===r.role_id)?.partner_id===actor.id||engagementAssignees(records,r.role_id,'Top Funnel').includes(actor.id))&&r.kind==='mapping'&&r.status==='Partner review'&&searches.some((s:R)=>s.id===r.role_id&&!engagementSearchClosed(s.status)));
 const matches=matchesQueue;
 const open=(id:string,key:string)=>onSearch(id,key);
 const relevant=searches.filter((s:R)=>rows.some(r=>r.role_id===s.id)||coming.some(r=>r.role_id===s.id)).sort((a:R,b:R)=>rows.filter(r=>r.role_id===b.id&&r.overdue).length-rows.filter(r=>r.role_id===a.id&&r.overdue).length||a.client.localeCompare(b.client));
 const titles=queueLabels;
 return <section className="panel engagement-daily"><div className="sheet-toolbar"><label>Searches<select value={scope} onChange={e=>{setScope(e.target.value);}}><option value="mine">{manager?'All searches I manage':'My assigned searches'}</option><option value="all">All searches (view)</option></select></label><label>Find search<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Client or search name"/></label><SearchStatusFilter searches={data.searches} value={status} onChange={value=>{setStatus(value);}}/></div>
 <div className="daily-counts">{[['overdue','Overdue'],['due','Due today'],['new','New today'],['coming','Coming from sourcing']].map(([key,label])=><div key={key} className={'daily-count '+key+(rows.some(r=>matches(r,key))?(['due','overdue'].includes(key)?' has-attention':key==='new'?' has-new':''):'')}><strong>{key==='coming'?coming.length:rows.filter(r=>matches(r,key)).length}</strong><span>{label}</span></div>)}</div>
 <div className="table-scroll"><SortableTable stateKey="EngagementDaily.table1" className="sheet-table daily-searches"><thead><tr><th>Search ID</th><th>Search / engagement members</th><th>Active</th><th>New today</th><th>Overdue</th><th>Due today</th><th>Coming soon</th><th>Unscheduled</th><th>Placed</th></tr></thead><tbody>{relevant.map((s:R)=>{const own=rows.filter(r=>r.role_id===s.id),ids=engagementAssignees(records,s.id);return <tr key={s.id}><td>{s.search_number??'—'}</td><td><button className="text-button" onClick={()=>open(s.id,'active')}><strong>{s.client} · {s.title}</strong></button><small>{ids.length?ids.map(name).join(', '):'Engagement resources not assigned'}</small></td>{['active','new','overdue','due','coming','unscheduled','placed'].map(key=>{const n=key==='coming'?coming.filter(r=>r.role_id===s.id).length:own.filter(r=>matches(r,key)).length;return <td key={key}><button className={key==='placed'?'daily-placed':'text-button'+(n>0?(['due','overdue'].includes(key)?' due-count':key==='new'?' new-count':''):'')} disabled={!n} aria-label={`${titles[key]} for ${s.title}: ${n}`} onClick={()=>open(s.id,key)}>{n}</button></td>;})}</tr>;})}</tbody></SortableTable></div>{!relevant.length&&<p>No engagement work or upcoming sourcing handoffs match these searches.</p>}

 </section>;
}

