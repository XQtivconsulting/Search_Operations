import {companyValues} from './company-directory';
import {normTag} from './candidate-tags';
type R=Record<string,any>;
export function companyChildOptions(records:R[],industry:string[],sector=''){
 const selected=new Set(industry.map(normTag));
 const parents=records.filter(c=>c.kind==='company'&&companyValues(c,'industries').some(v=>selected.has(normTag(v))));
 const unique=(values:string[])=>[...new Map(values.filter(Boolean).map(v=>[normTag(v),v])).values()].sort((a,b)=>a.localeCompare(b));
 return {sectors:unique(parents.flatMap(c=>companyValues(c,'sector'))),subsectors:sector?unique(parents.filter(c=>normTag(c.sector||'')===normTag(sector)).flatMap(c=>companyValues(c,'subsector'))):[]};
}
