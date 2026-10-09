import {hasPermission} from './access-policy';
export const navigationPages:Record<string,{id:string;group?:string;features:string[]}>= {
 'My Work':{id:'nav.work',features:['search.view']},
 'Candidates':{id:'nav.candidates',features:['candidates.view']},
 'Companies':{id:'nav.companies',features:['companies.view']},
 'Search repository':{id:'nav.search',group:'nav.sourcing',features:['search.view']},
 'Weekly plan':{id:'nav.plan',group:'nav.sourcing',features:['planning.view']},
 'Delivery Monitor':{id:'nav.monitor',group:'nav.sourcing',features:['planning.view']},
 'Performance':{id:'nav.performance',group:'nav.sourcing',features:['reports.view']},
 'Pipeline':{id:'nav.engagement',features:['engagement.view']},
 'Interview tracker':{id:'nav.interviews',features:['engagement.view']},
 'Teams':{id:'nav.access',group:'nav.admin',features:['planning.view','users.view']},
 'Backups & exports':{id:'nav.backups',group:'nav.admin',features:['data.backup','data.export']},
 'Sourcing settings':{id:'nav.sourcing_settings',group:'nav.admin',features:['integrations.manage']},
 'Integrations':{id:'nav.integrations',group:'nav.admin',features:['integrations.manage']},
 'Engagement Config':{id:'nav.engagement_settings',group:'nav.admin',features:['engagement.config']},
};
export function canViewPage(actor:any,page:string){
 if(page==='Account settings')return true;
 const aliases:Record<string,string>={'Search assignments':'Pipeline','Daily Work':'Pipeline','Engagement':'Pipeline','People & access':'Teams','Searches':'Search repository'};
 const rule=navigationPages[aliases[page]||page];if(!rule)return false;
 return hasPermission(actor,rule.id)&&(!rule.group||hasPermission(actor,rule.group))&&rule.features.some(p=>hasPermission(actor,p));
}
