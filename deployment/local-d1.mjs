// Minimal D1-compatible wrapper over node:sqlite for local preview and tests only.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function openLocalD1(file=':memory:',migrationsDir){
 const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON');
 if(migrationsDir){db.exec('CREATE TABLE IF NOT EXISTS _local_migrations(name TEXT PRIMARY KEY)');for(const name of fs.readdirSync(migrationsDir).filter(f=>f.endsWith('.sql')).sort()){if(db.prepare('SELECT 1 FROM _local_migrations WHERE name=?').get(name))continue;db.exec(fs.readFileSync(migrationsDir+'/'+name,'utf8'));db.prepare('INSERT INTO _local_migrations VALUES(?)').run(name);}}
 const statement=(sql,params=[])=>({bind:(...p)=>statement(sql,p),
  first:async()=>db.prepare(sql).get(...params)??null,
  all:async()=>({results:db.prepare(sql).all(...params)}),
  run:async()=>{const r=db.prepare(sql).run(...params);return {meta:{changes:Number(r.changes)}};},
  _exec:()=>/\bRETURNING\b/i.test(sql)?db.prepare(sql).all(...params):db.prepare(sql).run(...params)});
 return {prepare:sql=>statement(sql),
  batch:async list=>{db.exec('BEGIN');try{const out=list.map(s=>s._exec());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}},
  raw:db};
}
