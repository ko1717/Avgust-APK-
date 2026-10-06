import {db,files,identity,failure,body} from '@/lib/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {access} from '@/lib/team-server';
import {validate} from '@/lib/validate';
import {serviceLabels} from '@/lib/team';
import {isReportStatus} from '@/lib/reports';

const FORMAT='avgust-care-360-account-backup';
const VERSION=1;
const MAX_BACKUP_BYTES=16*1024*1024;
const MAX_PHOTO_BYTES=8*1024*1024;
const ID=/^[a-f0-9-]{36}$/i;
type BackupFarm={id:string;owner:string;name:string;zone:string;contact:string;contacts:{id:string;name:string;role:string;phone:string;email:string;receive_reports:number|boolean}[]};
type BackupPhoto={id:string;farmId:string|null;mime:string;data:string};
type BackupBundle={format:string;version:number;accountId:string;createdAt:string;farms:BackupFarm[];visits:Record<string,unknown>[];requests:Record<string,unknown>[];reports:Record<string,unknown>[];photos:BackupPhoto[]};
type VisitRow={id:string;farm_id:string|null;owner:string;farm:string;date:string;payload:string;revision:number;updated:string};
type PhotoRow={id:string;owner:string;farm_id:string|null;key:string;mime:string};
type ReportRow={id:string;farm_id:string;visit_id:string;version_number:number;status:string;source_visit_revision:number;created_by:string;created_at:string;submitted_by:string|null;submitted_at:string|null;approved_by:string|null;approved_at:string|null;published_by:string|null;published_at:string|null;snapshot_json:string|null;revision:number;updated_at:string};

