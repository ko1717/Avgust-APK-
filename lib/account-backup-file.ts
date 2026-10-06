import {DEVICE_SCHEMA,sqlEngine} from './device-store';
import type {Database,SqlValue} from 'sql.js';
import {MAX_PHOTO_BYTES} from './model';

const MAX_BACKUP_BYTES=16*1024*1024;
type BackupBundle={
 format:string;version:number;accountId:string;createdAt:string;
 farms:{id:string;owner:string;name:string;zone:string;contact:string;contacts:{id:string;name:string;role:string;phone:string;email:string;receive_reports:number|boolean}[]}[];
 visits:Record<string,unknown>[];
 requests:Record<string,unknown>[];
 reports:Record<string,unknown>[];
 photos:{id:string;farmId:string|null;mime:string;data:string}[];
};
type LocalImport={bundle:BackupBundle;unassignedRequests:number};

function rows(database:Database,query:string){
 const statement=database.prepare(query),result:Record<string,SqlValue>[]=[];
 try{while(statement.step())result.push(statement.getAsObject() as Record<string,SqlValue>);}
 finally{statement.free();}
 return result;
}
function rowValue(row:Record<string,SqlValue>,key:string){return row[key];}
function requiredText(value:unknown,label:string){
 if(typeof value!=='string'||!value.trim())throw new Error(`El respaldo tiene ${label} inválidos.`);
 return value;
}
function parseJson(value:SqlValue|undefined,label:string){
 if(typeof value!=='string')throw new Error(`El respaldo tiene ${label} inválidos.`);
 try{return JSON.parse(value) as Record<string,unknown>;}
 catch{throw new Error(`No se pudo leer ${label} del respaldo.`);}
}
function base64(bytes:Uint8Array){
 let binary='';
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
 return btoa(binary);
}
function fromBase64(value:string){
 const binary=atob(value);
 return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
function bytesValue(value:SqlValue|undefined,label:string){
 if(!(value instanceof Uint8Array)||!value.length||value.length>MAX_PHOTO_BYTES)throw new Error(`La fotografía ${label} está vacía o supera 8 MB.`);
 return value;
}
export async function createCare360Backup(bundle:BackupBundle,locateFile?:(file:string)=>string){
 const SQL=await sqlEngine(locateFile),database=new SQL.Database();
 try{
  database.exec(DEVICE_SCHEMA);
  for(const farm of bundle.farms){
   database.run('INSERT INTO farms (id,owner,name,zone,contact) VALUES (?,?,?,?,?)',[farm.id,'local',farm.name,farm.zone,farm.contact]);
   database.run('INSERT INTO farm_members (farm_id,user_id,name,role) VALUES (?,?,?,?)',[farm.id,'local','Responsable local','manager']);
   for(const contact of farm.contacts){
   const flag=Number(contact.receive_reports)||((contact as unknown as {receiveReports?:boolean}).receiveReports?1:0)||0;
   database.run('INSERT INTO farm_contacts (id,farm_id,name,role,phone,email,receive_reports) VALUES (?,?,?,?,?,?,?)',[contact.id,farm.id,contact.name,contact.role,contact.phone,contact.email,flag]);
  }
  }
  for(const request of bundle.requests){
   const farmId=typeof request.farmId==='string'?request.farmId:'';
   const payload={...request,farmId,rtc:'',assignee:'',status:request.status==='scheduled'?'requested':request.status};
   database.run('INSERT INTO service_requests (id,farm_id,revision,payload) VALUES (?,?,?,?)',[requiredText(request.id,'identificadores de solicitud'),farmId,Number(request.revision)||1,JSON.stringify(payload)]);
  }
  for(const visit of bundle.visits)database.run('INSERT INTO visits (id,farm_id,revision,date,payload) VALUES (?,?,?,?,?)',[requiredText(visit.id,'identificadores de visita'),typeof visit.farmId==='string'?visit.farmId:null,Number(visit.revision)||1,typeof visit.date==='string'?visit.date:'',JSON.stringify(visit)]);
  for(const photo of bundle.photos)database.run('INSERT INTO photos (id,farm_id,mime,data) VALUES (?,?,?,?)',[photo.id,photo.farmId,photo.mime,fromBase64(photo.data)]);
  for(const report of bundle.reports){
   const creator=typeof report.created_by==='string'?report.created_by:'local';
   database.run('INSERT INTO report_versions (id,farm_id,visit_id,version_number,status,source_visit_revision,created_by,created_at,submitted_by,submitted_at,approved_by,approved_at,published_by,published_at,snapshot_json,revision,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[
    requiredText(report.id,'identificadores de informe'),requiredText(report.farm_id,'fincas de informe'),requiredText(report.visit_id,'visitas de informe'),Number(report.version_number),String(report.status),Number(report.source_visit_revision)||0,creator,requiredText(report.created_at,'fechas de informe'),
    typeof report.submitted_by==='string'?report.submitted_by:null,typeof report.submitted_at==='string'?report.submitted_at:null,
    typeof report.approved_by==='string'?report.approved_by:null,typeof report.approved_at==='string'?report.approved_at:null,
    typeof report.published_by==='string'?report.published_by:null,typeof report.published_at==='string'?report.published_at:null,
    report.snapshot?JSON.stringify(report.snapshot):null,Number(report.revision)||1,requiredText(report.updated_at,'fechas de informe')
   ]);
  }
  const bytes=database.export();
  if(bytes.byteLength>MAX_BACKUP_BYTES)throw new Error('El respaldo supera el límite de 16 MB.');
  return bytes;
 }finally{database.close();}
}
export async function readCare360Backup(bytes:Uint8Array,accountId:string,locateFile?:(file:string)=>string):Promise<LocalImport>{
 if(bytes.byteLength<100||bytes.byteLength>MAX_BACKUP_BYTES||new TextDecoder().decode(bytes.subarray(0,16))!=='SQLite format 3\u0000')throw new Error('El archivo no es un respaldo SQLite .care360 válido o supera 16 MB.');
 const SQL=await sqlEngine(locateFile);let database:InstanceType<typeof SQL.Database>;
 try{database=new SQL.Database(bytes);}catch{throw new Error('No se pudo abrir el archivo SQLite del respaldo.');}
 try{
  if(rows(database,"PRAGMA quick_check")[0]?.quick_check!=='ok')throw new Error('El respaldo SQLite está dañado.');
  const metadata=rows(database,'SELECT key,value FROM app_meta'),meta=new Map(metadata.map(row=>[String(row.key),String(row.value)]));
  const app=meta.get('application')||'';
  if(app&&!app.toLowerCase().includes('care')&&!app.toLowerCase().includes('avgust'))throw new Error('Este respaldo no es compatible con AVGUST CARE 360.');
  const farms=rows(database,'SELECT id,owner,name,zone,contact FROM farms'),contacts=rows(database,'SELECT id,farm_id,name,role,phone,email,receive_reports FROM farm_contacts');
  const members=rows(database,'SELECT farm_id,user_id,name,role FROM farm_members');
  const farmIds=new Set(farms.map(farm=>requiredText(rowValue(farm,'id'),'identificadores de finca')));
  const farmData=farms.map(farm=>{
   const id=requiredText(rowValue(farm,'id'),'identificadores de finca');
   return {id,owner:accountId,name:requiredText(rowValue(farm,'name'),'nombres de finca'),zone:typeof rowValue(farm,'zone')==='string'?String(rowValue(farm,'zone')):'',contact:typeof rowValue(farm,'contact')==='string'?String(rowValue(farm,'contact')):'',contacts:contacts.filter(contact=>contact.farm_id===id).map(contact=>({id:requiredText(rowValue(contact,'id'),'identificadores de contacto'),name:requiredText(rowValue(contact,'name'),'nombres de contacto'),role:requiredText(rowValue(contact,'role'),'cargos de contacto'),phone:requiredText(rowValue(contact,'phone'),'teléfonos de contacto'),email:requiredText(rowValue(contact,'email'),'correos de contacto'),receive_reports:Number(rowValue(contact,'receive_reports'))?1:0}))};
  });
  if(contacts.some(contact=>!farmIds.has(String(contact.farm_id))))throw new Error('El respaldo contiene contactos sin finca.');
  const localMemberIds=new Set(members.map(member=>`${String(member.farm_id)}:${String(member.user_id)}`));
  let unassignedRequests=0;
  const requests=rows(database,'SELECT id,farm_id,revision,payload FROM service_requests').map(row=>{
   const request=parseJson(row.payload,'una solicitud'),farmId=requiredText(rowValue(row,'farm_id'),'la finca de una solicitud');
   if(!farmIds.has(farmId))throw new Error('El respaldo contiene una solicitud sin finca.');
   let unassigned=false;
   for(const key of ['rtc','assignee'])if(typeof request[key]==='string'&&request[key]&&(!localMemberIds.has(`${farmId}:${String(request[key])}`)||request[key]!==accountId)){request[key]='';unassigned=true;}
   if(unassigned){unassignedRequests++;if(request.status==='scheduled')request.status='requested';}
   return request;
  });
  const visitsData=rows(database,'SELECT id,farm_id,revision,date,payload FROM visits').map(row=>{
   const visit=parseJson(row.payload,'una visita'),id=requiredText(rowValue(row,'id'),'identificadores de visita'),farmId=typeof row.farm_id==='string'?row.farm_id:null;
   if(farmId&&!farmIds.has(farmId))throw new Error('El respaldo contiene una visita sin finca.');
   visit.id=id;visit.farmId=farmId||undefined;visit.revision=Number(row.revision);if(typeof row.date==='string')visit.date=row.date;
   return visit;
  });
  const reportsData=rows(database,'SELECT * FROM report_versions').map(row=>{
   const report={...row} as Record<string,SqlValue>;
   let snapshot:Record<string,unknown>|null=null;
    if(typeof report.snapshot_json==='string')try{snapshot=JSON.parse(report.snapshot_json) as Record<string,unknown>;}catch{throw new Error('Una captura de informe no se puede leer.');}
   const creator=typeof report.created_by==='string'&&/^[a-f0-9-]{36}$/i.test(report.created_by)?report.created_by:accountId;
   const actor=(key:string)=>typeof report[key]==='string'&&/^[a-f0-9-]{36}$/i.test(String(report[key]))?report[key]:null;
   return {...report,created_by:creator,submitted_by:actor('submitted_by'),approved_by:actor('approved_by'),published_by:actor('published_by'),snapshot};
  });
  const photosData=rows(database,'SELECT id,farm_id,mime,data FROM photos').map(row=>{
   const id=requiredText(rowValue(row,'id'),'identificadores de fotografía'),farmId=typeof row.farm_id==='string'?row.farm_id:null,mime=requiredText(rowValue(row,'mime'),'tipos de fotografía');
   if(farmId&&!farmIds.has(farmId))throw new Error('El respaldo contiene una fotografía sin finca.');
   const data=bytesValue(rowValue(row,'data'),id);
   return {id,farmId,mime,data:base64(data)};
  });
  const photoIdSet=new Set(photosData.map(p=>p.id));
  for(const visit of visitsData)if(Array.isArray(visit.photos))visit.photos=(visit.photos as {id?:string}[]).filter(photo=>!photo.id||photoIdSet.has(photo.id));
  return {bundle:{format:'avgust-care-360-account-backup',version:1,accountId,createdAt:new Date().toISOString(),farms:farmData,visits:visitsData,requests,reports:reportsData,photos:photosData},unassignedRequests};
 }catch(error){if(error instanceof Error)throw error;throw new Error('No se pudo validar el respaldo SQLite.');}
 finally{database.close();}
}
