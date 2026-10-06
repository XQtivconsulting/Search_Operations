// Synthetic inputs only. Never send workspace records or print credentials.
import {generateCandidateAI,summaryModel} from '../src/candidate-ai.ts';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Cloudflare deployment credentials are unavailable.');
const ai={run:async(model,input)=>{
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/run/${model}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(90000)});
 const body=await response.json();if(!response.ok||!body.success)throw Error(`Workers AI verification failed (${response.status}). Verify Workers AI access on the deployment token.`);return body.result;
}};
const result=await generateCandidateAI(ai,[
 {name:'Synthetic resume, 2024',text:'Alex Example was Sales Director at Fictional Helix in 2024. Alex owned a $5 million healthcare services portfolio and led four salespeople.'},
 {name:'Synthetic interview, 2025',text:'Interviewer: At my firm I manage 500 employees. Alex: In 2025 I grew my healthcare portfolio at Fictional Helix from $5 million to $18 million and expanded my sales team to twelve people. I originated two hospital-system accounts.'},
 {name:'Synthetic follow-up, 2026',text:'Alex: In January 2026 I was promoted from Sales Director to Vice President of North America Sales at Fictional Helix. My team remains twelve people. I am interested in a broader commercial leadership role. My compensation expectation is $700,000; that is private.'}
],[],'Alex Example');
if(!/vice president|\bVP\b/i.test(result.summary)||/500 employees|700,?000/.test(result.summary))throw Error('AI synthesis did not reconcile the updated title or separate private/interviewer information.');
console.log(`Verified real AI synthesis with ${summaryModel} using three synthetic sources.`);
console.log('Synthetic executive summary: '+result.summary);
