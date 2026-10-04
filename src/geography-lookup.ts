import {canonicalGeography,geographyCode} from './candidate-geography';
import {requireThat} from './domain';
export type GeographyChoice={label:string;expires:number;signature:string};
const cache=new Map<string,{until:number;labels:string[]}>();
// Only locality/state/country names are retained. Never return addresses or coordinates.
export function geographyLabels(data:any):string[]{
 const labels:string[]=[];
 for(const f of (Array.isArray(data?.features)?data.features:[]).slice(0,30)){
  const p=f?.properties||{},type=p.type||p.osm_value;
  if(!['city','town','village','municipality','hamlet','locality','state','province','country'].includes(type))continue;
  const clean=(v:unknown)=>typeof v==='string'?v.trim().replace(/\s+/g,' '):'';
  const name=clean(p.name),state=clean(p.state),code=clean(p.countrycode).toUpperCase(),country=canonicalGeography(code);
  if(!name||!country||country===code||!/^[A-Z]{2}$/.test(code))continue;
  const parts=type==='country'?[country]:['state','province'].includes(type)?[name,country]:[name,state,country];
  const label=[...new Set(parts.filter(Boolean))].join(', ');
  if(label.length<=200&&!labels.includes(label))labels.push(label);
 }
 return labels.slice(0,10);
}
export async function lookupGeography(query:string,transport:typeof fetch=fetch){
 requireThat(typeof query==='string'&&query.trim().length>=2&&query.length<=120,'Enter a city, state or country (2–120 characters).');
 const q=query.trim(),key=q.toLocaleLowerCase(),hit=cache.get(key);
 if(transport===fetch&&hit&&hit.until>Date.now())return hit.labels;
 const country=canonicalGeography(q);
 if(['United States','United Kingdom'].includes(country))return [country];
 const url=new URL('https://photon.komoot.io/api/');
 url.search=new URLSearchParams({q,lang:'en',limit:'10'}).toString();
 for(const layer of ['city','locality','state','country'])url.searchParams.append('layer',layer);
 try{
  const response=await transport(url,{redirect:'error',headers:{'Accept':'application/json','User-Agent':'XQtivSearchOperations/1.0 (location autocomplete)'},signal:AbortSignal.timeout(10000)});
  requireThat(response.ok,'Location lookup is unavailable. Try again shortly.',502);
  const body=await response.text();requireThat(body.length<=150000,'Location lookup response too large.',502);
  const labels=geographyLabels(JSON.parse(body));
  if(geographyCode(country)!==country&&!labels.includes(country))labels.push(country);
  if(transport===fetch){if(cache.size>=250)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+3600000,labels});}
  return labels;
 }catch{if(geographyCode(country)!==country)return [country];throw Object.assign(new Error('Location lookup is unavailable. Your existing locations are unchanged; try again shortly.'),{status:502});}
}
async function signingKey(session:string){return crypto.subtle.importKey('raw',new TextEncoder().encode(session),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
const payload=(tenant:string,label:string,expires:number)=>new TextEncoder().encode(JSON.stringify(['geography-v1',tenant,label,expires]));
export async function signGeography(label:string,session:string,tenant:string):Promise<GeographyChoice>{
 const expires=Date.now()+3600000,key=await signingKey(session),bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,payload(tenant,label,expires)));
 return {label,expires,signature:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')};
}
export async function verifyGeographies(input:unknown,session:string,tenant:string):Promise<string[]>{
 if(input===undefined)return [];
 requireThat(Array.isArray(input)&&input.length<=20,'Choose up to 20 locations.');
 const key=await signingKey(session),labels:string[]=[];
 for(const c of input as GeographyChoice[]){
  requireThat(c&&typeof c.label==='string'&&c.label.length<=200&&Number.isFinite(c.expires)&&c.expires>Date.now()&&c.expires<=Date.now()+3600000&&typeof c.signature==='string'&&/^[a-f0-9]{64}$/.test(c.signature),'Location selection expired. Search for the location again.',409);
  const bytes=Uint8Array.from(c.signature.match(/../g)!,s=>parseInt(s,16));
  requireThat(await crypto.subtle.verify('HMAC',key,bytes,payload(tenant,c.label,c.expires)),'Choose a location from the suggestions.',400);
  labels.push(c.label);
 }
 return labels;
}
