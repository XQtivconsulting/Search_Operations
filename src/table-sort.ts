export function compareTableValues(a:string|number|null|undefined,b:string|number|null|undefined,descending=false){
 const blank=(v:unknown)=>v===null||v===undefined||v==='';
 if(blank(a)||blank(b))return blank(a)===blank(b)?0:blank(a)?1:-1;
 const result=typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});
 return descending?-result:result;
}
