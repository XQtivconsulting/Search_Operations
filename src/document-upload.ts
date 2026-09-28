import {pdfLines,layoutDocument,freshDocumentPage,DocumentLine} from './document-layout';
export async function documentPage(file:File){
 if(file.size>10e6)throw new Error('Use a document under 10 MB.');
 const data=await file.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(b=>b.toString(16).padStart(2,'0')).join('');let lines:DocumentLine[]=[];
 if(/\.docx$/i.test(file.name)){
  const mammoth=await import('mammoth');
  // Conversion HTML is parsed only for text and structural tags, never injected.
  // Embedded images are ignored and document-supplied style maps are disabled.
  const result=await mammoth.convertToHtml({arrayBuffer:data},{includeEmbeddedStyleMap:false,externalFileAccess:false,convertImage:mammoth.images.imgElement(async()=>({src:''}))});
  const dom=new DOMParser().parseFromString(result.value,'text/html');let y=10000;
  for(const el of dom.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li')){if(el.tagName==='P'&&el.closest('li'))continue;const copy=el.cloneNode(true) as Element;if(el.tagName==='LI')copy.querySelectorAll('ul,ol').forEach(n=>n.remove());const value=copy.textContent?.trim();if(!value)continue;const heading=/^H[1-6]$/.test(el.tagName),size=el.tagName==='H1'?26:heading?18:12;lines.push({text:(el.tagName==='LI'?'• ':'')+value,x:50,y:y-=heading?32:24,width:480,size,bold:heading,page:1,heading,breakBefore:true});}
 }else if(/\.pdf$/i.test(file.name)){
  const pdfjs=await import('pdfjs-dist');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const task=pdfjs.getDocument({data:new Uint8Array(data),useSystemFonts:true});
  try{const pdf=await task.promise;if(pdf.numPages>80)throw new Error('Use a role document with up to 80 pages.');for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),content=await page.getTextContent();const extracted=pdfLines(content.items,content.styles,p);if(!extracted.length)throw new Error(`Page ${p} has no selectable text. Apply OCR first so its content is not omitted.`);lines.push(...extracted);}}finally{await task.destroy();}
 }else throw new Error('Upload a Word .docx or text-based PDF. Save older .doc files as .docx first.');
 const result=layoutDocument(lines);if(result.source_text.trim().length<30)throw new Error('Not enough selectable text found. Scanned PDFs need OCR first.');
 if(result.source_text.length>80000)throw new Error('Use a shorter document (under 80,000 text characters).');
 return freshDocumentPage(result,file.name,hash);
}
export async function documentSections(file:File){return (await documentPage(file)).sections;}
