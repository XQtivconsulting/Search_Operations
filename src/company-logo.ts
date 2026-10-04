import {requireThat} from './domain';
export async function companyLogo(domain:string,transport:typeof fetch=fetch){
 requireThat(domain.length<=253&&/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain),'Invalid company domain.');
 const r=await transport('https://icons.duckduckgo.com/ip3/'+encodeURIComponent(domain.toLowerCase())+'.ico',{redirect:'manual',signal:AbortSignal.timeout(5000)});
 const type=(r.headers.get('Content-Type')||'').split(';')[0];requireThat(r.ok&&['image/png','image/jpeg','image/x-icon','image/vnd.microsoft.icon','image/webp'].includes(type),'Logo unavailable.',404);
 requireThat(Number(r.headers.get('Content-Length')||0)<=100000,'Logo too large.',404);const bytes=await r.arrayBuffer();requireThat(bytes.byteLength<=100000,'Logo too large.',404);
 return new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'private, max-age=86400'}});
}
