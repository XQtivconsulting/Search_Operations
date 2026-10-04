import React,{useEffect,useState} from 'react';
import {Globe} from '@phosphor-icons/react';
export function CompanyWebsite({company,workspace='xqtiv'}:{company?:Record<string,any>;workspace?:string}){
 const [failed,setFailed]=useState(false);let href='',domain='';try{const u=new URL(company?.website||'');if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password){href=u.href;domain=u.hostname;}}catch{}
 useEffect(()=>setFailed(false),[domain]);
 return href?<a className="company-website-icon" href={href} target="_blank" rel="noopener noreferrer" aria-label={'Open '+company?.name+' website'} title={'Open '+company?.name+' website'}>{failed?<Globe size={14}/>:<img width={16} height={16} alt="" loading="lazy" src={'/api/company-logo?workspace='+encodeURIComponent(workspace)+'&domain='+encodeURIComponent(domain)} onError={()=>setFailed(true)}/>}</a>:null;
}
