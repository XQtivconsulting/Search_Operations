import React,{useEffect,useId,useState} from 'react';
import {createPortal} from 'react-dom';

/** Immediate hover/focus label, outside scroll containers so it cannot be clipped. */
export function IconAction({label,accessibleLabel,onClick,children,disabled=false}:{label:string;accessibleLabel?:string;onClick:()=>void;children:React.ReactNode;disabled?:boolean}){
 const id=useId(),[position,setPosition]=useState<{left:number;top:number;above:boolean}|null>(null);
 const show=(element:HTMLElement)=>{const r=element.getBoundingClientRect(),above=r.bottom+42>window.innerHeight;setPosition({left:Math.max(8,Math.min(r.left,window.innerWidth-220)),top:above?r.top-6:r.bottom+6,above});};
 useEffect(()=>{if(!position)return;const hide=()=>setPosition(null),key=(e:KeyboardEvent)=>{if(e.key==='Escape')hide();};window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);document.addEventListener('keydown',key);return()=>{window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);document.removeEventListener('keydown',key);};},[position]);
 return <><span className="icon-action-wrap" onMouseEnter={e=>{if(disabled)show(e.currentTarget);}} onMouseLeave={()=>setPosition(null)}><button type="button" disabled={disabled} className="monitor-icon-action" aria-label={accessibleLabel||label} aria-describedby={position?id:undefined} onMouseEnter={e=>show(e.currentTarget)} onMouseLeave={()=>setPosition(null)} onFocus={e=>show(e.currentTarget)} onBlur={()=>setPosition(null)} onClick={()=>{setPosition(null);onClick();}}>{children}</button></span>{position&&createPortal(<span id={id} role="tooltip" className="action-tooltip" style={{left:position.left,top:position.top,transform:position.above?'translateY(-100%)':undefined}}>{label}</span>,document.body)}</>;
}
