import {linkedinKey} from './candidate-identity';
import {linkedin} from './candidate-identity';
export function candidateRows(grid:any[][]){
 if(grid.length<2)throw new Error('Add a header row and at least one candidate.');
 const aliases:Record<string,string>={xqtivsearchid:'search_number',executivesearchid:'search_number',searchid:'search_number',notes:'rationale',firstname:'first_name',lastname:'last_name',linkedin:'url',linkedinurl:'url',linkedinprofile:'url',url:'url',email:'email',emailaddress:'email',phone:'phone',phonenumber:'phone',title:'title',currenttitle:'title',company:'company',currentcompany:'company',rationale:'rationale'};
 const keys=grid[0].map(v=>aliases[String(v??'').toLowerCase().replace(/[^a-z]/g,'')]||'');
 for(const k of ['first_name','last_name','url'])if(!keys.includes(k))throw new Error('Required columns: First Name, Last Name, LinkedIn URL.');
 if(keys.filter(Boolean).length!==new Set(keys.filter(Boolean)).size)throw new Error('Remove duplicate columns.');
 const rows=grid.slice(1).filter(r=>r.some(v=>String(v??'').trim())).map((r,i)=>Object.fromEntries([['row',i+2],...keys.flatMap((k,j)=>k?[[k,String(r[j]??'').trim()]]:[])]));
 if(!rows.length||rows.length>500)throw new Error('Import 1–500 candidates at a time.');return rows;
}
export function planCandidates(rows:any[],existing:any[]){
 if(!Array.isArray(rows)||!rows.length||rows.length>500)throw new Error('Import 1–500 candidates at a time.');
 const byUrl=new Map(existing.map(c=>[linkedinKey(c.url),c]));const seen=new Set<string>();return rows.map((r,i)=>{try{
 const url=linkedin(r.url),first_name=String(r.first_name||'').trim(),last_name=String(r.last_name||'').trim(),email=String(r.email||'').trim();
 if(!first_name||!last_name)throw new Error('First name and last name are required.');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Invalid email.');
 const candidate=byUrl.get(url),duplicate=seen.has(url);seen.add(url);
 return {...r,url,first_name,last_name,email,existingId:candidate?.id,status:duplicate?'Duplicate in file':candidate?'Reuse existing':'Create new'};
 }catch(e:any){throw new Error('Row '+(r.row||i+2)+': '+e.message);}});
}
