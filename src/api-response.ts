export async function apiResponse(response:Response):Promise<any>{
 const text=await response.text();
 try{return JSON.parse(text);}catch{
  const status=response.status,reference=response.headers.get('cf-ray');
  throw new Error(`The server returned an unexpected response (HTTP ${status}). Please retry.${reference?' Reference: '+reference:''}`);
 }
}
