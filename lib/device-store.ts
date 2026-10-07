import initSqlJs from 'sql.js';
import type {Database, SqlJsStatic} from 'sql.js';
import {validate} from './validate';
import catalog from './catalog.json';
import {compareMetricReadings,metricDefinition,metricDefinitions,metricReading} from './metric-definitions';
import {MAX_PHOTO_BYTES,type Visit} from './model';

export const DEVICE_SCHEMA=`
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS farms (id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, zone TEXT NOT NULL, contact TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS farm_contacts (id TEXT PRIMARY KEY, farm_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, receive_reports INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS farm_members (farm_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY(farm_id,user_id));
CREATE TABLE IF NOT EXISTS service_requests (id TEXT PRIMARY KEY, farm_id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, farm_id TEXT, revision INTEGER NOT NULL, date TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, farm_id TEXT, mime TEXT NOT NULL, data BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS report_versions (id TEXT PRIMARY KEY, farm_id TEXT NOT NULL, visit_id TEXT NOT NULL, version_number INTEGER NOT NULL, status TEXT NOT NULL, source_visit_revision INTEGER NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, submitted_by TEXT, submitted_at TEXT, approved_by TEXT, approved_at TEXT, published_by TEXT, published_at TEXT, snapshot_json TEXT, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, UNIQUE(visit_id,version_number));
CREATE TABLE IF NOT EXISTS report_events (id TEXT PRIMARY KEY, farm_id TEXT NOT NULL, report_version_id TEXT NOT NULL, event TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS visits_date ON visits(date);
CREATE INDEX IF NOT EXISTS contacts_farm ON farm_contacts(farm_id);
CREATE INDEX IF NOT EXISTS report_versions_farm_created ON report_versions(farm_id,created_at);
CREATE INDEX IF NOT EXISTS report_versions_visit_status ON report_versions(visit_id,status);
INSERT OR IGNORE INTO app_meta VALUES ('application','avgust-care-desktop');
INSERT OR IGNORE INTO app_meta VALUES ('schema','1');`;

type Persist=()=>Promise<void>|void;

function bindParams(params:unknown[]){
 return params.map(value=>{
  if(value instanceof Uint8Array)return value;
  if(value===undefined)return null;
  if(typeof value==='boolean')return value?1:0;
  return value as string|number|null;
 });
}

class Sqlite{
 constructor(private database:Database){}
 exec(sql:string){this.database.exec(sql);}
 export(){return this.database.export();}
 close(){this.database.close();}
 prepare(sql:string){
  const database=this.database;
  return {
   get:(...params:unknown[])=>{
    const statement=database.prepare(sql);
    try{
     if(params.length)statement.bind(bindParams(params));
     return statement.step()?statement.getAsObject() as Record<string,unknown>:undefined;
    }finally{statement.free();}
   },
   all:(...params:unknown[])=>{
    const statement=database.prepare(sql);
    try{
     if(params.length)statement.bind(bindParams(params));
     const rows:Record<string,unknown>[]=[];
     while(statement.step())rows.push(statement.getAsObject() as Record<string,unknown>);
     return rows;
    }finally{statement.free();}
   },
   run:(...params:unknown[])=>{
    const statement=database.prepare(sql);
    try{
     if(params.length)statement.bind(bindParams(params));
     statement.step();
     return {changes:database.getRowsModified()};
    }finally{statement.free();}
   }
  };
 }
}