function encodeBase64(bytes:Uint8Array){
 let binary='';
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
 return btoa(binary);
}
function decodePhoto(photo:BackupPhoto){
 if(typeof photo.data!=='string'||photo.data.length>Math.ceil(MAX_PHOTO_BYTES*4/3)+8||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(photo.data))throw new Error('400:Una fotografía del respaldo no tiene un formato válido.');
 let binary:string;
 try{binary=atob(photo.data);}catch{throw new Error('400:Una fotografía del respaldo no se puede leer.');}
 if(!binary.length||binary.length>MAX_PHOTO_BYTES)throw new Error('413:Cada fotografía debe pesar máximo 8 MB.');
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 const mime=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':new TextDecoder().decode(bytes.subarray(0,4))==='RIFF'&&new TextDecoder().decode(bytes.subarray(8,12))==='WEBP'?'image/webp':'';
 if(!mime||photo.mime!==mime)throw new Error('400:El contenido de una fotografía no coincide con su tipo declarado.');
 return bytes;
}
function requiredString(value:unknown,max=500){
 if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error('400:El respaldo contiene un campo inválido.');
 return value.trim();
}
function requiredId(value:unknown){
 if(typeof value!=='string'||!ID.test(value))throw new Error('400:El respaldo contiene un identificador inválido.');
 return value;
}
function dataUrlSize(bundle:BackupBundle){return new TextEncoder().encode(JSON.stringify(bundle)).byteLength;}
async function accessibleFarms(user:string){
 const rows=await db().prepare('SELECT f.id,f.owner,f.name,f.zone,f.contact FROM farms f JOIN farm_members m ON m.farm_id=f.id WHERE m.user_id=? ORDER BY f.name').bind(user).all<{id:string;owner:string;name:string;zone:string;contact:string}>();
 const result:BackupFarm[]=[];
 for(const farm of rows.results){
  const contacts=await db().prepare('SELECT id,name,role,phone,email,receive_reports FROM farm_contacts WHERE farm_id=? ORDER BY name').bind(farm.id).all<BackupFarm['contacts'][number]>();
  result.push({...farm,contacts:contacts.results});
 }
 return result;
}
async function exportBundle(user:string):Promise<BackupBundle>{
 const farms=await accessibleFarms(user);
 const visits=await db().prepare("SELECT v.id,v.farm_id,v.owner,v.farm,v.date,v.payload,v.revision,v.updated FROM visits v LEFT JOIN farm_members m ON m.farm_id=v.farm_id AND m.user_id=? WHERE (v.farm_id IS NULL AND v.owner=?) OR m.user_id IS NOT NULL ORDER BY v.date,v.id").bind(user,user).all<VisitRow>();
 const requests=await db().prepare('SELECT r.id,r.farm_id,r.owner,r.revision,r.payload FROM service_requests r JOIN farm_members m ON m.farm_id=r.farm_id WHERE m.user_id=? ORDER BY r.farm_id,r.id').bind(user).all<{payload:string}>();
 const reports=await db().prepare('SELECT r.* FROM report_versions r JOIN farm_members m ON m.farm_id=r.farm_id WHERE m.user_id=? ORDER BY r.farm_id,r.visit_id,r.version_number').bind(user).all<ReportRow>();
 const photoRows=await db().prepare("SELECT p.id,p.owner,p.farm_id,p.key,p.mime FROM photos p LEFT JOIN farm_members m ON m.farm_id=p.farm_id AND m.user_id=? WHERE (p.farm_id IS NULL AND p.owner=?) OR m.user_id IS NOT NULL ORDER BY p.id").bind(user,user).all<PhotoRow>();
 const photos:BackupPhoto[]=[];
 for(const row of photoRows.results){
  const object=await files().get(row.key);
  if(!object)throw new Error('500:No se pudo leer una fotografía autorizada para crear el respaldo.');
  const bytes=new Uint8Array(await object.arrayBuffer());
  if(bytes.byteLength>MAX_PHOTO_BYTES)throw new Error('413:Una fotografía supera el límite de 8 MB y no se pudo incluir en el respaldo.');
  photos.push({id:row.id,farmId:row.farm_id,mime:row.mime,data:encodeBase64(bytes)});
 }
 const bundle:BackupBundle={
  format:FORMAT,version:VERSION,accountId:user,createdAt:new Date().toISOString(),farms,
  visits:visits.results.map(row=>({...JSON.parse(row.payload),id:row.id,revision:row.revision,farmId:row.farm_id||undefined})),
  requests:requests.results.map(row=>JSON.parse(row.payload)),
  reports:reports.results.map(({snapshot_json,...row})=>({...row,snapshot:snapshot_json?JSON.parse(snapshot_json):null})),
  photos,
 };
 if(dataUrlSize(bundle)>MAX_BACKUP_BYTES)throw new Error('413:El respaldo supera el límite actual de 16 MB. No se generó un archivo parcial; la exportación por partes todavía no está disponible.');
 return bundle;
}
function validateBundle(input:unknown,user:string):BackupBundle{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('400:El archivo no es un respaldo AVGUST CARE 360.');
 const x=input as Record<string,unknown>;
 if(x.format!==FORMAT||x.version!==VERSION)throw new Error('400:El formato o la versión del respaldo no es compatible.');
 if(x.accountId!==user)throw new Error('403:Este respaldo pertenece a otra cuenta. Inicia sesión con la cuenta que lo creó.');
 if(!Array.isArray(x.farms)||!Array.isArray(x.visits)||!Array.isArray(x.requests)||!Array.isArray(x.reports)||!Array.isArray(x.photos))throw new Error('400:El respaldo está incompleto.');
 if(x.farms.length>2000||x.visits.length>10000||x.requests.length>10000||x.reports.length>10000||x.photos.length>10000)throw new Error('413:El respaldo supera la cantidad de registros permitida.');
 requiredString(x.createdAt,40);
 const farms=x.farms.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('400:Finca inválida en el respaldo.');
  const f=raw as Record<string,unknown>;
  if(!Array.isArray(f.contacts)||f.contacts.length>12)throw new Error('400:Contactos inválidos en el respaldo.');
  return {id:requiredId(f.id),owner:requiredString(f.owner,300),name:requiredString(f.name,300),zone:typeof f.zone==='string'?f.zone.slice(0,300):'',contact:typeof f.contact==='string'?f.contact.slice(0,300):'',contacts:f.contacts.map(rawContact=>{
   if(!rawContact||typeof rawContact!=='object'||Array.isArray(rawContact))throw new Error('400:Contacto inválido en el respaldo.');
   const c=rawContact as Record<string,unknown>;
   if(![true,false,0,1].includes(c.receive_reports as boolean|number))throw new Error('400:Preferencia de contacto inválida en el respaldo.');
   return {id:requiredId(c.id),name:requiredString(c.name),role:requiredString(c.role),phone:requiredString(c.phone),email:requiredString(c.email),receive_reports:c.receive_reports===true||c.receive_reports===1?1:0};
  })};
 });
 const visits=x.visits.map(v=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('400:Visita inválida en el respaldo.');validate(v);return v as Record<string,unknown>;});
 const requests=x.requests.map(r=>{
  if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('400:Solicitud inválida en el respaldo.');
  const request=r as Record<string,unknown>;
  requiredId(request.id);requiredId(request.farmId);requiredString(request.kind,40);requiredString(request.reason,3000);requiredString(request.date,10);requiredString(request.status,20);
  if(!Object.hasOwn(serviceLabels,String(request.kind))||!['requested','scheduled','done','cancelled'].includes(String(request.status))||!Number.isInteger(request.revision)||Number(request.revision)<1||!/^\d{4}-\d{2}-\d{2}$/.test(String(request.date))||!Number.isFinite(Date.parse(String(request.date))))throw new Error('400:Una solicitud del respaldo contiene datos inválidos.');
  for(const key of ['rtc','assignee'])if(request[key]!==undefined&&typeof request[key]!=='string')throw new Error('400:Participante inválido en una solicitud del respaldo.');
  return request;
 });
 const reports=x.reports.map(r=>{
  if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('400:Informe inválido en el respaldo.');
  const report=r as Record<string,unknown>;
  requiredId(report.id);requiredId(report.farm_id);requiredId(report.visit_id);requiredString(report.created_by,300);requiredString(report.created_at,40);requiredString(report.updated_at,40);
  if(!isReportStatus(report.status)||!Number.isInteger(report.version_number)||Number(report.version_number)<1||!Number.isInteger(report.revision)||Number(report.revision)<1||!Number.isInteger(report.source_visit_revision)||Number(report.source_visit_revision)<0)throw new Error('400:Una versión de informe del respaldo no es válida.');
  if(report.snapshot!==null&&report.snapshot!==undefined){
   const snapshot=report.snapshot as Record<string,unknown>,source=snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)?snapshot.source as Record<string,unknown>:null;
   if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||snapshot.schema!==1||!source||typeof source!=='object'||Array.isArray(source)||typeof source.visitId!=='string'||!snapshot.content||typeof snapshot.content!=='object'||Array.isArray(snapshot.content))throw new Error('400:Una captura de informe no es compatible.');
  }
  return report;
 });
 const photos=x.photos.map(p=>{
  if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('400:Fotografía inválida en el respaldo.');
  const photo=p as Record<string,unknown>;
  if(!['image/jpeg','image/png','image/webp'].includes(String(photo.mime)))throw new Error('400:Tipo de fotografía no permitido.');
  const normalized={id:requiredId(photo.id),farmId:photo.farmId===null?null:requiredId(photo.farmId),mime:String(photo.mime),data:requiredString(photo.data,Math.ceil(MAX_PHOTO_BYTES*4/3)+8)};
  decodePhoto(normalized);
  return normalized;
 });
 if(new Set(farms.map(f=>f.id)).size!==farms.length||new Set(photos.map(p=>p.id)).size!==photos.length)throw new Error('400:El respaldo contiene identificadores duplicados.');
 return {format:FORMAT,version:VERSION,accountId:user,createdAt:String(x.createdAt),farms,visits,requests,reports,photos};
}
function deterministicId(digest:Uint8Array){
 const bytes=digest.slice(0,16);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}
