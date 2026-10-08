import React from 'react';
import {displayDateTime} from './dates';
export function SearchStatus({search}:{search:any}){
 const history=search?.status_history||[],current=history[0];
 return <div className="search-status"><span>{search?.status||'Not set'}</span><small title={current?.source==='System / CRM'?'Time the status change was recorded in this app':undefined}>{current?.changed_at?displayDateTime(current.changed_at):'Date not recorded'}</small>{current?.notes&&<small className="search-status-note">{current.notes}</small>}{history.length>1&&<details><summary>History</summary>{history.map((h:any)=><div key={h.id}><strong>{h.status||'Not set'}</strong> · {h.changed_at?displayDateTime(h.changed_at):'Date not recorded'}{h.notes&&<p>{h.notes}</p>}</div>)}</details>}</div>;
}
