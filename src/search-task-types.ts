export const searchTaskTypes=['Research','JD','Competency map','Keyword guidance','Pitch document','Target company identification','Alignment profiles','Status report template and cadence','Other'];
export function taskTypeLabel(type:string){return ({'Role brief':'JD','Search strategy':'Competency map','Target companies':'Target company identification','Sourcing':'Research'} as Record<string,string>)[type]||type;}
export function taskCanEdit(type:string,section:'brief'|'criteria'|'guidance'){
 return section==='brief'?['Role brief','JD'].includes(type):section==='criteria'?['Search strategy','Competency map'].includes(type):['Search strategy','Keyword guidance'].includes(type);
}
