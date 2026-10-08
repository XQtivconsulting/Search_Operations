import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCandidateAI} from '../src/candidate-ai';
test('AI synthesis combines sources and only retains tags with exact source evidence',async()=>{
 let prompt='';const ai={run:async(_model:string,input:any)=>{prompt=input.messages[1].content;return {response:JSON.stringify({summary:'Alex leads enterprise sales for healthcare clients. Their experience includes building a global commercial team and expanding major accounts, with a recent move into a broader leadership remit.',review_notes:['Confirm the effective date of the latest promotion.'],suggestions:[{category:'industry',value:'Healthcare',source_id:'1',evidence:'I lead healthcare sales.'},{category:'expertise',value:'Enterprise Sales',source_id:'2',evidence:'Invented supporting quotation.'}]})};}};
 const result=await generateCandidateAI(ai,[{name:'Resume',text:'I lead healthcare sales.'},{name:'Follow-up',text:'My title changed last month to commercial director.'}],[],'Alex');
 assert.ok(prompt.includes('Resume')&&prompt.includes('Follow-up'));assert.equal(result.method,'ai-synthesis-v1');assert.equal(result.suggestions.length,1);assert.equal(result.review_notes.length,1);
});
test('AI generation fails explicitly without configuration or valid model output',async()=>{
 await assert.rejects(generateCandidateAI(undefined,[{name:'Note',text:'A professional background description.'}],[],'Alex'),/not configured/);
 await assert.rejects(generateCandidateAI({run:async()=>({response:'bad json'})},[{name:'Note',text:'A professional background description.'}],[],'Alex'),/unreadable/);
});
test('long histories include every source in staged synthesis',async()=>{
 const seen=new Set<string>();let calls=0;const ai={run:async(_model:string,input:any)=>{calls++;const body=JSON.parse(input.messages[1].content);for(const e of body.evidence)if(e.source_id)seen.add(e.source_id);return {response:JSON.stringify(input.messages[0].content.includes('"facts":string')?{facts:'Candidate led a global business. Sources 1, 2, 3.',uncertainties:''}:{summary:'Alex leads a global business with responsibility for commercial growth and delivery teams. Their career combines account ownership with experience building customer relationships across multiple markets.',suggestions:[],review_notes:[]})};}};
 await generateCandidateAI(ai,[1,2,3].map(i=>({name:'Transcript '+i,text:('Source '+i+' discussion of professional responsibilities. ').repeat(600)})),[],'Alex');
 assert.deepEqual([...seen].sort(),['1','2','3']);assert.ok(calls>1);
});
