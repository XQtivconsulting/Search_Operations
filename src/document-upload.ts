import {sectionsFromText,PageSection} from './role-page';
export async function documentSections(file:File):Promise<PageSection[]> {
 if(file.size>10e6)throw new Error('Use a document under 10 MB.');
 const data=await file.arrayBuffer();let sections:PageSection[]=[];
 if(/\.docx$/i.test(file.name)){
  const mammoth=await import('mammoth');
  // Raw text avoids document-supplied HTML, images, scripts and external links.
  const result=await mammoth.extractRawText({arrayBuffer:data});sections=sectionsFromText(result.value);
 }else if(/\.pdf$/i.test(file.name)){
  const pdfjs=await import('pdfjs-dist');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const task=pdfjs.getDocument({data:new Uint8Array(data),useSystemFonts:true});
  const pdf=await task.promise;try{if(pdf.numPages>80)throw new Error('Use a role document with up to 80 pages.');let output='';for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),content=await page.getTextContent();let lastY:number|undefined;for(const item of content.items){if('str' in item){const y=item.transform[5];if(lastY!==undefined&&Math.abs(y-lastY)>3)output+='\n';output+=item.str+(item.hasEOL?'\n':' ');lastY=y;}}output+='\n\n';}sections=sectionsFromText(output);}finally{await task.destroy();}
 }else throw new Error('Upload a Word .docx or text-based PDF. Save older .doc files as .docx first.');
 if(!sections.some(s=>s.body.trim().length>30))throw new Error('No usable document text found. Scanned PDFs need OCR first.');
 if(JSON.stringify(sections).length>80000)throw new Error('Use a shorter document (under 80,000 text characters).');return sections;
}
