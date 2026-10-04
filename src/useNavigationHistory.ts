import {useEffect,useRef,useState} from 'react';
import {emptyHistory,recordVisit,travelHistory,visitKey,Visit} from './navigation-history';
export function useNavigationHistory(scope:string,visit:Visit,restore:(visit:Visit)=>void,dirty:boolean){
 const ref=useRef(emptyHistory()),scopeRef=useRef(scope),position=useRef(0),restoring=useRef(false),reverting=useRef(false),approved=useRef(false);
 const current=useRef({restore,dirty,scope});current.current={restore,dirty,scope};
 const [history,setHistory]=useState(ref.current),encoded=JSON.stringify(visit);
 useEffect(()=>{
  const changedScope=scopeRef.current!==scope;
  if(changedScope){scopeRef.current=scope;ref.current=emptyHistory();position.current=0;}
  const previous=ref.current.present;
  ref.current=scope?recordVisit(ref.current,visit):emptyHistory();setHistory(ref.current);
  if(!scope||!visit.page)return;
  const pushed=!changedScope&&!restoring.current&&previous&&visitKey(previous)!==visitKey(visit);
  if(pushed)position.current++;
  const state={...window.history.state,searchNavigation:{scope,position:position.current,visit}};
  if(pushed)window.history.pushState(state,'');else window.history.replaceState(state,'');
  restoring.current=false;
 },[scope,encoded]);
 useEffect(()=>{
  const pop=(event:PopStateEvent)=>{
   if(reverting.current){reverting.current=false;return;}
   const target=event.state?.searchNavigation;if(!target||target.scope!==current.current.scope)return;
   const delta=target.position-position.current;
   if(current.current.dirty&&!approved.current&&!confirm('Discard unsaved changes?')){reverting.current=true;window.history.go(-delta);return;}
   approved.current=false;
   let next=ref.current;for(let i=0;i<Math.abs(delta);i++)next=travelHistory(next,delta<0?'back':'forward');
   if(!next.present||visitKey(next.present)!==visitKey(target.visit))next={past:[],present:target.visit,future:[]};
   else next={...next,present:target.visit};
   position.current=target.position;ref.current=next;restoring.current=true;setHistory(next);current.current.restore(target.visit);
  };
  window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);
 },[]);
 const go=(direction:'back'|'forward')=>{
  if(travelHistory(ref.current,direction)===ref.current)return;
  if(dirty&&!confirm('Discard unsaved changes?'))return;
  approved.current=true;window.history.go(direction==='back'?-1:1);
 };
 return {back:history.past.at(-1),forward:history.future[0],go};
}
