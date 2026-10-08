import {canReceiveEngagementAssignment,unavailableEngagementAssignments} from './engagement-assignment';
import {SearchStatus} from './SearchStatus';
import {hasPermission} from './access-policy';
import {IconAction} from './IconAction';
import {PencilSimple} from '@phosphor-icons/react';
import {EngagementAssignmentGrid} from './EngagementAssignmentGrid';
import {EngagementSearchWorkspace} from './EngagementSearchWorkspace';
import {useViewState} from './ViewState';
import {LinkedInIcon} from './LinkedInIcon';
import {SortableTable} from './SortableTable';
import React,{useEffect,useState,useMemo} from 'react';
import {canPlan,hasRole} from './domain';
import {engagementRows,engagementAssignees} from './engagement-domain';
import {pipelineStages,pipelineConfig,resolvedStage,stageDays,stageOverdue,funnelGroups,funnelColors} from './engagement-pipeline';
import {teamColor} from './team-colors';
type R=Record<string,any>;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
export function Engagement({data,api,reload,onDirty,onCandidate,onInterviews,onAllAssignments,mine=false,section='Pipeline',initialRole='',initialMapping='',initialStage=''}:any){
 const [role,setRole]=useViewState('Engagement.role',initialRole),[edit,setEdit]=useState<R|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const records:R[]=data.research.records,people=data.people.filter(canReceiveEngagementAssignment),rows=useMemo(()=>engagementRows(records,data.searches),[records,data.searches]),planner=hasPermission(data.actor,'engagement.assign'),stages=pipelineStages(records);
 const [assignmentQuery,setAssignmentQuery]=useViewState('Engagement.assignmentQuery',''),[assignmentDetail,setAssignmentDetail]=useState<{role:string;view:string}|null>(null);
 const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{onDirty(!!edit||busy);return()=>onDirty(false);},[!!edit,busy]);
 const name=(id:string)=>data.people.find((p:R)=>p.id===id)?.name||'Former member';
 const candidate=(r:R)=>records.find(c=>c.kind==='candidate'&&c.id===r.candidate_id);
 const roleName=(id:string)=>{const s=data.searches.find((s:R)=>s.id===id);return s?`${s.client} · ${s.title}`:'Search';};
 const canManage=(r:R)=>hasPermission(data.actor,'engagement.assign');
 const assignees=(id:string,group?:string)=>engagementAssignees(records,id,group);
 const canWork=(r:R)=>hasPermission(data.actor,'engagement.work')&&r.approved&&(canManage(r)||hasRole(data.actor,'engagement')&&assignees(r.role_id,resolvedStage(r,stages).group).includes(data.actor.id));
 const assignSearch=(id:string)=>{const old=records.find(r=>r.kind==='engagement-assignment'&&r.role_id===id);setError('');setEdit({...old,role_id:id,mode:'assign',member_ids:assignees(id),group_member_ids:undefined});};
 async function act(body:R){setBusy(true);setError('');try{await api('research',body);await reload();setEdit(null);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 const open=(r:R,target=r.stage_id)=>{if(!canWork(r)||busy)return;setError('');setEdit({...r,mode:'work',stage_id:target,notes:'',recommended_on:r.recommended_on||'',occurred_on:today(),pipeline_version:pipelineConfig(records)?.version||0});};
 useEffect(()=>{if(initialMapping){const row=rows.find(r=>r.mapping_id===initialMapping);if(row)open(row,initialStage||row.stage_id);}},[initialMapping]);
 const age=(r:R)=>{const s=resolvedStage(r,stages),days=stageDays(r,now);return <span className={stageOverdue(r,s,now)?'stage-age overdue':'stage-age'}>{days===null?'Stage age unknown':`${days} ${days===1?'day':'days'} in stage`}{stageOverdue(r,s,now)?` · ${s.threshold}d threshold`:''}</span>;};
 return <section className={"panel engagement-workspace"+(section==='Pipeline'&&!mine?' engagement-pipeline':'')}>{error&&!edit&&<p className="error" role="alert">{error}</p>}
 {section==='Search assignments'?<><div className="sheet-toolbar"><label>Find search or assignee<input type="search" value={assignmentQuery} onChange={e=>setAssignmentQuery(e.target.value)} placeholder="Search name, client, partner or assigned member…"/></label>{assignmentQuery&&<button onClick={()=>setAssignmentQuery('')}>Clear</button>}</div><div className="table-scroll"><SortableTable stateKey="Engagement.table1" className="sheet-table engagement-assignments-table"><thead><tr><th>Search ID</th><th>Search</th><th>Status</th><th>Engagement partner</th><th>Assigned members</th><th>Actions</th></tr></thead><tbody>{data.searches.filter((s:R)=>assignmentQuery.trim().toLowerCase().split(/\s+/).every(term=>[s.search_number,s.title,s.client,s.partner,s.status,...assignees(s.id).map(name)].join(' ').toLowerCase().includes(term))).map((s:R)=><tr key={s.id}><td>{s.search_number??'—'}</td><td>{roleName(s.id)}</td><td data-sort-value={s.status}><SearchStatus search={s}/></td><td>{s.partner||'Not assigned'}</td><td>{assignees(s.id).map(name).join(', ')||'Unassigned'}</td><td><div className="engagement-assignment-actions"><button className="text-button" onClick={()=>setAssignmentDetail({role:s.id,view:'funnels'})}>View assignees</button>{canManage({role_id:s.id})&&<button className="text-button" onClick={()=>assignSearch(s.id)}>Assign people</button>}</div></td></tr>)}</tbody></SortableTable></div></>:<>
 <EngagementSearchWorkspace data={data} role={role} setRole={setRole} mine={mine} now={now} canWork={canWork} open={open} onCandidate={onCandidate} onInterviews={onInterviews} onAssignments={id=>setAssignmentDetail({role:id,view:'funnels'})} onAllAssignments={onAllAssignments}/>

 </>}
 {assignmentDetail&&<div className="modal-backdrop"><section className="modal engagement-assignment-modal" role="dialog" aria-modal="true" aria-label="View assignees"><div className="section-head"><h2>View assignees</h2><button onClick={()=>setAssignmentDetail(null)}>Close</button></div><p>{roleName(assignmentDetail.role)}</p><ul>{assignees(assignmentDetail.role).map(id=><li key={id}>{name(id)}</li>)}</ul>{!assignees(assignmentDetail.role).length&&<p>No engagement members assigned.</p>}{canManage({role_id:assignmentDetail.role})&&<button onClick={()=>{assignSearch(assignmentDetail.role);setAssignmentDetail(null);}}>Edit assignments</button>}</section></div>}
 {edit&&<div className="modal-backdrop"><section className={'modal engagement-modal'+(edit.mode==='assign'?' engagement-assignment-modal':'')} role="dialog" aria-modal="true" aria-label="Engagement editor"><div className="section-head"><h2>{({team:'Engagement team',assign:'Engagement assignments',work:'Move candidate / add note'} as R)[edit.mode]}</h2><button disabled={busy} onClick={()=>{if(!edit.notes||confirm('Discard unsaved changes?'))setEdit(null);}}>Cancel</button></div>

 {edit.mode==='assign'&&<form onSubmit={e=>{e.preventDefault();act({...edit,action:'engagement-search-assign'});}}><p><strong>{roleName(edit.role_id)}</strong></p><EngagementAssignmentGrid people={data.people} assignments={edit.member_ids} disabled={busy} onChange={member_ids=>setEdit({...edit,member_ids})}/>{!people.length&&<p>No active people have engagement permissions. Update their roles in Access Management.</p>}<button disabled={busy||unavailableEngagementAssignments(data.people,edit.member_ids).length>0} className="primary">Save engagement assignments</button></form>}
 {edit.mode==='work'&&<form onSubmit={e=>{e.preventDefault();act({...edit,action:'engagement-update'});}}><p><LinkedInIcon url={candidate(edit)?.url} name={candidate(edit)?.name}/><strong>{candidate(edit)?.name}</strong><small>{roleName(edit.role_id)}</small></p><p className="fine">Current: {rows.find(r=>r.mapping_id===edit.mapping_id)?.stage} · {age(edit)}</p>{edit.search_closed&&<p className="notice">Search closed. Record notes or move to an exited / placed outcome.</p>}<label>Engagement stage<select value={edit.stage_id} onChange={e=>setEdit({...edit,stage_id:e.target.value})}>{!stages.some(s=>s.id===edit.stage_id)&&<option value={edit.stage_id}>{edit.stage}</option>}{stages.map(s=><option key={s.id} value={s.id}>{s.group} · {s.label}</option>)}</select></label>{edit.stage_id==='recommended'&&<><label>Date recommended to client<input type="date" value={edit.recommended_on} required={edit.stage_id==='recommended'} onChange={e=>setEdit({...edit,recommended_on:e.target.value})}/></label></>}<label>Activity date<input type="date" required value={edit.occurred_on} onChange={e=>setEdit({...edit,occurred_on:e.target.value})}/></label><label>What happened / reason for moving<textarea autoFocus required rows={4} value={edit.notes} onChange={e=>setEdit({...edit,notes:e.target.value})}/></label><button className="primary" disabled={busy}>{busy?'Saving…':'Save update'}</button></form>}
 {error&&<p className="error" role="alert">{error}</p>}</section></div>}
 </section>;
}

