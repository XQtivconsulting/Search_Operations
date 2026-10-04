import {getCountries,getStatesOfCountry,getCitiesOfState} from '@countrystatecity/countries';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {locationText,locationShard} from '../src/geography-catalog.ts';
import {canonicalGeography} from '../src/candidate-geography.ts';
const directory=new URL('../public/geography/',import.meta.url),shards=new Map(),states=[],seen=new Set();
await mkdir(directory,{recursive:true});
for(const country of await getCountries()){
 const countryName=canonicalGeography(country.iso2),countryAliases=[country.iso2,country.iso3,country.name,countryName,country.iso2==='GB'?'UK Britain':''].join(' ');
 for(const state of await getStatesOfCountry(country.iso2)){
  const stateLabel=[state.name,countryName].join(', '),stateSearch=locationText([stateLabel,state.iso2,state.iso3166_2,countryAliases].join(' '));
  states.push([stateLabel,stateSearch,locationText(state.name),'state',locationText(state.iso2)]);
  for(const city of await getCitiesOfState(country.iso2,state.iso2)){
   const label=[...new Set([city.name,state.name,countryName])].join(', ');
   if(seen.has(label)||label.length>200)continue;seen.add(label);
   const shard=locationShard(city.name),entry=[label,locationText([label,state.iso2,state.iso3166_2,countryAliases].join(' ')),locationText(city.name),'city'];
   if(!shards.has(shard))shards.set(shard,[]);shards.get(shard).push(entry);
  }
 }
}
for(const [shard,entries] of shards)await writeFile(new URL(shard+'.json',directory),JSON.stringify(entries));
const metadata={source:'CountryStateCity / dr5hn, @countrystatecity/countries 1.0.9, ODbL-1.0',cities:seen.size,states,shards:[...shards.keys()].sort()};
await writeFile(new URL('index.json',directory),JSON.stringify(metadata));
await writeFile(new URL('LICENSE.txt',directory),await readFile(new URL('../node_modules/@countrystatecity/countries/LICENSE',import.meta.url)));
await writeFile(new URL('README.txt',directory),'Location catalog derived from https://github.com/dr5hn/countries-states-cities-database via @countrystatecity/countries 1.0.9. Adapted labels/search shards are provided under ODbL-1.0. Source and all adapted shards are publicly accessible here through index.json. Candidate data is separate and is not part of this catalog.\n');
if(!seen.has('North Caldwell, New Jersey, United States')||!seen.has('Lucknow, Uttar Pradesh, India'))throw new Error('Required locality regression examples missing from catalog.');
console.log(`Geography catalog: ${seen.size} cities, ${states.length} states/regions, ${shards.size} search shards.`);
