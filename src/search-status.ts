type DB={rows:(q:string,...p:any[])=>any[]};
export function initializeSearchStatus(db:DB){
 db.rows("CREATE TABLE IF NOT EXISTS search_status_history(id INTEGER PRIMARY KEY AUTOINCREMENT,search_id TEXT NOT NULL,previous_status TEXT,status TEXT NOT NULL,changed_at TEXT,recorded_at TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',actor_id TEXT NOT NULL DEFAULT '',source TEXT NOT NULL)");
 db.rows('CREATE INDEX IF NOT EXISTS search_status_history_search ON search_status_history(search_id,id)');
 db.rows("INSERT INTO search_status_history(search_id,status,changed_at,recorded_at,source) SELECT id,COALESCE(status,''),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'Existing record' FROM searches s WHERE NOT EXISTS(SELECT 1 FROM search_status_history h WHERE h.search_id=s.id)");
 db.rows(`CREATE TRIGGER IF NOT EXISTS search_status_created AFTER INSERT ON searches BEGIN
 INSERT INTO search_status_history(search_id,status,changed_at,recorded_at,source) VALUES(NEW.id,COALESCE(NEW.status,''),CASE WHEN (NEW.external_id IS NULL OR NEW.external_id LIKE 'LOCAL-%') AND COALESCE(NEW.origin,'')<>'Excel' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'Created or imported');END`);
 db.rows(`CREATE TRIGGER IF NOT EXISTS search_status_changed AFTER UPDATE OF status ON searches WHEN COALESCE(OLD.status,'')<>COALESCE(NEW.status,'') BEGIN
 INSERT INTO search_status_history(search_id,previous_status,status,changed_at,recorded_at,source) VALUES(NEW.id,OLD.status,COALESCE(NEW.status,''),strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),'System / CRM');END`);
}
export function searchStatusHistory(db:DB){
 const grouped=new Map<string,any[]>();
 for(const row of db.rows('SELECT * FROM search_status_history ORDER BY id DESC')){
  const rows=grouped.get(row.search_id)||[];rows.push(row);grouped.set(row.search_id,rows);
 }
 return grouped;
}
