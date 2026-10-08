import React,{useEffect,useState} from 'react';
import {PeoplePanel} from './PeoplePanel';
import {TeamsPanel} from './TeamsPanel';
type Props={data:any;api:(path:string,body?:unknown)=>Promise<any>;reload:()=>Promise<void>;onDirty:(dirty:boolean)=>void;onAddTeam:()=>void;roleFilter:string;onRoleFilterChange:(role:string)=>void};
export function PeopleAndTeams({data,api,reload,onDirty,onAddTeam,roleFilter,onRoleFilterChange}:Props){
 const [peopleDirty,setPeopleDirty]=useState(false),[teamsDirty,setTeamsDirty]=useState(false);
 useEffect(()=>{onDirty(peopleDirty||teamsDirty);return()=>onDirty(false);},[peopleDirty,teamsDirty]);
 return <PeoplePanel data={data} api={api} reload={reload} onDirty={setPeopleDirty} roleFilter={roleFilter} onRoleFilterChange={onRoleFilterChange}>
  <details className="panel sourcing-team-management"><summary>Manage sourcing teams ({data.teams.length})</summary><TeamsPanel data={data} api={api} reload={reload} onDirty={setTeamsDirty} onAdd={onAddTeam}/></details>
 </PeoplePanel>;
}
