import React,{createContext,useContext,useState,useEffect} from 'react';
type State=Record<string,any>;
const Context=createContext<{state:State;change:(patch:State)=>void}|null>(null);
export function ViewStateProvider({state,change,children}:{state:State;change:(patch:State)=>void;children:React.ReactNode}){return <Context.Provider value={{state,change}}>{children}</Context.Provider>;}
/** Keep read-only view choices with the navigation visit, never unsaved form data. */
export function useViewState<T>(key:string,initial:T|(()=>T)):[T,React.Dispatch<React.SetStateAction<T>>]{
 const context=useContext(Context),[fallback,setFallback]=useState(initial);
 useEffect(()=>{if(context&&!Object.hasOwn(context.state,key))context.change({[key]:fallback});},[context?.state[key]]);
 const value=context&&Object.hasOwn(context.state,key)?context.state[key] as T:fallback;
 return [value,next=>{const resolved=typeof next==='function'?(next as (value:T)=>T)(value):next;if(context)context.change({[key]:resolved});else setFallback(resolved);}];
}
