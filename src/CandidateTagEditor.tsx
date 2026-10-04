import {GeographyEditor} from './GeographyEditor';
import type {GeographyChoice} from './geography-lookup';
import React,{useState} from 'react';
import {tagCategories,tagOptions,normTag} from './candidate-tags';
export function CandidateTagEditor({records,value,onChange,api}:{records:any[];value:Record<string,string[]>;api:any;onChange:(v:Record<string,string[]>,choice?:GeographyChoice)=>void}){
 const [queries,setQueries]=useState<Record<string,string>>({});
 return <div className="candidate-tag-editor">{tagCategories.map(c=>{
  const q=queries[c.key]||'',selected=value[c.key]||[],options=tagOptions(records,c.key);
  if(c.key==='geography')return <GeographyEditor key={c.key} selected={selected} options={options} api={api} onChange={(geography,choice)=>onChange({...value,geography},choice)}/>;
  const matches=options.filter(v=>normTag(v).includes(normTag(q)));
  const add=(v:string)=>{onChange({...value,[c.key]:[...selected,v]});setQueries({...queries,[c.key]:''});};
  return <fieldset key={c.key}><legend>{c.label}</legend>
   <div className="candidate-tags">{selected.map(v=><span className="profile-tag" key={v}>{v}<button type="button" aria-label={'Remove '+v} onClick={()=>onChange({...value,[c.key]:selected.filter(x=>x!==v)})}>×</button></span>)}</div>
   <input aria-label={'Find or add '+c.label} placeholder="Type to select or add…" value={q} onChange={e=>setQueries({...queries,[c.key]:e.target.value})}/>
   <div className="tag-value-options">{matches.filter(v=>!selected.some(s=>normTag(s)===normTag(v))).map(v=><button type="button" key={v} onClick={()=>add(v)}>{v}</button>)}{q.trim()&&!options.some(v=>normTag(v)===normTag(q))&&!selected.some(v=>normTag(v)===normTag(q))&&<button type="button" onClick={()=>add(q.trim())}>Add “{q.trim()}”</button>}</div>
  </fieldset>;
 })}<p className="fine">Search tags come from mappings. Compensation values specify currency and annual on-target earnings; leave unknown values unset.</p></div>;
}
