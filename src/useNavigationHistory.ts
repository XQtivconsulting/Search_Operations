import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {emptyHistory,recordVisit,travelHistory,visitKey,Visit,NavigationHistory} from './navigation-history';
type Entry={scope:string;position:number;visit:Visit;history?:NavigationHistory};
export function useNavigationHistory(scope:string,visit:Visit,restore:(visit:Visit)=>void,dirty:boolean){
 const ref=useRef(emptyHistory()),scopeRef=useRef(''),position=useRef(0),restoring=useRef<string|null>(null),reverting=useRef(false),approved=useRef(false),pending=useRef(false);
 const current=useRef({restore,dirty,scope});current.current={restore,dirty,scope};
 const [history,setHistory]=useState(ref.current),[traveling,setTraveling]=useState(false),encoded=JSON.stringify(visit);
 const write=(push=false)=>{const value={...window.history.state,searchNavigation:{scope:current.current.scope,position:position.current,visit:ref.current.present,history:ref.current}};if(push)window.history.pushState(value,'');else window.history.replaceState(value,'');};
 useLayoutEffect(()=>{
  if(!scope||!visit.page){scopeRef.current='';ref.current=emptyHistory();setHistory(ref.current);return;}
  if(scopeRef.current!==scope){
   scopeRef.current=scope;const saved=window.history.state?.searchNavigation as Entry|undefined;
   if(saved?.scope===scope&&saved.visit?.page){position.current=saved.position;ref.current=saved.history?.present?saved.history:{past:[],present:saved.visit,future:[]};setHistory(ref.current);if(JSON.stringify(saved.visit)===encoded){restoring.current=null;write();}else{restoring.current=visitKey(saved.visit);restore(saved.visit);}return;}
   position.current=0;ref.current=recordVisit(emptyHistory(),visit);setHistory(ref.current);write();return;
  }
  // An old render must never overwrite the destination while React restores its view state.
  if(restoring.current&&restoring.current!==visitKey(visit))return;
  const previous=ref.current.present,push=!restoring.current&&!!previous&&visitKey(previous)!==visitKey(visit);
  ref.current=recordVisit(ref.current,visit);setHistory(ref.current);
  if(push)position.current++;
  write(push);restoring.current=null;
 },[scope,encoded]);
 useEffect(()=>{
  const pop=(event:PopStateEvent)=>{
   if(reverting.current){reverting.current=false;pending.current=false;setTraveling(false);return;}
   const target=event.state?.searchNavigation as Entry|undefined;
   if(!target||target.scope!==current.current.scope){pending.current=false;setTraveling(false);return;}
   const delta=target.position-position.current;
   if(current.current.dirty&&!approved.current&&!confirm('Discard unsaved changes?')){reverting.current=true;if(delta)window.history.go(-delta);else {reverting.current=false;write();}pending.current=false;setTraveling(false);return;}
   approved.current=false;pending.current=false;setTraveling(false);
   let next=ref.current;for(let i=0;i<Math.abs(delta);i++)next=travelHistory(next,delta<0?'back':'forward');
   if(!next.present||visitKey(next.present)!==visitKey(target.visit))next=target.history||{past:[],present:target.visit,future:[]};
   // Current in-memory snapshots include the last filter changes before leaving a page.
   const destination=next.present||target.visit;
   position.current=target.position;ref.current=next;restoring.current=visitKey(destination);setHistory(next);current.current.restore(destination);
  };
  window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);
 },[]);
 const go=(direction:'back'|'forward')=>{
  if(pending.current||travelHistory(ref.current,direction)===ref.current)return;
  if(current.current.dirty&&!confirm('Discard unsaved changes?'))return;
  approved.current=true;pending.current=true;setTraveling(true);window.history.go(direction==='back'?-1:1);
 };
 return {back:history.past.at(-1),forward:history.future[0],go,traveling};
}
