import {FilterPopover} from './FilterPopover';
import React,{useState} from 'react';
export function ColumnFilter({label,options,selected,onChange,floating=false,optionLabel=(v:string)=>v||'(Blank)',searchText=(v:string)=>v}:{label:string;options:string[];selected:string[]|null;onChange:(v:string[]|null)=>void;floating?:boolean;optionLabel?:(v:string)=>string;searchText?:(v:string)=>string}) {
 const [query,setQuery]=useState('');
 const shown=options.filter(v=>searchText(v).toLowerCase().includes(query.toLowerCase()));
 const content=<><input aria-label={`Find ${label} options`} placeholder="Find values…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="row-actions"><button type="button" onClick={()=>onChange(null)}>All</button><button type="button" onClick={()=>onChange([])}>None</button></div><div className="filter-options">{shown.map(v=><label className="checkbox" key={v}><input type="checkbox" checked={selected===null||selected.includes(v)} onChange={e=>{const next=new Set(selected===null?options:selected);e.target.checked?next.add(v):next.delete(v);onChange([...next]);}}/>{optionLabel(v)}</label>)}{!shown.length&&<p>No matching values</p>}</div></>;
 return floating?<FilterPopover label={`Filter ${label}`} summary={selected===null?'All':`${selected.length} selected`}>{content}</FilterPopover>:<details className="column-filter"><summary aria-label={`Filter ${label}`}>{selected===null?'All':`${selected.length} selected`} <span aria-hidden="true">▾</span></summary><div className="filter-menu">{content}</div></details>;
}
