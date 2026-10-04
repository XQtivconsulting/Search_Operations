import {useEffect,useRef,useState} from 'react';
import {emptyHistory,recordVisit,travelHistory,Visit} from './navigation-history';
export function useNavigationHistory(scope:string,visit:Visit,restore:(visit:Visit)=>void,dirty:boolean){
 const ref=useRef(emptyHistory()),scopeRef=useRef(scope);
 const [history,setHistory]=useState(ref.current);
 const encoded=JSON.stringify(visit);
 useEffect(()=>{
  if(scopeRef.current!==scope){scopeRef.current=scope;ref.current=emptyHistory();}
  ref.current=scope?recordVisit(ref.current,visit):emptyHistory();
  setHistory(ref.current);
 },[scope,encoded]);
 const go=(direction:'back'|'forward')=>{
  const next=travelHistory(ref.current,direction);
  if(next===ref.current)return;
  if(dirty&&!confirm('Discard unsaved changes?'))return;
  ref.current=next;setHistory(next);restore(next.present!);
 };
 return {back:history.past.at(-1),forward:history.future[0],go};
}
