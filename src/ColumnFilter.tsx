import React,{useState} from 'react';
export function ColumnFilter({label,options,selected,onChange}:{label:string;options:string[];selected:string[]|null;onChange:(v:string[]|null)=>void}) {
 const [query,setQuery]=useState('');
 const shown=options.filter(v=>v.toLowerCase().includes(query.toLowerCase()));
 return <details className="column-filter"><summary aria-label={`Filter ${label}`}>{selected===null?'All':`${selected.length} selected`} <span aria-hidden="true">▾</span></summary><div className="filter-menu"><input aria-label={`Find ${label} options`} placeholder="Find values…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="row-actions"><button type="button" onClick={()=>onChange(null)}>All</button><button type="button" onClick={()=>onChange([])}>None</button></div><div className="filter-options">{shown.map(v=><label className="checkbox" key={v}><input type="checkbox" checked={selected===null||selected.includes(v)} onChange={e=>{const next=new Set(selected===null?options:selected);e.target.checked?next.add(v):next.delete(v);onChange([...next]);}}/>{v||'(Blank)'}</label>)}{!shown.length&&<p>No matching values</p>}</div></div></details>;
}
