import React,{useEffect,useState} from 'react';
type R=Record<string,any>;
export function RoleBriefEditor({data,role,manager,api,onDirty}:{data:R;role:string;manager:boolean;api:(p:string,b?:unknown)=>Promise<any>;reload:()=>Promise<void>;onDirty:(v:boolean)=>void}){
 const records:R[]=data.research?.records||[];
 const canUpload=manager||records.some(t=>t.kind==='task'&&t.role_id===role&&t.owner_id===data.actor.id&&t.task_type==='Role brief'&&t.status!=='Cancelled');
 const [files,setFiles]=useState<R[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');api('research',{action:'brief-file-list',role_id:role}).then(v=>{if(active)setFiles(v)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[role]);
 useEffect(()=>{onDirty(busy);return()=>onDirty(false)},[busy]);
 async function saveFile(file:File){setBusy(true);setError('');setNotice('');try{
  if(!/\.(pdf|docx|doc)$/i.test(file.name))throw new Error('Choose a PDF or Word document.');
  if(file.size>5*1024*1024)throw new Error('Upload a file up to 5 MB.');
  const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});
  await api('research',{action:'brief-file-save',role_id:role,name:file.name,base64});
  setFiles(await api('research',{action:'brief-file-list',role_id:role}));setNotice('Job description saved.');
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function downloadFile(file:R){setBusy(true);setError('');try{
  const result=await api('research',{action:'brief-file-read',role_id:role,file_id:file.id});
  const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(result.base64),(c:string)=>c.charCodeAt(0))],{type:result.mime}));
  const link=document.createElement('a');link.href=url;link.download=result.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="panel role-brief-workspace"><div className="section-head"><div><h2>Job description</h2><p>Upload and download the original PDF or Word documents for this search.</p></div></div>
 {canUpload&&<div className="brief-actionbar"><label className="brief-upload">Upload PDF / Word<input type="file" aria-label="Upload job description" accept=".pdf,.docx,.doc" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void saveFile(file);e.target.value=''}}/></label><span className="fine">Up to 5 MB per file</span></div>}
 {loading?<p className="fine">Loading documents…</p>:files.length?files.map(file=><div className="work-row" key={file.id}><strong style={{overflowWrap:'anywhere',minWidth:0}}>{file.name}</strong><button disabled={busy} onClick={()=>downloadFile(file)}>Download original</button></div>):!error&&<p className="sheet-empty">No job description uploaded yet.</p>}
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
