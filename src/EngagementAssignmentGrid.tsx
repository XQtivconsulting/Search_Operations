import React,{useState} from 'react';
type Person={id:string;name:string};
export function EngagementAssignmentGrid({people,assignments,onChange,disabled=false}:{people:Person[];assignments:string[];onChange:(value:string[])=>void;disabled?:boolean}){
 const [query,setQuery]=useState('');
 const selected=new Set(assignments),members=[...people].filter(p=>p.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
 return <fieldset disabled={disabled}><legend>Assigned engagement resources</legend><label>Find person<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><p className="fine">{selected.size} assigned · Each person can work across the search’s engagement stages.</p>{members.map(p=><label className="checkbox" key={p.id}><input type="checkbox" checked={selected.has(p.id)} onChange={e=>onChange(e.target.checked?[...assignments,p.id]:assignments.filter(id=>id!==p.id))}/>{p.name}</label>)}{!members.length&&<p>No matching engagement resources.</p>}</fieldset>;
}
