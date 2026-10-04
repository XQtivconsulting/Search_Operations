import React from 'react';
import {EditableTagSelect} from './EditableTagSelect';
import {tagOptions} from './candidate-tags';
import {companyValues} from './company-directory';
import {companyChildOptions} from './company-taxonomy';
type R=Record<string,any>;
export function CompanyClassification({edit,setEdit,records}:{edit:R;setEdit:(v:R)=>void;records:R[]}){
 const industries=companyValues(edit,'industries'),options=companyChildOptions(records,industries,edit.sector||'');
 return <><EditableTagSelect label="Industry" multiple value={industries} options={tagOptions(records,'industry')} onChange={industries=>setEdit({...edit,industries,sector:'',subsector:''})}/><EditableTagSelect label="Sector" value={companyValues(edit,'sector')} options={options.sectors} disabled={!industries.length} onChange={v=>setEdit({...edit,sector:v[0]||'',subsector:''})}/><EditableTagSelect label="Subsector" value={companyValues(edit,'subsector')} options={options.subsectors} disabled={!edit.sector} onChange={v=>setEdit({...edit,subsector:v[0]||''})}/></>;
}
