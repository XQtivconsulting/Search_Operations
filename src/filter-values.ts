// Match typed labels without making spelling guesses or changing stored values.
export function filterText(value: unknown) {
 return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
export function matchesFilter(value: unknown, query: string) {
 const text=filterText(value),terms=filterText(query).split(' ').filter(Boolean);
 return terms.every(term=>text.includes(term)) || text.replace(/ /g,'').includes(filterText(query).replace(/ /g,''));
}
export function toggleFilterValue(selected: string[]|null,value:string,checked:boolean) {
 const next=new Set(selected||[]);
 checked?next.add(value):next.delete(value);
 return [...next];
}
