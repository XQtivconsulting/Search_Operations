import {useViewState} from './ViewState';
import React,{Children,cloneElement,isValidElement,useState} from 'react';
import {compareTableValues} from './table-sort';
type E=React.ReactElement<any>;
function elements(children:React.ReactNode):E[]{return Children.toArray(children).flatMap(c=>isValidElement(c)?c.type===React.Fragment?elements((c as E).props.children):[c as E]:[]);}
export function cellValue(node:React.ReactNode):string|number|null {
 if(node===null||node===undefined||typeof node==='boolean')return null;
 if(typeof node==='string'||typeof node==='number')return node;
 if(Array.isArray(node))return node.map(cellValue).filter(v=>v!==null).join(' ').trim();
 if(!isValidElement(node))return null;
 const p=(node as E).props;
 if(p['data-sort-value']!==undefined)return p['data-sort-value'];
 if(node.type==='small'||node.type==='svg'||typeof node.type==='function'&&node.type.name==='LinkedInIcon')return null;
 if(node.type==='input'||node.type==='select')return p.value??null;
 return cellValue(p.children);
}
function value(cell:E){const raw=cellValue(cell);if(typeof raw!=='string')return raw;const s=raw.trim();if(!s||['—','Not set','Not recorded'].includes(s))return null;if(/^-?[\d,]+(?:\.\d+)?(?:%| days?| hours?)?$/.test(s))return Number(s.replace(/[, %a-z]/gi,''));if(/^\d{2} [A-Z][a-z]{2} \d{4}(?:,? \d{2}:\d{2})?$/.test(s)){const date=Date.parse(s);if(Number.isFinite(date))return date;}return s;}
/** Sort complete React rows before taking a page. Existing data-driven headers retain ownership. */
export function SortableTable({children,page,pageSize,onPageChange,stateKey='table',...props}:React.TableHTMLAttributes<HTMLTableElement>&{stateKey?:string;page?:number;pageSize?:number;onPageChange?:(page:number)=>void}){
 const [sort,setSort]=useViewState<{column:number;descending:boolean}|null>(stateKey,null);
 const sections=elements(children),head=sections.find(e=>e.type==='thead'),body=sections.find(e=>e.type==='tbody');
 const headers=head?elements(head.props.children):[],cols=headers[0]?elements(headers[0].props.children):[];
 const externallySorted=cols.some(c=>c.props['aria-sort']!==undefined||elements(c.props.children).some(e=>e.type==='button'));
 const plain=cols.length>0&&!cols.some(c=>c.props.colSpan>1||c.props.rowSpan>1)&&!headers.some(r=>elements(r.props.children).some(c=>c.props.colSpan>1||c.props.rowSpan>1));
 let rows=body?elements(body.props.children):[];
 const sortable=plain&&!rows.some(r=>elements(r.props.children).some(c=>c.props.colSpan>1||c.props.rowSpan>1));
 if(sort&&!externallySorted&&sortable)rows=rows.map((row,index)=>({row,index,sortValue:value(elements(row.props.children)[sort.column]||<td/>)})).sort((a,b)=>compareTableValues(a.sortValue,b.sortValue,sort.descending)||a.index-b.index).map(r=>r.row);
 if(pageSize)rows=rows.slice((page||0)*pageSize,((page||0)+1)*pageSize);
 return <table {...props}>{sections.map(section=>section===body?cloneElement(section,{},rows):section===head&&sortable&&!externallySorted?cloneElement(section,{},headers.map((r,i)=>i?r:cloneElement(r,{},cols.map((c,column)=>{const label=cellValue(c);if(!label||/^(actions?|select|selection)$/i.test(String(label))||elements(c.props.children).some(e=>['input','select'].includes(String(e.type))))return c;return cloneElement(c,{'aria-sort':sort?.column===column?(sort.descending?'descending':'ascending'):'none',scope:'col'},<button type="button" className="table-sort-heading" onClick={()=>{setSort({column,descending:sort?.column===column?!sort.descending:false});onPageChange?.(0);}}>{c.props.children} <span aria-hidden="true">{sort?.column===column?(sort.descending?'↓':'↑'):'↕'}</span></button>);})))):section)}</table>;
}

