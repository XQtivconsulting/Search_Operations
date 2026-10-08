import React from 'react';
import {candidateMatches} from './candidate-identity';
import {LinkedInIcon} from './LinkedInIcon';
export function CandidateMatches({candidates,form,onChoose,confirmed,onConfirm}:{candidates:Record<string,any>[];form:Record<string,any>;onChoose:(candidate:Record<string,any>)=>void;confirmed:boolean;onConfirm:(v:boolean)=>void}){
 const matches=candidateMatches(candidates,form);if(!matches.length)return null;
 return <section className="candidate-matches" aria-label="Possible existing candidates"><strong>Could this be an existing candidate?</strong><p>Check these profiles before creating a new person.</p>{matches.map(({candidate:c,reason})=><div className="candidate-match" key={c.id}><span><LinkedInIcon url={c.url} name={c.name}/><strong>{c.name}</strong><small>{[c.title,c.company,reason].filter(Boolean).join(' · ')}</small></span><button type="button" onClick={()=>onChoose(c)}>Use existing candidate</button></div>)}{!matches.some(m=>m.exact)&&<label className="checkbox"><input type="checkbox" checked={confirmed} onChange={e=>onConfirm(e.target.checked)}/>I checked these profiles; this is a different person.</label>}</section>;
}
