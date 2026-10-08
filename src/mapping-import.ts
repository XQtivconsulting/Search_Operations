import type {ImportLocationMatches} from './mapping-locations';
import {linkedin,linkedinKey} from './candidate-identity';
import {hasPermission} from './access-policy';
import {requireThat} from './domain';
import {createHash} from 'node:crypto';
type R=Record<string,any>;
import {str,importDate,mappingCandidateName} from './mapping-import-file';
const norm=(v:unknown)=>str(v).toLowerCase().replace(/\s+/g,' ');
function decision(v:unknown,team=false){const s=norm(v);if(!s||['pending','not reviewed'].includes(s))return '';if(team&&['skipped','not required','n/a'].includes(s))return '';if(['yes','approve','approved'].includes(s))return 'Approve';if(['no','reject','rejected'].includes(s))return 'Reject';if(['maybe','needs information','hold'].includes(s))return 'Needs information';throw Error('Review must be Yes, No, Maybe or Pending (team review may be Skipped).');}
export function planHistoricalMappings(rows:R[],searches:R[],records:R[],members:R[],staff:R[],locations:ImportLocationMatches={}):R[]{
 requireThat(Array.isArray(rows)&&rows.length>0&&rows.length<=500,'Import 1–500 mappings.');
 const candidates=records.filter(r=>r.kind==='candidate'),seen=new Map<string,string>(),filePeople=new Map<string,R>(),fileEmails=new Map<string,string>();
 const named=(label:string,list:R[])=>list.filter(p=>norm(p.name)===norm(label)||p.email&&norm(p.email)===norm(label)||p.id===label);
 return rows.map((raw,index)=>{const out:R={row:raw.row||index+2,search_number:raw.search_number,name:[raw.first_name,raw.last_name].filter(Boolean).join(' ')||raw.name||'',warnings:[],options:[]};try{
  if(Object.values(raw).some(v=>str(v).length>20000))throw Error('Cell exceeds 20,000 characters.');
  if(raw.choice==='skip')return {...out,result:'Skip',candidate_result:'Skipped'};
  const n=Number(raw.search_number),matches=searches.filter(s=>s.search_number===n);if(!Number.isSafeInteger(n)||n<1||matches.length!==1)throw Error('Search ID must match one imported search.');
  const search=matches[0],url=linkedin(raw.url),mapped_on=importDate(raw.mapped_on,true),mapped_by=str(raw.mapped_by);if(!mapped_by)throw Error('Researcher Name is required.');
  const {first_name,last_name}=mappingCandidateName(raw);if(!first_name)throw Error('Candidate name is required.');
  const email=str(raw.email);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid email.');
  if(email&&fileEmails.has(norm(email))&&fileEmails.get(norm(email))!==url)throw Error('One email is associated with different LinkedIn URLs in this file.');if(email)fileEmails.set(norm(email),url);
  let location=str(raw.location);out.source_location=location;
  if(location){const query=str(raw.location_query)||location,match=locations[query];out.location_query=query;out.location_options=match?.options||[];
   if(raw.location_choice==='blank')location='';
   else if(raw.location_choice){if(!out.location_options.includes(raw.location_choice))throw Error('Location selection changed. Choose a location from the preview.');location=raw.location_choice;}
   else if(out.location_options.length===1)location=out.location_options[0];
   else{out.needs_location=true;out.needs_choice=true;out.warnings.push(match?.error||(!out.location_options.length?'Location not found. Refine the location search.':'Several locations match. Confirm the city, state and country.'));}
  }
  out.normalized_location=out.needs_location?'':location;
  const profile={first_name,last_name,name:[first_name,last_name].filter(Boolean).join(' '),url,email,company:str(raw.company),title:str(raw.title),location};
  const exact=candidates.filter(c=>linkedinKey(c.url)===url||email&&norm(c.email)===norm(email));
  if(exact.length>1)throw Error('Conflicting existing candidate identities. Resolve duplicates before import.');
  const suggestions=exact.length?exact:candidates.filter(c=>norm(c.name)===norm(profile.name));
  out.options=suggestions.map(c=>({id:c.id,name:c.name,company:c.company,url:c.url}));
  let candidate:R|undefined=exact[0];
  if(raw.choice?.startsWith('reuse:')){candidate=candidates.find(c=>c.id===raw.choice.slice(6));if(!candidate||!suggestions.some(c=>c.id===candidate?.id))throw Error('Candidate match changed. Preview again.');if(linkedinKey(candidate.url)&&linkedinKey(candidate.url)!==url)throw Error('LinkedIn differs from selected candidate. Correct the file or resolve the identity first.');}
  if(raw.choice==='new'&&exact.length)throw Error('This LinkedIn or email already exists. Reuse the existing candidate.');
  if(suggestions.length&&!raw.choice)out.needs_choice=true;
  const tm=decision(raw.team_review,true),pm=decision(raw.partner_review),td=importDate(raw.team_review_date),pd=importDate(raw.partner_review_date),tr=str(raw.team_reviewer),pr=str(raw.partner_reviewer);
  for(const [d,who,date,label] of [[tm,tr,td,'Team'],[pm,pr,pd,'Partner']]){if(d&&(!who||!date))throw Error(`${label} decision requires reviewer and review date.`);if(!d&&(who||date))throw Error(`${label} review date/reviewer requires a decision.`);if(date&&date<mapped_on)throw Error(`${label} review precedes mapping date.`);}
  if(td&&pd&&pd<td)throw Error('Partner review precedes team review.');
  const people=named(mapped_by,members),staffMatches=named(mapped_by,staff);if(people.length>1||staffMatches.length>1)throw Error('Researcher name is ambiguous. Use a unique staff ID.');
  const staffId=people[0]?.staff_id||people[0]?.staffId||staffMatches[0]?.id||'',mapper=people[0]||members.find(p=>(p.staff_id||p.staffId)===staffId);
  if(!staffId)out.warnings.push('Researcher retained by name; no staff credit until identity is resolved.');
  const reviewer=(label:string)=>{const found=named(label,members);if(found.length>1)throw Error('Reviewer name is ambiguous. Use a unique member ID.');if(label&&!found.length)out.warnings.push(`Historical reviewer retained: ${label}`);return found[0]?.id||'';};
  const teamReviewer=reviewer(tr),partnerReviewer=reviewer(pr);
  const status=pm==='Approve'?'Approved':pm==='Reject'?'Rejected':pm==='Needs information'?'Needs information':tm==='Reject'?'Rejected':tm==='Needs information'?'Needs information':'Partner review';
  const data={...profile,source_location:str(raw.location),mapped_by,mapped_on,notes:str(raw.notes),team_decision:tm,team_reviewer:tr,team_reviewer_id:teamReviewer,team_review_date:td,partner_decision:pm,partner_reviewer:pr,partner_reviewer_id:partnerReviewer,partner_review_date:pd,status,staff_id:staffId,mapper_id:mapper?.id||''};
  const identity=candidate?.id||url,key=search.id+':'+identity,existing=records.find(r=>r.kind==='mapping'&&r.role_id===search.id&&r.candidate_id===candidate?.id),fingerprint=JSON.stringify(data);
  if(seen.has(key)&&seen.get(key)!==fingerprint)throw Error('Conflicting rows for the same candidate and search. Keep one final historical record.');
  const enrich=existing?.source==='SharePoint'&&existing.status==='Imported'&&!existing.submitted_at&&!existing.partner_decision&&!existing.peer_decision;
  if(enrich)out.warnings.push('Adds sourcing history to the existing interview search link.');
  const duplicate=seen.has(key);seen.set(key,fingerprint);
  const prior=filePeople.get(url);if(prior&&['name','email','company','title','location'].some(k=>prior[k]&&profile[k as keyof typeof profile]&&norm(prior[k])!==norm(profile[k as keyof typeof profile])))throw Error('Conflicting candidate details across rows in this file.');filePeople.set(url,{...prior,...Object.fromEntries(Object.entries(profile).filter(([,v])=>v))});
  const fill=candidate?Object.keys(profile).filter(k=>!candidate[k]&&profile[k as keyof typeof profile]):[];
  const differing=candidate?Object.keys(profile).filter(k=>candidate[k]&&profile[k as keyof typeof profile]&&norm(candidate[k])!==norm(profile[k as keyof typeof profile])&&k!=='url'):[];
  if(differing.length)out.warnings.push('Existing values kept: '+differing.join(', '));
  return {...out,name:profile.name,url,role_id:search.id,search_title:search.title,existing_id:candidate?.id||'',fill,data,candidate_result:candidate?'Reuse existing candidate':prior?'Reuse candidate from file':'Create candidate',existing_mapping_id:enrich?existing.id:'',result:existing&&!enrich?'Existing mapping — keep unchanged':duplicate?'Duplicate row — skip':'Create mapping',needs_choice:existing&&!enrich||duplicate?false:out.needs_choice};
 }catch(e:any){return {...out,result:'Error',error:e.message};}});
}
export function importHistoricalMappings(db:any,a:any,b:R,members:R[]){
 requireThat(hasPermission(a,'integrations.manage'),'Manage integrations permission required.',403);
 const records=db.rows('SELECT * FROM research_records').map((r:R)=>({...JSON.parse(r.data),id:r.id,kind:r.kind,role_id:r.role_id,version:r.version})),searches=db.rows('SELECT * FROM searches'),staff=db.rows('SELECT * FROM staff');
 const manual=db.rows('SELECT e.*,a.search_id,a.work_date FROM entries e JOIN assignments a ON a.id=e.assignment_id WHERE COALESCE(e.mapped,0)>0 OR COALESCE(e.peer,0)>0 OR COALESCE(e.partner,0)>0');
 const plan=planHistoricalMappings(b.rows,searches,records,members,staff,b.location_matches||{});
 for(const p of plan)if(p.result==='Create mapping'&&manual.some((e:R)=>e.search_id===p.role_id&&e.work_date===p.data.mapped_on&&(!p.data.staff_id||e.staff_id===p.data.staff_id))){p.result='Error';p.error='Recorded aggregate output overlaps this mapping date and researcher. Reconcile those counts before importing individual history.';}
 const signature=createHash('sha256').update(JSON.stringify({plan,versions:records.map((r:R)=>[r.id,r.version]).sort(),searches,members,staff,manual})).digest('hex');
 if(b.preview)return {plan,signature};
 requireThat(signature===b.signature,'Data changed. Preview the file again.',409);
 requireThat(!plan.some((p:R)=>p.error||p.needs_choice),'Resolve every error and candidate match before importing.');
 const now=new Date().toISOString(),run=crypto.randomUUID(),result={created:0,reused:0,mapped:0,skipped:0};
 const save=(kind:string,role:string,key:string,data:R,old?:R)=>{const id=old?.id||crypto.randomUUID();db.rows('INSERT INTO research_records(id,kind,role_id,record_key,data,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version',id,kind,role,key,JSON.stringify(data),(old?.version||0)+1);db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,a.id,'historical-mapping-import',JSON.stringify({before:old||null,after:data,import_run:run}),now);db.audit(a,'historical-mapping-import',id,old||null,data);return {...data,id,kind,role_id:role,version:(old?.version||0)+1};};
 const byId=new Map<string,R>(records.filter((r:R)=>r.kind==='candidate').map((r:R)=>[r.id,r]));
 const cache=new Map(records.filter((r:R)=>r.kind==='candidate').map((r:R)=>[linkedinKey(r.url),r]));
 for(const p of plan){if(p.result!=='Create mapping'){result.skipped++;continue;}const d=p.data;let c:R|undefined=p.existing_id?byId.get(p.existing_id):cache.get(d.url) as R|undefined;
  const profile=Object.fromEntries(['first_name','last_name','name','url','email','company','title','location'].map(k=>[k,d[k]]));
  if(c){const fill=Object.fromEntries(Object.entries(profile).filter(([k,v])=>!c![k]&&v));if(d.location&&(!c.location||c.location===d.location)&&!c.tag_values?.geography?.length)fill.tag_values={...c.tag_values,geography:[d.location]};if(Object.keys(fill).length)c=save('candidate','',linkedinKey(c.url)||d.url,{...c,...fill},c);result.reused++;}else{c=save('candidate','',d.url,{...profile,...(d.location?{tag_values:{geography:[d.location]}}:{}),created_at:now,source:'Historical mapping import'});result.created++;}cache.set(d.url,c);byId.set(c.id,c);
  const at=(date:string)=>date+'T12:00:00.000Z';
  const mapping={candidate_id:c.id,name:d.name,url:d.url,title:d.title,company:d.company,location:d.location,rationale:d.notes,status:d.status,mapper_id:d.mapper_id,mapper_name:d.mapped_by,staff_id:d.staff_id,team_id:'',work_date:d.mapped_on,created_at:at(d.mapped_on),submitted_at:at(d.mapped_on),stage_at:at(d.partner_review_date||d.team_review_date||d.mapped_on),peer_decision:d.team_decision,peer_reviewed_by:d.team_reviewer_id,peer_reviewed_name:d.team_reviewer,peer_reviewed_at:d.team_review_date?at(d.team_review_date):null,partner_decision:d.partner_decision,partner_reviewed_by:d.partner_reviewer_id,partner_reviewed_name:d.partner_reviewer,partner_reviewed_at:d.partner_review_date?at(d.partner_review_date):null,criteria_snapshot:[],evidence:{},source:'Historical Excel',source_location:d.source_location,import_run:run,imported_at:now,imported_by:a.id,team_review_skipped:!d.team_decision,cycle:1};
  const m=save('mapping',p.role_id,p.role_id+':'+c.id,mapping,records.find((r:R)=>r.id===p.existing_mapping_id));result.mapped++;
  for(const [stage,decision,who,actor,date] of [['Team',d.team_decision,d.team_reviewer,d.team_reviewer_id,d.team_review_date],['Partner',d.partner_decision,d.partner_reviewer,d.partner_reviewer_id,d.partner_review_date]])if(decision)db.rows('INSERT INTO research_events VALUES(?,?,?,?,?,?)',crypto.randomUUID(),m.id,a.id,'historical-review',JSON.stringify({stage,decision,reviewer_name:who,reviewer_id:actor,reviewed_on:date,imported_by:a.id,import_run:run}),at(date));
 }
 return {...result,import_run:run};
}
