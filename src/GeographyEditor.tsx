import React,{useEffect,useState} from 'react';
import {geographyFullName,geographySearchText} from './candidate-geography';
import {normTag} from './candidate-tags';
import type {GeographyChoice} from './geography-lookup';
export function GeographyEditor({selected,options,api,onChange}:{selected:string[];options:string[];api:(path:string,body:any)=>Promise<GeographyChoice[]>;onChange:(values:string[],choice?:GeographyChoice)=>void}){
 const [query,setQuery]=useState(''),[results,setResults]=useState<GeographyChoice[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;setResults([]);setError('');setLoading(false);
  if(query.trim().length<2)return;
  setLoading(true);
  const timer=setTimeout(()=>{api('geography-lookup',{query:query.trim()}).then(rows=>{if(active)setResults(rows);}).catch(e=>{if(active)setError(e.message||'Location lookup unavailable. Try again.');}).finally(()=>{if(active)setLoading(false);});},400);
  return()=>{active=false;clearTimeout(timer);};
 },[query]);
 const local=query.trim()?options.filter(v=>geographySearchText(v).toLocaleLowerCase().includes(normTag(query))).slice(0,8):[];
 const suggestions=[...results.map(choice=>({label:choice.label,choice})),...local.map(label=>({label,choice:undefined as GeographyChoice|undefined}))].filter((s,i,a)=>!selected.some(v=>normTag(v)===normTag(s.label))&&a.findIndex(v=>normTag(v.label)===normTag(s.label))===i);
 return <fieldset className="geography-editor"><legend>Geography</legend>
  <div className="candidate-tags">{selected.map(v=><span className="profile-tag" key={v}>{geographyFullName(v)}<button type="button" aria-label={'Remove '+v} onClick={()=>onChange(selected.filter(x=>x!==v))}>×</button></span>)}</div>
  <input aria-label="Find Geography" autoComplete="off" maxLength={120} placeholder="City, state or country…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}}/>
  <div className="tag-value-options geography-suggestions">{suggestions.map(({label,choice})=><button key={label} type="button" onClick={()=>{onChange([...selected,label],choice);setQuery('');}}>{geographyFullName(label)}</button>)}</div>
  <small className="fine" role="status">{loading?'Finding locations…':''}</small>
  {error?<small className="error" role="alert">{error}</small>:!loading&&query.trim().length>=2&&!suggestions.length?<small className="fine">No matching location. Add a state or country to narrow your search.</small>:null}
  <small className="fine">Choose a suggestion to keep its city, state and country. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · Photon</small>
 </fieldset>;
}
