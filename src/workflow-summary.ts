type R=Record<string,any>;
export function workflowSummary(data:R,now=Date.now()) {
 const records:R[]=data.research?.records||[];
 return data.searches.map((role:R)=>{
  const targets=records.filter(r=>r.kind==='target'&&r.role_id===role.id),mappings=records.filter(r=>r.kind==='mapping'&&r.role_id===role.id),submitted=mappings.filter(m=>m.submitted_at),peer=mappings.filter(m=>m.status==='Peer review'),partner=mappings.filter(m=>m.status==='Partner review');
  const completed=targets.filter(t=>['Completed','No relevant talent'].includes(t.status)).length;
  const withMappings=targets.filter(t=>submitted.some(m=>m.target_id===t.id)).length;
  const waiting=[...peer,...partner],oldest=waiting.length?Math.max(...waiting.map(m=>{const n=Date.parse(m.stage_at);return Number.isFinite(n)?Math.max(0,Math.floor((now-n)/86400000)):0;})):0;
  const unassigned=targets.filter(t=>!t.owner_id&&!['Completed','No relevant talent'].includes(t.status)).length,blocked=targets.filter(t=>t.status==='Blocked').length,returned=mappings.filter(m=>['Needs information','Hold'].includes(m.status)).length;
  const bottlenecks:string[]=[];
  if(!role.partner_id)bottlenecks.push('Engagement partner needed');
  if(!records.some(r=>r.kind==='strategy'&&r.role_id===role.id&&r.active))bottlenecks.push('Strategy approval needed');
  if(unassigned)bottlenecks.push(`${unassigned} ${unassigned===1?'company needs':'companies need'} a researcher`);
  if(blocked)bottlenecks.push(`${blocked} ${blocked===1?'company is':'companies are'} blocked`);
  if(peer.length)bottlenecks.push(`${peer.length} awaiting team review`);
  if(partner.length)bottlenecks.push(`${partner.length} awaiting partner review`);
  if(returned)bottlenecks.push(`${returned} returned / on hold`);
  return {role,targets:targets.length,completed,noTalent:targets.filter(t=>t.status==='No relevant talent').length,withMappings,submitted:submitted.length,drafts:mappings.filter(m=>m.status==='Draft').length,approved:mappings.filter(m=>m.status==='Approved').length,peer:peer.length,partner:partner.length,oldest,bottlenecks,direct:submitted.filter(m=>!m.target_id).length};
 });
}