async function stableId(value:string){
 return deterministicId(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
}
function remapVisit(input:Record<string,unknown>,farmId:string|null,farmName:string,photoIds:Map<string,string>,requestIds:Set<string>){
 const source=JSON.parse(JSON.stringify(input)) as Record<string,unknown>;
 source.farmId=farmId||undefined;source.farm=farmName;
 if(typeof source.requestId==='string'&&!requestIds.has(source.requestId))throw new Error('400:Una visita hace referencia a una solicitud que no está incluida.');
 if(Array.isArray(source.photos))source.photos=source.photos.map(raw=>{const photo=raw as Record<string,unknown>;return {...photo,id:photoIds.get(String(photo.id))||String(photo.id)};});
 if(source.actions&&typeof source.actions==='object')for(const action of Object.values(source.actions as Record<string,Record<string,unknown>>)){
  if(typeof action.photoId==='string')action.photoId=photoIds.get(action.photoId)||action.photoId;
  if(typeof action.beforePhotoId==='string')action.beforePhotoId=photoIds.get(action.beforePhotoId)||action.beforePhotoId;
 }
 return validate(source);
}
function rewriteSnapshot(value:unknown,visitId:string,photoIds:Map<string,string>){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('400:Una captura de informe no es válida.');
 const snapshot=JSON.parse(JSON.stringify(value)) as Record<string,unknown>,source=snapshot.source as Record<string,unknown>;
 if(!source||snapshot.schema!==1||source.visitId!==visitId)throw new Error('400:Una captura de informe no es compatible con su visita.');
 const content=snapshot.content as Record<string,unknown>;
 if(content&&Array.isArray(content.photos))content.photos=content.photos.map(raw=>{const photo=raw as Record<string,unknown>;return {...photo,id:photoIds.get(String(photo.id))||String(photo.id)};});
 if(content?.actions&&typeof content.actions==='object')for(const action of Object.values(content.actions as Record<string,Record<string,unknown>>)){
  if(typeof action.photoId==='string')action.photoId=photoIds.get(action.photoId)||action.photoId;
  if(typeof action.beforePhotoId==='string')action.beforePhotoId=photoIds.get(action.beforePhotoId)||action.beforePhotoId;
 }
 return snapshot;
}
export async function GET(req:Request){
 try{const user=await identity(req);const bundle=await exportBundle(user);return Response.json(bundle,{headers:{'Cache-Control':'no-store','Content-Disposition':'attachment; filename="avgust-care-360-respaldo.json"'}});}
 catch(error){return failure(error);}
}
export async function POST(req:Request){
 const createdObjects:string[]=[];
 const result={farmsCreated:0,visitsImported:0,requestsImported:0,reportsImported:0,photosImported:0,skipped:0};
 try{
  const user=await identity(req,true);
  let raw:unknown;
  try{raw=JSON.parse(new TextDecoder().decode(await body(req,MAX_BACKUP_BYTES)));}catch(error){if(error instanceof SyntaxError)throw new Error('400:El archivo de respaldo no contiene JSON válido.');throw error;}
  const bundle=validateBundle(raw,user),profile=await getChatGPTUser();
  const farmIds=new Map<string,string>(),farmNames=new Map<string,string>(),farmRoles=new Map<string,string>();
  for(const farm of bundle.farms){
   const member=await db().prepare('SELECT role FROM farm_members WHERE farm_id=? AND user_id=?').bind(farm.id,user).first<{role:string}>();
   if(member){if(member.role==='viewer'){result.skipped++;continue;}farmIds.set(farm.id,farm.id);farmNames.set(farm.id,farm.name);farmRoles.set(farm.id,member.role);continue;}
   if(farm.owner!==user){result.skipped++;continue;}
   const occupied=await db().prepare('SELECT id FROM farms WHERE id=?').bind(farm.id).first();
   const id=occupied?await stableId(`${user}:${farm.id}:restored-farm`):farm.id;
   const restored=occupied?await db().prepare('SELECT f.owner,m.role FROM farms f JOIN farm_members m ON m.farm_id=f.id WHERE f.id=? AND m.user_id=?').bind(id,user).first<{owner:string;role:string}>():null;
   if(restored){farmIds.set(farm.id,id);farmNames.set(farm.id,farm.name);farmRoles.set(farm.id,restored.role);continue;}
   if(occupied&&await db().prepare('SELECT id FROM farms WHERE id=?').bind(id).first()){result.skipped++;continue;}
   await db().batch([db().prepare('INSERT INTO farms (id,owner,name,zone,contact) VALUES (?,?,?,?,?)').bind(id,user,farm.name,farm.zone,farm.contact),db().prepare('INSERT INTO farm_members (farm_id,user_id,name,role) VALUES (?,?,?,?)').bind(id,user,profile?.displayName||'', 'manager')]);
   result.farmsCreated++;farmIds.set(farm.id,id);farmNames.set(farm.id,farm.name);farmRoles.set(farm.id,'manager');
  }
  const photoIds=new Map<string,string>(),photoBytes=new Map<string,Uint8Array>(),missingObjects=new Map<string,string>();
  for(const photo of bundle.photos){
   const mappedFarm=photo.farmId?farmIds.get(photo.farmId):null;
   if(photo.farmId&&!mappedFarm){result.skipped++;continue;}
   const bytes=decodePhoto(photo);let id=photo.id;
   const existing=await db().prepare('SELECT owner,farm_id,mime,key FROM photos WHERE id=?').bind(id).first<{owner:string;farm_id:string|null;mime:string;key:string}>();
   let samePhoto=false,missingObject=false;
   if(existing&&existing.owner===user&&existing.farm_id===(mappedFarm||null)&&existing.mime===photo.mime){
    const object=await files().get(existing.key);
    if(object){const stored=new Uint8Array(await object.arrayBuffer());samePhoto=stored.length===bytes.length&&stored.every((byte,index)=>byte===bytes[index]);}
    else missingObject=true;
   }
   if(existing&&!samePhoto&&!missingObject){
    const sourceHash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const seed=new TextEncoder().encode(`${photo.id}:${encodeBase64(sourceHash)}`);
    id=deterministicId(new Uint8Array(await crypto.subtle.digest('SHA-256',seed)));
   }
   photoIds.set(photo.id,id);photoBytes.set(id,bytes);if(missingObject)missingObjects.set(id,existing!.key);
  }
  for(const farm of bundle.farms){
   const target=farmIds.get(farm.id);if(!target)continue;
   if(farmRoles.get(farm.id)!=='manager'){result.skipped+=farm.contacts.length;continue;}
   for(const contact of farm.contacts){
    const inserted=await db().prepare('INSERT OR IGNORE INTO farm_contacts (id,farm_id,name,role,phone,email,receive_reports) VALUES (?,?,?,?,?,?,?)').bind(contact.id,target,contact.name,contact.role,contact.phone,contact.email,contact.receive_reports).run();
    if(!inserted.meta.changes)result.skipped++;
   }
  }
  const requestIds=new Set<string>();
  for(const request of bundle.requests){
   const id=requiredId(request.id),oldFarm=requiredId(request.farmId),farmId=farmIds.get(oldFarm);
   if(!farmId){result.skipped++;continue;}
   const kind=requiredString(request.kind,40),reason=requiredString(request.reason,3000),date=requiredString(request.date,10),status=requiredString(request.status,20);
   const rtc=typeof request.rtc==='string'?request.rtc:'',assignee=typeof request.assignee==='string'?request.assignee:'';
   if(farmRoles.get(oldFarm)!=='manager'&&(rtc||assignee)){result.skipped++;continue;}
   let participantsValid=true;
   for(const target of [rtc,assignee].filter(Boolean)){try{await access(target,farmId,'edit');}catch{participantsValid=false;}}
   if(!participantsValid){result.skipped++;continue;}
   const saved={id,farmId,revision:Number(request.revision),kind,reason,date,rtc,assignee,status};
   const inserted=await db().prepare('INSERT OR IGNORE INTO service_requests (id,farm_id,owner,revision,payload) VALUES (?,?,?,?,?)').bind(id,farmId,user,saved.revision,JSON.stringify(saved)).run();
   if(inserted.meta.changes){requestIds.add(id);result.requestsImported++;}
   else {
    const existing=await db().prepare('SELECT farm_id FROM service_requests WHERE id=?').bind(id).first<{farm_id:string}>();
    if(existing?.farm_id===farmId)requestIds.add(id);else result.skipped++;
   }
  }
  for(const [id,bytes] of photoBytes){
   const existing=await db().prepare('SELECT owner,farm_id,mime,key FROM photos WHERE id=?').bind(id).first<{owner:string;farm_id:string|null;mime:string;key:string}>();
   const source=bundle.photos.find(photo=>photoIds.get(photo.id)===id)!;
   const mappedFarm=source.farmId?farmIds.get(source.farmId)||null:null;
   if(existing){
    if(existing.owner===user&&existing.farm_id===(mappedFarm||null)&&existing.mime===source.mime){
     const object=await files().get(existing.key);
     if(object){const stored=new Uint8Array(await object.arrayBuffer());if(stored.length===bytes.length&&stored.every((byte,index)=>byte===bytes[index]))continue;}
     else if(missingObjects.get(id)===existing.key){
      await files().put(existing.key,bytes,{httpMetadata:{contentType:source.mime}});createdObjects.push(existing.key);result.photosImported++;continue;
     }
    }
    result.skipped++;continue;
   }
   const key=`photos/${user}/${id}/${crypto.randomUUID()}`;
   await files().put(key,bytes,{httpMetadata:{contentType:source.mime}});createdObjects.push(key);
   const inserted=await db().prepare('INSERT OR IGNORE INTO photos (id,owner,key,mime,farm_id) VALUES (?,?,?,?,?)').bind(id,user,key,source.mime,mappedFarm).run();
   if(inserted.meta.changes)result.photosImported++;else result.skipped++;
  }
  for(const rawVisit of bundle.visits){
   const id=requiredId(rawVisit.id),oldFarm=typeof rawVisit.farmId==='string'?requiredId(rawVisit.farmId):null;
   const farmId=oldFarm?farmIds.get(oldFarm)||null:null;
   if(oldFarm&&!farmId){result.skipped++;continue;}
   const already=await db().prepare('SELECT id FROM visits WHERE id=?').bind(id).first();
   if(already){result.skipped++;continue;}
   const farmName=oldFarm?farmNames.get(oldFarm)||String(rawVisit.farm):String(rawVisit.farm);
   const visit=remapVisit(rawVisit,farmId,farmName,photoIds,requestIds);
   const refs=visit.photos.map(photo=>photo.id);
   const authorized=await db().prepare(`SELECT id FROM photos WHERE id IN (${refs.length?refs.map(()=>'?').join(','):"''"}) AND owner=?`).bind(...refs,user).all<{id:string}>();
   if(authorized.results.length!==refs.length){result.skipped++;continue;}
   const updated=typeof rawVisit.updated==='string'?rawVisit.updated:new Date().toISOString();
   const inserted=await db().prepare('INSERT OR IGNORE INTO visits (id,owner,farm,farm_id,date,payload,revision,updated) VALUES (?,?,?,?,?,?,?,?)').bind(visit.id,user,visit.farm,farmId,visit.date,JSON.stringify(visit),visit.revision,updated).run();
   if(inserted.meta.changes)result.visitsImported++;else result.skipped++;
  }
  for(const raw of bundle.reports){
   const id=requiredId(raw.id),oldFarm=requiredId(raw.farm_id),oldVisit=requiredId(raw.visit_id),farmId=farmIds.get(oldFarm);
   if(!farmId||farmRoles.get(oldFarm)!=='manager'){result.skipped++;continue;}
   const visit=await db().prepare('SELECT farm_id FROM visits WHERE id=?').bind(oldVisit).first<{farm_id:string|null}>();
   if(!visit||visit.farm_id!==farmId){result.skipped++;continue;}
   const status=requiredString(raw.status,20);
   if(!isReportStatus(status)||!Number.isInteger(raw.version_number)||Number(raw.version_number)<1||!Number.isInteger(raw.revision)||Number(raw.revision)<1)throw new Error('400:Una versión de informe del respaldo no es válida.');
   const snapshot=raw.snapshot===null||raw.snapshot===undefined?null:rewriteSnapshot(raw.snapshot,oldVisit,photoIds);
   const inserted=await db().prepare('INSERT OR IGNORE INTO report_versions (id,farm_id,visit_id,version_number,status,source_visit_revision,created_by,created_at,submitted_by,submitted_at,approved_by,approved_at,published_by,published_at,snapshot_json,revision,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,farmId,oldVisit,Number(raw.version_number),status,Number(raw.source_visit_revision),requiredString(raw.created_by,300),requiredString(raw.created_at,40),typeof raw.submitted_by==='string'?raw.submitted_by:null,typeof raw.submitted_at==='string'?raw.submitted_at:null,typeof raw.approved_by==='string'?raw.approved_by:null,typeof raw.approved_at==='string'?raw.approved_at:null,typeof raw.published_by==='string'?raw.published_by:null,typeof raw.published_at==='string'?raw.published_at:null,snapshot?JSON.stringify(snapshot):null,Number(raw.revision),requiredString(raw.updated_at,40)).run();
   if(inserted.meta.changes)result.reportsImported++;else result.skipped++;
  }
  return Response.json({...result,message:'La fusión terminó. Los registros existentes se conservaron sin cambios.'});
 }catch(error){
  await Promise.all(createdObjects.map(async key=>{
   const row=await db().prepare('SELECT id FROM photos WHERE key=?').bind(key).first();
   if(!row)await files().delete(key);
  }));
  const failed=failure(error),detail=await failed.json() as {error:string};
  if(result.farmsCreated+result.visitsImported+result.requestsImported+result.reportsImported+result.photosImported){
   return Response.json({...result,error:`${detail.error} Se habían agregado algunos registros; el archivo se puede importar de nuevo sin sobrescribirlos.`},{status:failed.status});
  }
  return Response.json(detail,{status:failed.status});
 }
}
