import React,{useEffect,useLayoutEffect,useRef,useState,useId} from 'react';
import {createPortal} from 'react-dom';
import {filterPosition} from './filter-position';

// Render outside table/overflow containers, positioned within the visible viewport.
export function FilterPopover({label,summary,children,width=300,disabled=false}:{label:string;summary:React.ReactNode;children:React.ReactNode;width?:number;disabled?:boolean}){
 const [open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0,width,maxHeight:360});
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),id=useId();
 useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{const r=trigger.current?.getBoundingClientRect();if(!r)return;setPosition(filterPosition(r,width,window.innerWidth,window.innerHeight));};
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[open,width]);
 useEffect(()=>{
  if(!open)return;
  panel.current?.querySelector('input')?.focus();
  const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);};
 },[open]);
 return <div className="floating-filter"><button type="button" ref={trigger} className="filter-trigger" disabled={disabled} aria-label={label} aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(!open)}>{summary}<span aria-hidden="true">▾</span></button>{open&&createPortal(<div ref={panel} id={id} role="dialog" aria-label={label} className="filter-popover" style={position}>{children}</div>,document.body)}</div>;
}

