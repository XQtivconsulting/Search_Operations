import {locationText,locationShard,matchingLocations,type LocationIndex,type LocationEntry} from './geography-catalog';
import {geographyValues,canonicalGeography,geographyCode} from './candidate-geography';
import {requireThat} from './domain';
export type GeographyChoice={label:string;expires:number;signature:string};
export type CatalogLoader=(key:string)=>Promise<any>;
export async function lookupGeography(query:string,load:CatalogLoader){
 requireThat(typeof query==='string'&&query.trim().length>=2&&query.length<=120,'Enter a city, state or country (2–120 characters).');
 const q=query.trim(),country=canonicalGeography(q),countryExact=geographyCode(country)!==country;
 try{
  const index=await load('index') as LocationIndex,key=locationShard(q);
  const cities=index.shards.includes(key)?await load(key) as LocationEntry[]:[];
  const countries=geographyValues.filter(v=>!v.startsWith('US ')&&!['Europe','Middle East','Asia Pacific'].includes(v)&&(locationText(v).startsWith(locationText(q))||locationText(geographyCode(v))===locationText(q)));
  const matches=matchingLocations([...index.states,...cities],q);
  return [...new Set([...(countryExact?[country]:[]),...countries,...matches])].slice(0,12);
 }catch{if(countryExact)return [country];throw Object.assign(new Error('Location catalog is unavailable. Your existing locations are unchanged; please try again.'),{status:503});}
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
