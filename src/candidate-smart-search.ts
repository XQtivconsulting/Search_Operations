import {canonicalGeography,geographyMatches,geographyValues} from './candidate-geography';
import {filterText,matchesFilter} from './filter-values';
type R=Record<string,any>;
export type CandidateQuery={terms:string;geography:string[];compensation?:{currency:string;limit:number;direction:'below'|'above'};labels:string[];warning?:string};
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const amount=(n:string,unit:string)=>Number(n.replace(/,/g,''))*({k:1000,thousand:1000,m:1e6,million:1e6,b:1e9,billion:1e9,lakh:1e5,crore:1e7}[unit.toLowerCase()]||1);
export function parseCandidateQuery(query:string,records:R[]=[]):CandidateQuery {
 let rest=query.toLowerCase();const result:CandidateQuery={terms:'',geography:[],labels:[]};
 const money=rest.match(/(?:compensation|salary|pay|ote)\s*(?:(?:of|is|at)\s+)?(less than|under|below|more than|over|above)\s*(usd|inr|gbp|\$|£|₹)?\s*([\d,]+(?:\.\d+)?)\s*(thousand|million|billion|lakh|crore|k|m|b)?(?:\s*(usd|inr|gbp|dollars|pounds|rupees))?\b/i);
 if(money){
  const raw=money[2]||money[5],currency=raw?({$: 'USD','£':'GBP','₹':'INR',dollars:'USD',pounds:'GBP',rupees:'INR'}[raw]||raw.toUpperCase()):'';
  if(!currency)result.warning='Specify USD, GBP or INR for the compensation limit.';
  else {result.compensation={currency,limit:amount(money[3],money[4]||''),direction:/less|under|below/.test(money[1])?'below':'above'};rest=rest.replace(money[0],' ');result.labels.push(`Compensation ${result.compensation.direction} ${currency} ${result.compensation.limit.toLocaleString('en-US')}`);}
 }
 const locations=[...geographyValues,...records.filter(r=>r.kind==='candidate').flatMap(r=>r.tag_values?.geography||[]),'USA','US','UK','UAE'];
 for(const location of [...new Set(locations)].sort((a,b)=>b.length-a.length)){
  // Short country codes require a location cue: "find us candidates" is not geography.
  const pattern=new RegExp((location.length<=3?'\\b(?:in|from|based in|located in)\\s+(?:the\\s+)?':'\\b')+escape(location)+'\\b','i');
  if(pattern.test(rest)){const canonical=canonicalGeography(location);result.geography.push(canonical);rest=rest.replace(pattern,' ');result.labels.push(`Geography: ${canonical}`);}
 }
 rest=rest.replace(/\b(?:find|show|give|list)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(?:candidates?|people|profiles?)\b/g,' ').replace(/\b(?:candidates?|profiles?)\b/g,' ').replace(/\b(?:who are|who have|based in|located in|with a|with|in the|in|from|and|of|the|all)\b/g,' ');
 result.terms=filterText(rest);
 if(result.terms)result.labels.push(`Text: ${result.terms}`);
 if(result.compensation)result.labels.push('Known compensation bands only; overlapping bands excluded');
 return result;
}
function compensationBand(value:string){
 const m=value.match(/^(USD|GBP|INR)\s+OTE\s+(.+)$/i);if(!m)return null;
 const parts=m[2].match(/^(<)?([\d.]+)(?:[–-]([\d.]+))?\s*(k|m|lakh|crore)?(\+)?$/i);
 if(parts){const unit=parts[4]||'',a=amount(parts[2],unit),b=parts[3]?amount(parts[3],unit):undefined;return {currency:m[1].toUpperCase(),low:parts[1]?0:a,high:parts[1]?a:b??Infinity};}
 const mixed=m[2].match(/^([\d.]+)\s*(k|m|lakh|crore)[–-]([\d.]+)\s*(k|m|lakh|crore)$/i);
 return mixed?{currency:m[1].toUpperCase(),low:amount(mixed[1],mixed[2]),high:amount(mixed[3],mixed[4])}:null;
}
export function matchesCandidateQuery(c:R,searchable:string,q:CandidateQuery){
 if(q.warning)return false;
 if(q.geography.length&&!q.geography.some(g=>(c.tag_values?.geography||[]).some((v:string)=>geographyMatches(v,g))))return false;
 if(q.compensation){const constraint=q.compensation,bands=(c.tag_values?.compensation||[]).map(compensationBand);if(!bands.length||!bands.every((b:ReturnType<typeof compensationBand>)=>b&&b.currency===constraint.currency&&(constraint.direction==='below'?b.high<=constraint.limit:b.low>constraint.limit)))return false;}
 return matchesFilter(searchable,q.terms);
}
