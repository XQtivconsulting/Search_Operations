import React,{useState} from 'react';
import {canReceiveEngagementAssignment,unavailableEngagementAssignments} from './engagement-assignment';
type Person={id:string;name:string;status?:string;role?:unknown;roles?:unknown;permissions?:unknown};
export function EngagementAssignmentGrid({people,assignments,onChange,disabled=false}:{people:Person[];assignments:string[];onChange:(value:string[])=>void;disabled?:boolean}){
 const [query,setQuery]=useState('');
 const selected=new Set(assignments),unavailable=unavailableEngagementAssignments(people,assignments);
 const members=people.filter(canReceiveEngagementAssignment).filter(p=>p.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
 return <fieldset disabled={disabled}><legend>Assigned engagement resources</legend><label>Find person<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><p className="fine">{selected.size} selected</p>
 {unavailable.length>0&&<div className="unavailable-engagement-assignments" role="alert"><p>Remove unavailable assignments before saving.</p>{unavailable.map(p=><div className="unavailable-engagement-assignee" key={p.id}><span><strong>{p.name}</strong><small>No longer eligible for engagement work</small></span><button type="button" aria-label={`Remove assignment for ${p.name}`} onClick={()=>onChange(assignments.filter(id=>id!==p.id))}>Remove</button></div>)}</div>}
 {members.map(p=><label className="checkbox" key={p.id}><input type="checkbox" checked={selected.has(p.id)} onChange={e=>onChange(e.target.checked?[...new Set([...assignments,p.id])]:assignments.filter(id=>id!==p.id))}/>{p.name}</label>)}{!members.length&&<p>No matching engagement resources.</p>}</fieldset>;
}
