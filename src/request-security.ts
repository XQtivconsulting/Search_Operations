import {requireThat} from './domain';
export async function readJSONBody(req:Request,max=8_000_000){
 requireThat(Number(req.headers.get('Content-Length')||0)<max,'Request is too large.',413);
 const reader=req.body?.getReader();if(!reader)throw Object.assign(new Error('Request body must be valid JSON.'),{status:400});
 const decoder=new TextDecoder(),parts:string[]=[];let size=0;
 try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>=max){await reader.cancel();throw Object.assign(new Error('Request is too large.'),{status:413});}parts.push(decoder.decode(value,{stream:true}));}parts.push(decoder.decode());}finally{reader.releaseLock();}
 let body:any;try{body=JSON.parse(parts.join(''));}catch{throw Object.assign(new Error('Request body must be valid JSON.'),{status:400});}
 requireThat(body&&typeof body==='object'&&!Array.isArray(body),'Request body must be an object.');return body;
}
