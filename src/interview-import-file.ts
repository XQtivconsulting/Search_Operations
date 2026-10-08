import {str,importDate} from './mapping-import-file';
export const interviewImportHeaders=['Search ID','Candidate Name','LinkedIn URL','Job Name','Company Name','Interview Round','Interview Date','Interview Status','Feedback Outcome','Feedback Notes','Interviewer Name','Date Recommendation Submitted','Next Step','Next Step Date','Partner Point of Contact','Date Cancelled'];
export function parseCSV(input:string):string[][]{
 const source=input.replace(/^\uFEFF/,'').replace(/^ListSchema=.*(?:\r?\n|$)/,'');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else cell+=c;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('CSV has an unclosed quoted field.');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export function interviewRows(grid:any[][]){
 const keys=(grid[0]||[]).map(str);for(const key of ['Candidate Name','Interview Round','Interview Status'])if(!keys.includes(key))throw Error('Missing column: '+key);
 if(!keys.includes('Search ID')&&!(keys.includes('Job Name')&&keys.includes('Company Name')))throw Error('Include Search ID or Job Name and Company Name.');
 if(new Set(keys.filter(Boolean)).size!==keys.filter(Boolean).length)throw Error('Remove duplicate column headers.');
 const rows=grid.slice(1).flatMap((cells,i)=>cells.some(v=>str(v))?[Object.fromEntries([['row',i+2],...keys.filter(Boolean).map(k=>{const v=cells[keys.indexOf(k)];return[k,v instanceof Date?v.toISOString():str(v)];})])]:[]);
 if(!rows.length||rows.length>5000)throw Error('Upload 1–5,000 interview rows per file.');return rows;
}
export const importKey=(r:Record<string,any>)=>JSON.stringify([r['Search ID']||'',r['Job Name']||'',r['Company Name']||'',r['Candidate Name']||''].map(v=>str(v).toLowerCase().replace(/\s+/g,' ')));
export function interviewDate(value:unknown){const s=str(value);return importDate(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(s)?s.slice(0,10):s);}
