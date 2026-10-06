import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';

let initPromise: Promise<void> | null = null;

async function ensureTables() {
  const d = env.DB;
  if (!d) return;
  const sql = `
    CREATE TABLE IF NOT EXISTS farms (id text PRIMARY KEY NOT NULL, owner text NOT NULL, name text NOT NULL, zone text NOT NULL, contact text NOT NULL);
    CREATE TABLE IF NOT EXISTS farm_members (farm_id text NOT NULL, user_id text NOT NULL, name text NOT NULL, role text NOT NULL, PRIMARY KEY(farm_id, user_id));
    CREATE TABLE IF NOT EXISTS farm_invitations (token text PRIMARY KEY NOT NULL, farm_id text NOT NULL, role text NOT NULL, expires text NOT NULL);
    CREATE TABLE IF NOT EXISTS service_requests (id text PRIMARY KEY NOT NULL, farm_id text NOT NULL, owner text NOT NULL, revision integer NOT NULL, payload text NOT NULL);
    CREATE TABLE IF NOT EXISTS farm_contacts (id text PRIMARY KEY NOT NULL, farm_id text NOT NULL, name text NOT NULL, role text NOT NULL, phone text NOT NULL, email text NOT NULL, receive_reports integer DEFAULT 0 NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_events (id text PRIMARY KEY NOT NULL, farm_id text NOT NULL, actor_id text NOT NULL, event text NOT NULL, subject_type text NOT NULL, subject_id text NOT NULL, details text NOT NULL, created text NOT NULL);
    CREATE TABLE IF NOT EXISTS photos (id text PRIMARY KEY NOT NULL, owner text NOT NULL, farm_id text, key text NOT NULL, mime text NOT NULL);
    CREATE TABLE IF NOT EXISTS visits (id text PRIMARY KEY NOT NULL, owner text NOT NULL, farm_id text, farm text NOT NULL, date text NOT NULL, payload text NOT NULL, revision integer DEFAULT 1 NOT NULL, updated text NOT NULL);
    CREATE TABLE IF NOT EXISTS report_versions (id text PRIMARY KEY NOT NULL, farm_id text NOT NULL, visit_id text NOT NULL, version_number integer NOT NULL, status text NOT NULL, source_visit_revision integer NOT NULL, created_by text NOT NULL, created_at text NOT NULL, submitted_by text, submitted_at text, approved_by text, approved_at text, published_by text, published_at text, snapshot_json text, revision integer NOT NULL DEFAULT 1, updated_at text NOT NULL, CONSTRAINT report_versions_visit_version_unique UNIQUE(visit_id,version_number));
    CREATE INDEX IF NOT EXISTS idx_visits_owner_date ON visits (owner, date);
    CREATE INDEX IF NOT EXISTS idx_visits_farm_date ON visits (farm_id, date);
    CREATE INDEX IF NOT EXISTS idx_photos_owner ON photos (owner);
    CREATE INDEX IF NOT EXISTS idx_photos_farm ON photos (farm_id);
    CREATE INDEX IF NOT EXISTS idx_members_user ON farm_members (user_id);
    CREATE INDEX IF NOT EXISTS idx_requests_farm ON service_requests (farm_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_farm ON farm_contacts (farm_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_farm_created ON audit_events (farm_id, created);
    CREATE INDEX IF NOT EXISTS idx_report_versions_farm_created ON report_versions (farm_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_report_versions_visit_status ON report_versions (visit_id, status);
  `;
  try {
    if (typeof d.exec === 'function') {
      await d.exec(sql);
    } else {
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(Boolean);
      await d.batch(statements.map(s => d.prepare(s)));
    }
  } catch (e) {
    console.error('Failed to initialize D1 database schema:', e);
  }
}

export function db(){
  if (!initPromise && env.DB) {
    initPromise = ensureTables();
  }
  return env.DB;
}

export function files(){return env.FILES;}

export async function identity(_req:Request,_write=false){
  if (!initPromise && env.DB) {
    initPromise = ensureTables();
  }
  if (initPromise) {
    await initPromise;
  }
  const u=await getChatGPTUser();if(!u)throw new Error('401:Inicia sesión para acceder a tus informes.');
  return u.userId;
}

export function failure(e:unknown){
  const msg=e instanceof Error?e.message:String(e);
  const match=/^(400|401|403|404|409|413|422):(.+)$/.exec(msg);
  if(!match)console.error('Operation failed:', e);
  return Response.json({error:match?match[2]:'No se pudo completar la operación. Intenta nuevamente.'},{status:match?Number(match[1]):500});
}
export async function body(req:Request,max:number){const reader=req.body?.getReader();if(!reader)throw new Error('400:Faltan los datos.');let size=0;const parts:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('413:El archivo o formulario supera el tamaño permitido.');}parts.push(value);}const data=new Uint8Array(size);let offset=0;for(const p of parts){data.set(p,offset);offset+=p.length;}return data;}
