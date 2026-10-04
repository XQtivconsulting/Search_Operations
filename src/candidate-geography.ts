// Geography retains the selected locality and its administrative hierarchy.
const codes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
const names=new Intl.DisplayNames(['en'],{type:'region'});
const countries=codes.map(code=>({code:code==='GB'?'UK':code,name:names.of(code)||code}));
const norm=(v:string)=>v.trim().toLocaleLowerCase().replace(/\s+/g,' ');
const aliases=new Map<string,{code:string;name:string}>();
for(const c of countries){aliases.set(norm(c.code),c);aliases.set(norm(c.name),c);}
for(const [alias,target] of Object.entries({GB:'UK',USA:'US','U.S.':'US','U.S.A.':'US','UK':'UK','U.K.':'UK',Britain:'UK','Great Britain':'UK'})){const c=aliases.get(norm(target));if(c)aliases.set(norm(alias),c);}
export const geographyValues=[...countries.map(c=>c.name),'US Northeast','US Southeast','US Midwest','US West','US Texas','Europe','Middle East','Asia Pacific'];
export const canonicalGeography=(value:string)=>aliases.get(norm(value))?.name||value.trim();
export function geographyFullName(value:string){return /^US (Northeast|Southeast|Midwest|West|Texas)$/.test(value)?value.replace(/^US /,'United States — '):canonicalGeography(value);}
export function geographyCode(value:string){
 const parts=value.split(', ').map(s=>s.trim());
 if(parts.length>1){const country=aliases.get(norm(parts.at(-1)!));if(country)return [...parts.slice(0,-1),country.code].join(', ');}
 return aliases.get(norm(value))?.code||value;
}
export function geographyParents(value:string){
 const full=canonicalGeography(value),parts=full.split(', ');
 if(parts.length>1&&aliases.has(norm(parts.at(-1)!)))return parts.map((_,i)=>parts.slice(i).join(', '));
 return /^US (Northeast|Southeast|Midwest|West|Texas)$/.test(full)?[full,'United States']:[full];
}
export const geographyMatches=(value:string,selected:string)=>geographyParents(value).some(v=>norm(v)===norm(canonicalGeography(selected)));

export const geographySearchText=(value:string)=>[value,geographyFullName(value),geographyCode(value),geographyCode(value)==='UK'?'GB Britain Great Britain':''].join(' ');
export const geographyOptionLabel=(value:string)=>value?geographyCode(value)===geographyFullName(value)?value:`${geographyCode(value)} · ${geographyFullName(value)}`:'(Blank)';
