import {lookupGeography,type CatalogLoader} from './geography-lookup';
import {requireThat} from './domain';
import {str} from './mapping-import-file';
export type ImportLocationMatches=Record<string,{options:string[];error?:string}>;
export async function mappingLocationMatches(rows:Record<string,any>[],load:CatalogLoader):Promise<ImportLocationMatches>{
 requireThat(Array.isArray(rows)&&rows.length>0&&rows.length<=500,'Import 1–500 mappings.');
 const queries=[...new Set(rows.filter(r=>r.choice!=='skip'&&str(r.location)&&r.location_choice!=='blank').map(r=>str(r.location_query)||str(r.location)))],result:ImportLocationMatches=Object.create(null),cache=new Map<string,Promise<any>>();
 const cached:CatalogLoader=key=>{if(!cache.has(key))cache.set(key,load(key));return cache.get(key)!;};
 let index=0;await Promise.all(Array.from({length:Math.min(4,queries.length)},async()=>{while(index<queries.length){const query=queries[index++];try{result[query]={options:await lookupGeography(query,cached)};}catch(e:any){result[query]={options:[],error:e.message};}}}));return result;
}
