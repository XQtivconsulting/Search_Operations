import {Actor,canPlan,hasRole,requireThat,day,text} from './domain';
type R=Record<string,any>;
type DB={rows:(q:string,...p:any[])=>R[];audit:(a:Actor,action:string,id:string,before:any,after:any)=>void;assignableStaff:(id:string)=>boolean};
export const effortSchema=`CREATE TABLE IF NOT EXISTS effort_days(staff_id TEXT NOT NULL REFERENCES staff(id),work_date TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(staff_id,work_date));
CREATE TABLE IF NOT EXISTS effort_records(staff_id TEXT NOT NULL REFERENCES staff(id),work_date TEXT NOT NULL,search_id TEXT NOT NULL REFERENCES searches(id),team_id TEXT NOT NULL REFERENCES teams(id),days REAL NOT NULL CHECK(days>=0 AND days<=1),PRIMARY KEY(staff_id,work_date,search_id,team_id));`;
export function saveEffort(db:DB,a:Actor,b:R){
 const staff=text(b.staff_id),date=day(b.work_date),planner=canPlan(a);
 requireThat(planner||hasRole(a,'researcher')&&a.staffId===staff,'You can confirm only your own effort.',403);
 requireThat(db.rows('SELECT s.id FROM staff s LEFT JOIN staff_profiles p ON p.staff_id=s.id WHERE s.id=? AND COALESCE(p.archived,0)=0',staff).length&&db.assignableStaff(staff),'Choose an active researcher.',404);
 requireThat(date<=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date()),'Confirm effort only for today or a past date.');
 const old=db.rows('SELECT * FROM effort_days WHERE staff_id=? AND work_date=?',staff,date)[0];
 requireThat(Number(b.version)===(old?.version||0),'Effort changed. Reload before saving.',409);
 requireThat(Array.isArray(b.items)&&b.items.length>0&&b.items.length<=100,'Choose the searches worked on.');
 const keys=new Set<string>();let units=0;
 const items=b.items.map((r:R)=>{
  const role=text(r.search_id),team=text(r.team_id),days=Number(r.days),key=JSON.stringify([role,team]);
  requireThat(['number','string'].includes(typeof r.days)&&r.days!==''&&r.days!==null&&r.days!==undefined&&Number.isFinite(days)&&days>=0&&days<=1&&Math.abs(days*100-Math.round(days*100))<1e-8,'Person-days must be between 0 and 1, with at most two decimals.');
  requireThat(!keys.has(key),'A search/team can occur only once.');keys.add(key);units+=Math.round(days*100);
  requireThat(db.rows('SELECT id FROM searches WHERE id=?',role).length&&db.rows('SELECT id FROM teams WHERE id=?',team).length,'Search or team not found.',404);
  const assigned=db.rows('SELECT a.id FROM assignments a JOIN entries e ON e.assignment_id=a.id WHERE a.search_id=? AND a.team_id=? AND a.work_date=? AND e.staff_id=?',role,team,date,staff).length;
  const owned=db.rows("SELECT id FROM research_records WHERE role_id=? AND json_extract(data,'$.team_id')=? AND (json_extract(data,'$.staff_id')=? OR json_extract(data,'$.owner_id')=?)",role,team,staff,a.id).length;
  const prior=db.rows('SELECT 1 FROM effort_records WHERE staff_id=? AND work_date=? AND search_id=? AND team_id=?',staff,date,role,team).length;
  requireThat(planner||assigned||owned||prior,'Confirm effort for an assigned search or your research work.',403);
  return {search_id:role,team_id:team,days:Math.round(days*100)/100};
 });
 requireThat(units<=100,'Total effort across all searches cannot exceed one person-day per researcher/date.');
 const before={version:old?.version||0,items:db.rows('SELECT search_id,team_id,days FROM effort_records WHERE staff_id=? AND work_date=?',staff,date)};
 db.rows('DELETE FROM effort_records WHERE staff_id=? AND work_date=?',staff,date);
 for(const item of items)db.rows('INSERT INTO effort_records VALUES(?,?,?,?,?)',staff,date,item.search_id,item.team_id,item.days);
 db.rows('INSERT INTO effort_days VALUES(?,?,1) ON CONFLICT(staff_id,work_date) DO UPDATE SET version=version+1',staff,date);
 const id=JSON.stringify([staff,date]);db.audit(a,'effort-confirm',id,before,{staff_id:staff,work_date:date,version:before.version+1,items});return {id};
}