const text=(x:Record<string,unknown>,k:string,max=300)=>{if(typeof x[k]!=='string'||x[k].length>max)throw new Error('400:Campo inválido: '+k);return x[k].trim();};
const contactList=(x:Record<string,unknown>)=>{if(!Array.isArray(x.contacts)||!x.contacts.length||x.contacts.length>12)throw new Error('400:Contactos inválidos.');return x.contacts.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('400:Contacto inválido.');const c=raw as Record<string,unknown>;const name=text(c,'name'),role=text(c,'role'),phone=text(c,'phone'),email=text(c,'email');if(!name||!role||!phone||!/^\S+@\S+\.\S+$/.test(email)||typeof c.receiveReports!=='boolean')throw new Error('400:Completa nombre, cargo, teléfono y correo de cada contacto.');return {id:typeof c.id==='string'&&/^[a-f0-9-]{36}$/.test(c.id)?c.id:crypto.randomUUID(),name,role,phone,email,receiveReports:c.receiveReports};});};
const dateOK=(d:string)=>!d||/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
function padBase64(value:string){return value+'='.repeat((4-value.length%4)%4);}
function metricCursor(value:string){
 if(!value)return null;
 try{
  const parsed=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padBase64(value.replace(/-/g,'+').replace(/_/g,'/'))),c=>c.charCodeAt(0))));
  if(!Array.isArray(parsed)||parsed.length!==2||!parsed.every(x=>typeof x==='string')||!dateOK(parsed[0])||!/^[a-f0-9-]{36}$/.test(parsed[1]))throw new Error();
  return parsed as [string,string];
 }catch{throw new Error('400:Cursor inválido.');}
}
function metricCursorFor(row:{date:string;id:string}){
 const bytes=new TextEncoder().encode(JSON.stringify([row.date,row.id]));
 let binary='';
 bytes.forEach(b=>binary+=String.fromCharCode(b));
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
const publicMetric=(definition:ReturnType<typeof metricDefinition>)=>{if(!definition)throw new Error('400:Métrica no disponible para historial.');const {id,label,kind,unit,precision,tolerance,graphable}=definition;return {id,label,kind,unit,precision,tolerance,graphable};};
const localActionTransitions=(before:Record<string,Record<string,string>>|undefined,actions:Record<string,Record<string,string>>|undefined)=>{const at=new Date().toISOString(),result:Record<string,Record<string,string>>={};for(const [criterionId,value] of Object.entries(actions||{})){const previous=before?.[criterionId]||{},next={...value,completedAt:previous.completedAt||'',completedBy:previous.completedBy||'',reopenedAt:previous.reopenedAt||''} as Record<string,string>;if(next.status==='closed'&&previous.status!=='closed'){next.completedAt=at;next.completedBy='Responsable local';}else if(previous.status==='closed'&&next.status!=='closed')next.reopenedAt=at;result[criterionId]=next;}return result;};
function ascii(data:Uint8Array,start:number,end:number){return String.fromCharCode(...data.subarray(start,end));}

export class DeviceStore{
 constructor(private db:Sqlite,private persist:Persist=()=>{}){}
 private save(){return this.persist();}
 exportBytes(){return this.db.export();}
 farm(id:string){const f=this.db.prepare('SELECT * FROM farms WHERE id = ?').get(id) as {id:string;name:string}|undefined;if(!f)throw new Error('404:Finca no encontrada.');return f;}
 transaction<T>(fn:()=>T){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 team(){return {userId:'local',farms:this.db.prepare('SELECT * FROM farms ORDER BY name').all().map(f=>{const farm=f as {id:string;name:string;zone:string;contact:string;owner:string};return {...farm,role:'manager',members:this.db.prepare('SELECT user_id,name,role FROM farm_members WHERE farm_id = ? ORDER BY name').all(farm.id),contacts:this.db.prepare('SELECT id,name,role,phone,email,receive_reports FROM farm_contacts WHERE farm_id = ? ORDER BY name').all(farm.id).map(c=>{const row=c as {id:string;name:string;role:string;phone:string;email:string;receive_reports:number};return {id:row.id,name:row.name,role:row.role,phone:row.phone,email:row.email,receiveReports:Boolean(row.receive_reports)};})};})};}
 changeTeam(x:Record<string,unknown>){const op=text(x,'op');if(op==='create'){const name=text(x,'name'),zone=text(x,'zone'),contacts=contactList(x);if(!name)throw new Error('400:Escribe el nombre de la finca.');const id=crypto.randomUUID();this.transaction(()=>{this.db.prepare('INSERT INTO farms VALUES (?,?,?,?,?)').run(id,'local',name,zone,contacts[0]?.name||'');this.db.prepare('INSERT INTO farm_members VALUES (?,?,?,?)').run(id,'local','Responsable local','manager');for(const c of contacts)this.db.prepare('INSERT INTO farm_contacts VALUES (?,?,?,?,?,?,?)').run(c.id,id,c.name,c.role,c.phone,c.email,Number(c.receiveReports));});void this.save();return {id};}
  const farmId=text(x,'farmId',36);this.farm(farmId);if(op==='addLocal'){const name=text(x,'name');if(!name)throw new Error('400:Escribe el nombre del participante.');const id=crypto.randomUUID();this.db.prepare('INSERT INTO farm_members VALUES (?,?,?,?)').run(farmId,id,name,'editor');void this.save();return {id};}
  if(op==='contacts'){const contacts=contactList(x);this.transaction(()=>{this.db.prepare('DELETE FROM farm_contacts WHERE farm_id = ?').run(farmId);for(const c of contacts)this.db.prepare('INSERT INTO farm_contacts VALUES (?,?,?,?,?,?,?)').run(c.id,farmId,c.name,c.role,c.phone,c.email,Number(c.receiveReports));this.db.prepare('UPDATE farms SET contact = ? WHERE id = ?').run(contacts[0]?.name||'',farmId);});void this.save();return {ok:true};}
  if(op==='removeLocal'){const userId=text(x,'userId');if(userId==='local')throw new Error('400:No puedes retirar al responsable local.');const assigned=this.db.prepare('SELECT payload FROM service_requests WHERE farm_id = ?').all(farmId).some(r=>{const p=JSON.parse(String(r.payload));return p.rtc===userId||p.assignee===userId;});if(assigned)throw new Error('400:Reasigna las solicitudes de esta persona antes de retirarla.');this.db.prepare('DELETE FROM farm_members WHERE farm_id = ? AND user_id = ?').run(farmId,userId);void this.save();return {ok:true};}
  throw new Error('400:En esta edición no se utilizan cuentas ni invitaciones.');
 }
 requests(){return this.db.prepare('SELECT payload FROM service_requests ORDER BY rowid DESC').all().map(r=>JSON.parse(String(r.payload)));}
 saveRequest(x:Record<string,unknown>){const farmId=text(x,'farmId',36);this.farm(farmId);const id=(typeof x.id==='string'&&x.id)?text(x,'id',36):crypto.randomUUID(),revision=x.revision,kind=text(x,'kind'),reason=text(x,'reason',3000),date=text(x,'date',10),rtc=text(x,'rtc'),assignee=text(x,'assignee'),status=text(x,'status');if(!Number.isInteger(revision)||Number(revision)<0||!reason||!['assurance','training','calibration','followup'].includes(kind)||!dateOK(date)||!['requested','scheduled','done','cancelled'].includes(status))throw new Error('400:Completa correctamente la solicitud.');for(const person of [rtc,assignee].filter(Boolean))if(!this.db.prepare('SELECT 1 FROM farm_members WHERE farm_id = ? AND user_id = ?').get(farmId,person))throw new Error('400:El participante no está registrado en la finca.');if(status==='scheduled'&&(!date||!assignee))throw new Error('400:Asigna profesional y fecha para programar.');
  const old=this.db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id) as {farm_id:string;revision:number}|undefined;if(old&&(old.farm_id!==farmId||old.revision!==revision)||!old&&revision!==0)throw new Error('409:Actualiza la solicitud antes de guardar.');const saved={id,farmId,revision:Number(revision)+1,kind,reason,date,rtc,assignee,status};this.db.prepare('INSERT INTO service_requests VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload').run(id,farmId,saved.revision,JSON.stringify(saved));void this.save();return saved;
 }
 visits(){return this.db.prepare('SELECT payload FROM visits ORDER BY date DESC,rowid DESC').all().map(r=>({...JSON.parse(String(r.payload)),canEdit:true}));}
 saveVisit(input:unknown){const v=validate(input),farmId=v.farmId||null;const old=v.id?this.db.prepare('SELECT * FROM visits WHERE id = ?').get(v.id) as {farm_id:string|null;revision:number;payload:string}|undefined:undefined;if(v.id&&!old||old&&old.revision!==v.revision)throw new Error('409:La visita cambió. Actualiza antes de guardar.');if(old?.farm_id&&old.farm_id!==farmId)throw new Error('400:La visita ya está vinculada a una finca.');if(farmId)v.farm=this.farm(farmId).name;if(v.requestId){const request=this.db.prepare('SELECT farm_id FROM service_requests WHERE id = ?').get(v.requestId) as {farm_id:string}|undefined;if(!request||request.farm_id!==farmId)throw new Error('400:La solicitud no pertenece a esta finca.');}
  for(const p of v.photos){const photo=this.db.prepare('SELECT farm_id FROM photos WHERE id = ?').get(p.id) as {farm_id:string|null}|undefined;if(!photo||photo.farm_id&&photo.farm_id!==farmId)throw new Error('400:Fotografía no disponible para esta finca.');}
  const previous=old?JSON.parse(String(old.payload)):null,saved={...v,actions:localActionTransitions(previous?.actions,v.actions as never),id:v.id||crypto.randomUUID(),revision:v.revision+1,canEdit:true};this.transaction(()=>{this.db.prepare('INSERT INTO visits VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET farm_id=excluded.farm_id,revision=excluded.revision,date=excluded.date,payload=excluded.payload').run(saved.id,farmId,saved.revision,saved.date,JSON.stringify(saved));if(farmId)for(const p of saved.photos)this.db.prepare('UPDATE photos SET farm_id = ? WHERE id = ? AND farm_id IS NULL').run(farmId,p.id);this.db.prepare('DELETE FROM drafts WHERE id = ?').run('current');});void this.save();return saved;
 }
 reportSummary(row:Record<string,unknown>,includeSnapshot=false){const version:Record<string,unknown>={id:row.id,farmId:row.farm_id,visitId:row.visit_id,versionNumber:row.version_number,status:row.status,sourceVisitRevision:row.source_visit_revision,createdBy:row.created_by,createdAt:row.created_at,revision:row.revision,updatedAt:row.updated_at};for(const [local,publicName] of [['submitted_by','submittedBy'],['submitted_at','submittedAt'],['approved_by','approvedBy'],['approved_at','approvedAt'],['published_by','publishedBy'],['published_at','publishedAt']])if(row[local])version[publicName]=row[local];if(includeSnapshot&&typeof row.snapshot_json==='string')version.snapshot=JSON.parse(row.snapshot_json);return version;}
 reportVisit(id:string){const row=this.db.prepare('SELECT * FROM visits WHERE id = ?').get(id) as {id:string;farm_id:string|null;revision:number;payload:string}|undefined;if(!row)throw new Error('404:Visita no encontrada.');if(!row.farm_id)throw new Error('400:Vincula la visita a una finca para gestionar versiones de informe.');return {...row,visit:JSON.parse(row.payload) as Visit};}
  reportSnapshot(visit:Visit){const {id,revision,farmId,requestId:_request,canEdit:_edit,...content}=visit,items=catalog.filter(chapter=>content.chapters.includes(chapter.id)).flatMap(chapter=>chapter.items),answered=items.filter(item=>['SI','NO','NA'].includes(content.answers[item.id]?.value)),applicable=items.filter(item=>['SI','NO'].includes(content.answers[item.id]?.value)),positive=applicable.filter(item=>content.answers[item.id]?.value==='SI').length,score=applicable.length?Math.round(positive/applicable.length*100):null,status=score===null?'pending':score>=95?'healthy':score>=85?'acceptable':'critical';return {schema:1,source:{visitId:id,visitRevision:revision},farm:{name:content.farm,city:content.city,zone:content.zone,participants:this.db.prepare('SELECT name,role FROM farm_members WHERE farm_id = ? ORDER BY name').all(farmId)},content,sections:catalog.map(chapter=>({id:chapter.id,title:chapter.title,items:chapter.items.map(item=>({id:item.id,text:item.text}))})),indicator:{total:items.length,answered:answered.length,applicable:applicable.length,positive,findings:applicable.filter(item=>content.answers[item.id]?.value==='NO').length,score,status}};}
 reportEvent(farmId:string,reportId:string,event:string,details:Record<string,unknown>={}){this.db.prepare('INSERT INTO report_events VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(),farmId,reportId,event,JSON.stringify(details),new Date().toISOString());}
 reports(visitId:string){const visit=this.reportVisit(visitId);return {role:'manager',versions:this.db.prepare('SELECT * FROM report_versions WHERE visit_id = ? ORDER BY version_number DESC').all(visit.id).map(row=>this.reportSummary(row))};}
 report(id:string){const row=this.db.prepare('SELECT * FROM report_versions WHERE id = ?').get(id);if(!row)throw new Error('404:Versión de informe no encontrada.');return this.reportSummary(row,true);}
 changeReport(x:Record<string,unknown>){const op=text(x,'op',30);if(!['create','new_version','submit','return','approve','publish'].includes(op))throw new Error('400:Operación de informe inválida.');if(op==='create'||op==='new_version'){const visitId=text(x,'visitId',36),source=this.reportVisit(visitId),visit=source.visit;if(!visit.reviewed)throw new Error('422:Completa la revisión técnica de la visita antes de crear una versión de informe.');const rows=this.db.prepare('SELECT * FROM report_versions WHERE visit_id = ? ORDER BY version_number DESC').all(visitId);if(op==='create'&&rows.length)throw new Error('409:Esta visita ya tiene una versión de informe.');if(op==='new_version'&&(!rows.some(row=>row.status==='published')||rows.some(row=>['draft','in_review','approved'].includes(String(row.status)))))throw new Error('409:Publica la versión anterior y cierra la activa antes de crear una nueva.');const now=new Date().toISOString(),row={id:crypto.randomUUID(),farm_id:source.farm_id as string,visit_id:visitId,version_number:Number(rows[0]?.version_number||0)+1,status:'draft',source_visit_revision:source.revision,created_by:'Responsable local',created_at:now,submitted_by:null,submitted_at:null,approved_by:null,approved_at:null,published_by:null,published_at:null,snapshot_json:null,revision:1,updated_at:now};this.transaction(()=>{this.db.prepare('INSERT INTO report_versions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(row.id,row.farm_id,row.visit_id,row.version_number,row.status,row.source_visit_revision,row.created_by,row.created_at,null,null,null,null,null,null,null,row.revision,row.updated_at);this.reportEvent(row.farm_id,row.id,op==='create'?'report_draft_created':'report_version_created',{version:row.version_number,status:'draft'});});void this.save();return this.reportSummary(row);}
  const id=text(x,'id',36),row=this.db.prepare('SELECT * FROM report_versions WHERE id = ?').get(id) as Record<string,unknown>|undefined;if(!row)throw new Error('404:Versión de informe no encontrada.');if(!Number.isInteger(x.revision)||x.revision!==row.revision)throw new Error('409:La versión cambió en otra sesión. Actualiza antes de continuar.');const source=this.reportVisit(String(row.visit_id)),now=new Date().toISOString();let status=String(row.status),snapshot=row.snapshot_json as string|null,sourceRevision=Number(row.source_visit_revision),event='';if(op==='submit'){if(status!=='draft')throw new Error('409:Solo un borrador se puede enviar a revisión.');if(!source.visit.reviewed)throw new Error('422:Completa la revisión técnica de la visita antes de enviarla.');status='in_review';sourceRevision=source.revision;snapshot=JSON.stringify(this.reportSnapshot({...source.visit,id:source.id,revision:source.revision,farmId:source.farm_id||undefined}));row.submitted_by='Responsable local';row.submitted_at=now;event='report_submitted';}if(op==='return'){if(status!=='in_review')throw new Error('409:Solo un informe en revisión puede volver a borrador.');status='draft';sourceRevision=source.revision;snapshot=null;event='report_returned';}if(op==='approve'){if(status!=='in_review')throw new Error('409:Solo un informe en revisión puede aprobarse.');if(source.revision!==sourceRevision)throw new Error('409:La visita cambió después del envío. Devuelve el informe a borrador y envíalo de nuevo.');if(!snapshot)throw new Error('409:No hay una captura para aprobar.');status='approved';row.approved_by='Responsable local';row.approved_at=now;event='report_approved';}if(op==='publish'){if(status!=='approved'||!snapshot)throw new Error('409:Solo un informe aprobado con captura puede publicarse.');status='published';row.published_by='Responsable local';row.published_at=now;event='report_published';}const revision=Number(row.revision)+1;this.transaction(()=>{const saved=this.db.prepare('UPDATE report_versions SET status=?,source_visit_revision=?,snapshot_json=?,submitted_by=?,submitted_at=?,approved_by=?,approved_at=?,published_by=?,published_at=?,revision=?,updated_at=? WHERE id=? AND revision=?').run(status,sourceRevision,snapshot,row.submitted_by,row.submitted_at,row.approved_by,row.approved_at,row.published_by,row.published_at,revision,now,id,row.revision);if(!saved.changes)throw new Error('409:La versión cambió en otra sesión.');this.reportEvent(String(row.farm_id),id,event,{version:row.version_number,status});});void this.save();return this.reportSummary({...row,status,source_visit_revision:sourceRevision,snapshot_json:snapshot,revision,updated_at:now});
 }
 metricHistory(farmId:string,metricId:string,query:Record<string,string>={}){this.farm(farmId);const definition=metricDefinition(metricId);if(!definition||definition.kind!=='numeric'||!definition.graphable)throw new Error('400:Métrica no disponible para historial.');const from=query.from||'',to=query.to||'';if(!dateOK(from)||!dateOK(to)||from&&to&&from>to)throw new Error('400:Rango de fechas inválido.');const limit=Number(query.limit||30);if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('400:Límite inválido.');const cursor=metricCursor(query.cursor||'');const conditions=['farm_id = ?',"json_extract(payload, '$.reviewed') = 1"],values:unknown[]=[farmId];if(from){conditions.push('date >= ?');values.push(from);}if(to){conditions.push('date <= ?');values.push(to);}if(cursor){conditions.push('(date < ? OR date = ? AND id < ?)');values.push(cursor[0],cursor[0],cursor[1]);}const result=this.db.prepare(`SELECT id,date,payload FROM visits WHERE ${conditions.join(' AND ')} ORDER BY date DESC,id DESC LIMIT ?`).all(...values,limit+1),rows=result.slice(0,limit),points=rows.slice().reverse().flatMap(row=>{const visit=JSON.parse(String(row.payload)),reading=metricReading(visit,definition);return reading?.numericValue===undefined?[]:[{visitId:row.id,visitDate:row.date,originalValue:reading.originalValue,numericValue:reading.numericValue,unit:reading.unit,responsible:visit.responsible||''}];});const last=rows.at(-1) as {date:string;id:string}|undefined;return {farmId,metric:publicMetric(definition),points,nextCursor:result.length>limit&&last?metricCursorFor(last):null};}
 compareMetrics(farmId:string,input:Record<string,unknown>){this.farm(farmId);const visitAId=text(input,'visitAId',36),visitBId=text(input,'visitBId',36);if(!/^[a-f0-9-]{36}$/.test(visitAId)||!/^[a-f0-9-]{36}$/.test(visitBId)||visitAId===visitBId)throw new Error('400:Selecciona dos visitas diferentes.');const a=this.db.prepare('SELECT id,farm_id,date,payload FROM visits WHERE id = ? AND farm_id = ?').get(visitAId,farmId) as {id:string;date:string;payload:string}|undefined,b=this.db.prepare('SELECT id,farm_id,date,payload FROM visits WHERE id = ? AND farm_id = ?').get(visitBId,farmId) as {id:string;date:string;payload:string}|undefined;if(!a||!b)throw new Error('404:Una de las visitas no pertenece a esta finca.');const [previousRow,currentRow]=(a.date.localeCompare(b.date)||a.id.localeCompare(b.id))<=0?[a,b]:[b,a],previousVisit=JSON.parse(previousRow.payload),currentVisit=JSON.parse(currentRow.payload);if(!previousVisit.reviewed||!currentVisit.reviewed)throw new Error('422:Las dos visitas deben estar revisadas para compararlas.');const onlyPrevious:string[]=[],onlyCurrent:string[]=[],comparisons=metricDefinitions.flatMap(definition=>{const previous=metricReading(previousVisit,definition),current=metricReading(currentVisit,definition);if(previous&&!current){onlyPrevious.push(definition.id);return [];}if(!previous&&current){onlyCurrent.push(definition.id);return [];}if(!previous||!current)return [];const comparison=compareMetricReadings(previous,current,definition);return [{metric:publicMetric(definition),previous:{originalValue:previous.originalValue,numericValue:previous.numericValue,textValue:previous.textValue,unit:previous.unit},current:{originalValue:current.originalValue,numericValue:current.numericValue,textValue:current.textValue,unit:current.unit},comparison}];});return {farmId,previous:{id:previousRow.id,date:previousRow.date,responsible:previousVisit.responsible||'Responsable local'},current:{id:currentRow.id,date:currentRow.date,responsible:currentVisit.responsible||'Responsable local'},comparisons,onlyPrevious,onlyCurrent};}
 savePhoto(data:Uint8Array,farmId:string|null){if(data.length>MAX_PHOTO_BYTES)throw new Error('413:La fotografía supera 8 MB.');if(farmId)this.farm(farmId);let mime:string;if(data[0]===255&&data[1]===216&&data[2]===255)mime='image/jpeg';else if(data[0]===137&&data[1]===80&&data[2]===78&&data[3]===71)mime='image/png';else if(ascii(data,0,4)==='RIFF'&&ascii(data,8,12)==='WEBP')mime='image/webp';else throw new Error('400:Selecciona una imagen JPG, PNG o WebP.');const id=crypto.randomUUID();this.db.prepare('INSERT INTO photos VALUES (?,?,?,?)').run(id,farmId||null,mime,data);void this.save();return {id};}
 photo(id:string){const p=this.db.prepare('SELECT mime,data FROM photos WHERE id = ?').get(id) as {mime:string;data:Uint8Array}|undefined;if(!p)throw new Error('404:Fotografía no encontrada.');return p;}
 visit(id:string){const row=this.db.prepare('SELECT payload FROM visits WHERE id = ?').get(id) as {payload:string}|undefined;if(!row)throw new Error('404:Visita no encontrada.');return {...JSON.parse(row.payload),canEdit:true};}
 draft(){const x=this.db.prepare('SELECT payload FROM drafts WHERE id = ?').get('current') as {payload:string}|undefined;return x?JSON.parse(x.payload):null;}
 saveDraft(v:unknown){if(!v||typeof v!=='object'||!Array.isArray((v as {photos?:unknown}).photos)||typeof (v as {farm?:unknown}).farm!=='string')throw new Error('400:Borrador inválido.');this.db.prepare('INSERT INTO drafts VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run('current',JSON.stringify(v));void this.save();return {ok:true};}
 clearDraft(){this.db.prepare('DELETE FROM drafts WHERE id = ?').run('current');void this.save();return {ok:true};}
 private dropReports(visitId:string){const versions=this.db.prepare('SELECT id FROM report_versions WHERE visit_id = ?').all(visitId);for(const row of versions)this.db.prepare('DELETE FROM report_events WHERE report_version_id = ?').run(row.id);this.db.prepare('DELETE FROM report_versions WHERE visit_id = ?').run(visitId);}
 private dropVisitRow(row:{id:string;payload:string}){const visit=JSON.parse(row.payload) as Visit;this.dropReports(row.id);for(const photo of visit.photos||[])this.db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);this.db.prepare('DELETE FROM visits WHERE id = ?').run(row.id);const draft=this.draft() as {id?:string}|null;if(draft?.id===row.id)this.db.prepare('DELETE FROM drafts WHERE id = ?').run('current');}
 deleteVisit(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('404:Visita no encontrada.');const row=this.db.prepare('SELECT id,payload FROM visits WHERE id = ?').get(id) as {id:string;payload:string}|undefined;if(!row)throw new Error('404:Visita no encontrada.');this.transaction(()=>this.dropVisitRow(row));void this.save();return {ok:true};}
 deleteReport(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('404:Versión de informe no encontrada.');const row=this.db.prepare('SELECT id FROM report_versions WHERE id = ?').get(id);if(!row)throw new Error('404:Versión de informe no encontrada.');this.transaction(()=>{this.db.prepare('DELETE FROM report_events WHERE report_version_id = ?').run(id);this.db.prepare('DELETE FROM report_versions WHERE id = ?').run(id);});void this.save();return {ok:true};}
 deleteRequest(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('404:Solicitud no encontrada.');const row=this.db.prepare('SELECT id FROM service_requests WHERE id = ?').get(id);if(!row)throw new Error('404:Solicitud no encontrada.');this.db.prepare('DELETE FROM service_requests WHERE id = ?').run(id);void this.save();return {ok:true};}
 deleteFarm(id:string){this.farm(id);this.transaction(()=>{for(const row of this.db.prepare('SELECT id,payload FROM visits WHERE farm_id = ?').all(id) as {id:string;payload:string}[])this.dropVisitRow(row);this.db.prepare('DELETE FROM photos WHERE farm_id = ?').run(id);this.db.prepare('DELETE FROM report_events WHERE farm_id = ?').run(id);this.db.prepare('DELETE FROM report_versions WHERE farm_id = ?').run(id);this.db.prepare('DELETE FROM service_requests WHERE farm_id = ?').run(id);this.db.prepare('DELETE FROM farm_contacts WHERE farm_id = ?').run(id);this.db.prepare('DELETE FROM farm_members WHERE farm_id = ?').run(id);this.db.prepare('DELETE FROM farms WHERE id = ?').run(id);const draft=this.draft() as {farmId?:string}|null;if(draft?.farmId===id)this.db.prepare('DELETE FROM drafts WHERE id = ?').run('current');});void this.save();return {ok:true};}
 inspect(bytes:Uint8Array,SQL:SqlJsStatic){
  const probe=new Sqlite(new SQL.Database(bytes));
  try{
   if(probe.prepare("SELECT value FROM app_meta WHERE key='application'").get()?.value!=='avgust-care-desktop'||probe.prepare("SELECT value FROM app_meta WHERE key='schema'").get()?.value!=='1')throw new Error('Formato de respaldo incompatible.');
   const check=probe.prepare('PRAGMA quick_check').get();
   if(check&&String(Object.values(check)[0])!=='ok')throw new Error('El respaldo está dañado.');
   const expected=this.db.prepare("SELECT name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
   const actual=probe.prepare("SELECT name,sql FROM sqlite_master WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
   if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error('La estructura del respaldo no es compatible.');
   for(const r of probe.prepare('SELECT payload FROM visits').all())validate(JSON.parse(String(r.payload)));
  }finally{probe.close();}
 }
}

let engine:SqlJsStatic|null=null;
export async function sqlEngine(locateFile?:(file:string)=>string){
 if(!engine)engine=await initSqlJs({locateFile:locateFile||(file=>file)});
 return engine;
}
export async function openDeviceStore(bytes:Uint8Array|undefined,persist:Persist,locateFile?:(file:string)=>string){
 const SQL=await sqlEngine(locateFile);
 const sqlite=new Sqlite(bytes?.length?new SQL.Database(bytes):new SQL.Database());
 sqlite.exec(DEVICE_SCHEMA);
 return new DeviceStore(sqlite,persist);
}
export function replaceDeviceStore(current:DeviceStore,bytes:Uint8Array,SQL:SqlJsStatic,persist:Persist){
 current.inspect(bytes,SQL);
 const sqlite=new Sqlite(new SQL.Database(bytes));
 sqlite.exec(DEVICE_SCHEMA);
 return new DeviceStore(sqlite,persist);
}
