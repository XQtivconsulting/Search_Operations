import {permissionIds,retiredRoleIds,roleTemplates,effectiveAccessRoles,effectivePermissions} from './access-policy';
import type {RoleDefinition} from './access-policy';
import {requireThat,text} from './domain';
type DB={rows:(q:string,...p:any[])=>any[]};
export const rolePolicySchema=`CREATE TABLE IF NOT EXISTS access_roles(tenant TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL,permissions TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(tenant,id));
CREATE TABLE IF NOT EXISTS access_role_init(tenant TEXT PRIMARY KEY);`;
export function roleDefinitions(db:DB,tenant:string):RoleDefinition[]{
 if(!db.rows('SELECT tenant FROM access_role_init WHERE tenant=?',tenant).length){
  for(const r of roleTemplates.filter(r=>!retiredRoleIds.includes(r.id)||Object.values(roleUsage(db,tenant,r.id)).some(Boolean)))db.rows('INSERT OR IGNORE INTO access_roles VALUES(?,?,?,?,?,?,?)',tenant,r.id,r.id==='researcher'?'Researcher':r.name,r.description,JSON.stringify(r.permissions),1,new Date().toISOString());
  db.rows('INSERT INTO access_role_init VALUES(?)',tenant);
 }
 for(const id of retiredRoleIds){const usage=roleUsage(db,tenant,id);if(!usage.users&&!usage.invitations){const old=db.rows('SELECT * FROM access_roles WHERE tenant=? AND id=?',tenant,id)[0];if(old){db.rows('DELETE FROM access_roles WHERE tenant=? AND id=?',tenant,id);db.rows('INSERT INTO member_events VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),tenant,'system:role-retirement','role:'+id,JSON.stringify(old),JSON.stringify({deleted:true,reason:'Retired unused role'}),new Date().toISOString());}}}
 return db.rows('SELECT * FROM access_roles WHERE tenant=? ORDER BY name',tenant).map(r=>({...r,retired:retiredRoleIds.includes(r.id),permissions:JSON.parse(r.permissions)}));
}
export function validateAssignedRoles(db:DB,tenant:string,ids:unknown):asserts ids is string[]{
 const definitions=roleDefinitions(db,tenant);
 requireThat(Array.isArray(ids)&&ids.length>0&&ids.length<=30&&ids.every(id=>typeof id==='string'&&(id==='super_admin'||definitions.some(r=>r.id===id))),'Choose valid workspace roles.');
}
export function roleUsage(db:DB,tenant:string,id:string){
 const members=db.rows('SELECT m.user_id,m.role,p.roles FROM memberships m LEFT JOIN member_profiles p ON p.user_id=m.user_id AND p.tenant=m.tenant WHERE m.tenant=?',tenant);
 const invites=db.rows('SELECT i.role,r.roles FROM invites i LEFT JOIN invitation_roles r ON r.token=i.token WHERE i.tenant=? AND i.used=0 AND i.expires>?',tenant,Date.now());
 const includes=(r:any)=>(r.roles?JSON.parse(r.roles):[r.role]).includes(id);
 return {users:members.filter(includes).length,invitations:invites.filter(includes).length};
}
// Called inside Identity's transaction after re-reading the administrator's membership.
export function mutateRolePolicy(db:DB,tenant:string,actor:string,b:any){
 const definitions=roleDefinitions(db,tenant),id=b.id||'role_'+crypto.randomUUID(),old=definitions.find(r=>r.id===id);
 requireThat(id!=='super_admin','Super Admin is protected.',403);
 requireThat(!retiredRoleIds.includes(id),'This role is retired. Reassign its members in People & access.',409);
 requireThat(!b.id||old,'Role not found.',404);
 requireThat(!old||Number(b.version)===old.version,'This role changed. Reload before saving.',409);
 const usage=roleUsage(db,tenant,id);
 if(b.action==='delete'){
  requireThat(old,'Role not found.',404);requireThat(!usage.users&&!usage.invitations,'Reassign people and cancel pending invitations using this role before deleting it.',409);
  db.rows('DELETE FROM access_roles WHERE tenant=? AND id=?',tenant,id);
 }else{
  requireThat(b.action==='save','Unknown role action.');
  const name=text(b.name,80),description=text(b.description,500);
  requireThat(name,'Name the role.');requireThat(name.toLowerCase()!=='super admin','Use a different role name.');
  requireThat(!definitions.some(r=>r.id!==id&&r.name.toLowerCase()===name.toLowerCase()),'A role with this name already exists.',409);
  requireThat(Array.isArray(b.permissions)&&b.permissions.every((p:unknown)=>typeof p==='string'&&permissionIds.includes(p)),'Choose recognized permission groups.');
  const permissions=[...new Set<string>(b.permissions)];
  db.rows('INSERT INTO access_roles VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant,id) DO UPDATE SET name=excluded.name,description=excluded.description,permissions=excluded.permissions,version=excluded.version,updated_at=excluded.updated_at',tenant,id,name,description,JSON.stringify(permissions),(old?.version||0)+1,new Date().toISOString());
  // Stable account-linked sourcing identities must also exist when access comes from a custom role.
  const nextDefinitions=roleDefinitions(db,tenant);
  for(const m of db.rows('SELECT m.user_id,m.role,m.staff_id,p.roles FROM memberships m LEFT JOIN member_profiles p ON p.user_id=m.user_id AND p.tenant=m.tenant WHERE m.tenant=?',tenant)){
   const assigned=m.roles?JSON.parse(m.roles):[m.role];
   if(!m.staff_id&&effectivePermissions(assigned,nextDefinitions).some(p=>['reviews.submit','candidates.add','pto.self'].includes(p)))db.rows('UPDATE memberships SET staff_id=? WHERE tenant=? AND user_id=?','person:'+m.user_id,tenant,m.user_id);
  }
 }
 db.rows('INSERT INTO member_events VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),tenant,actor,'role:'+id,JSON.stringify(old||null),JSON.stringify(b.action==='delete'?{deleted:true}:{...roleDefinitions(db,tenant).find(r=>r.id===id)}),new Date().toISOString());
 return {id};
}
