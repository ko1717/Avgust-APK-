import {db,identity,failure} from '@/lib/server';
import {access} from '@/lib/team-server';
import {metrics,type Visit} from '@/lib/model';
import {serviceLabels,type Service} from '@/lib/team';
import {isReportStatus,reportStatusLabels,type ReportSnapshot} from '@/lib/reports';
import type {DossierEvent,DossierKind,FarmDossier} from '@/lib/farm-dossier';

type Row={id:string;occurred_on:string;occurred_at:string;kind:DossierKind;payload:string;version_number:number|null;report_status:string|null;visit_id:string|null};
type FarmRow={id:string;name:string;zone:string;contact:string};
type CountRow={count:number};
type Cursor=[string,string,DossierKind,string];

const allKinds:DossierKind[]=['visit','request','report','photo','followup'];
const requestStatus:Record<Service['status'],string>={requested:'Solicitada',scheduled:'Programada',done:'Realizada',cancelled:'Cancelada'};

function dateParam(value:string|null,name:string){if(!value)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error(`400:Fecha inválida: ${name}.`);return value;}
function cursorFrom(value:string|null):Cursor|undefined{if(!value)return;try{const decoded=atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'='));const parsed=JSON.parse(decoded);if(!Array.isArray(parsed)||parsed.length!==4||!parsed.every(part=>typeof part==='string')||!allKinds.includes(parsed[2] as DossierKind))throw new Error();return parsed as Cursor;}catch{throw new Error('400:Cursor inválido.');}}
function cursorFor(row:Row){return btoa(JSON.stringify([row.occurred_on,row.occurred_at,row.kind,row.id])).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function parsePayload<T>(value:string){try{return JSON.parse(value) as T;}catch{throw new Error('500:No se pudo leer un registro del expediente.');}}
function occurrence(kind:DossierKind,row:Row):DossierEvent{
 if(kind==='request'){
  const service=parsePayload<Service>(row.payload);return {id:`request-${row.id}`,kind,occurredOn:row.occurred_on,requestId:row.id,title:`Solicitud · ${serviceLabels[service.kind]}`,description:`${requestStatus[service.status]}${service.date?` · ${service.date}`:' · Fecha por definir'}`};
 }
 if(kind==='report'&&row.version_number!==null){if(!isReportStatus(row.report_status))throw new Error('500:Estado de versión inválido.');const snapshot=parsePayload<ReportSnapshot>(row.payload);return {id:`report-version-${row.id}`,kind,occurredOn:row.occurred_on,visitId:row.visit_id||undefined,reportVersionId:row.id,title:`Informe v${row.version_number} · ${reportStatusLabels[row.report_status]}`,description:`${snapshot.farm.name} · fuente técnica congelada en revisión ${snapshot.source.visitRevision}`,score:snapshot.indicator.score,status:snapshot.indicator.status};}
 const visit=parsePayload<Visit>(row.payload);const m=metrics(visit);const type=serviceLabels[visit.serviceKind as keyof typeof serviceLabels]||'Visita técnica';
 if(kind==='report')return {id:`report-${row.id}`,kind,occurredOn:row.occurred_on,visitId:row.id,title:'Informe técnico revisado (registro anterior)',description:`${type} · ${visit.responsible||'Responsable sin registrar'}`,score:m.score,status:m.status};
 if(kind==='photo'){const count=visit.photos.length;return {id:`photo-${row.id}`,kind,occurredOn:row.occurred_on,visitId:row.id,title:`${count} fotografía${count===1?'':'s'} asociada${count===1?'':'s'}`,description:`Evidencia de ${type.toLocaleLowerCase('es')}`};}
 if(kind==='followup'){const actions=Object.values(visit.actions||{}),today=new Date().toISOString().slice(0,10),late=actions.filter(action=>['pending','progress'].includes(action.status)&&Boolean(action.due)&&action.due<today).length,active=actions.filter(action=>['pending','progress'].includes(action.status)).length,completed=actions.filter(action=>action.status==='closed').length;const title=late?`${late} compromiso${late===1?'':'s'} vencido${late===1?'':'s'}`:active?`${active} compromiso${active===1?'':'s'} en seguimiento`:completed?`${completed} compromiso${completed===1?'':'s'} completado${completed===1?'':'s'}`:'Seguimiento programado';return {id:`followup-${row.id}`,kind,occurredOn:row.occurred_on,visitId:row.id,title,description:visit.followup?`Fecha programada: ${visit.followup}`:'Seguimiento asociado a la visita'};}
 return {id:`visit-${row.id}`,kind,occurredOn:row.occurred_on,visitId:row.id,title:type,description:`${visit.reviewed?'Informe revisado':'Borrador'} · ${visit.responsible||'Responsable sin registrar'}`,score:m.score,status:m.status};
}

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{
 const user=await identity(req);const {id:farmId}=await params;
 if(!/^[a-f0-9-]{36}$/.test(farmId))throw new Error('404:Finca no encontrada.');
 await access(user,farmId);
 const url=new URL(req.url),from=dateParam(url.searchParams.get('from'),'desde'),to=dateParam(url.searchParams.get('to'),'hasta');if(from&&to&&from>to)throw new Error('400:La fecha inicial no puede ser posterior a la final.');
 const requested=url.searchParams.get('types');const kinds=requested?[...new Set(requested.split(',').filter(Boolean).map(value=>value as DossierKind))]:allKinds;if(!kinds.length||kinds.some(kind=>!allKinds.includes(kind)))throw new Error('400:Filtro de actividad inválido.');
 const rawLimit=Number(url.searchParams.get('limit')||20);if(!Number.isInteger(rawLimit)||rawLimit<1||rawLimit>50)throw new Error('400:Límite inválido.');const cursor=cursorFrom(url.searchParams.get('cursor'));
 const farm=await db().prepare('SELECT id,name,zone,contact FROM farms WHERE id = ?').bind(farmId).first<FarmRow>();if(!farm)throw new Error('404:Finca no encontrada.');
 const visitFilter=(alias:string)=>{const conditions=[`${alias}.farm_id = ?`],values:unknown[]=[farmId];if(from){conditions.push(`${alias}.date >= ?`);values.push(from);}if(to){conditions.push(`${alias}.date <= ?`);values.push(to);}return {sql:conditions.join(' AND '),values};};
 const requestFilter=()=>{const date="NULLIF(json_extract(r.payload, '$.date'),'')",conditions=['r.farm_id = ?'],values:unknown[]=[farmId];if(from){conditions.push(`${date} >= ?`);values.push(from);}if(to){conditions.push(`${date} <= ?`);values.push(to);}return {sql:conditions.join(' AND '),values};};
 const selects:string[]=[];const bindings:unknown[]=[];
 const visitKinds=kinds.filter(kind=>kind==='visit'||kind==='report'||kind==='photo'||kind==='followup');
 if(visitKinds.length){const filter=visitFilter('v'),allowed=visitKinds.map(kind=>`'${kind}'`).join(',');selects.push(`SELECT v.id, v.date AS occurred_on, v.updated AS occurred_at, event.value AS kind, v.payload, NULL AS version_number, NULL AS report_status, NULL AS visit_id FROM visits v JOIN json_each('["visit","report","photo","followup"]') event WHERE ${filter.sql} AND event.value IN (${allowed}) AND (event.value = 'visit' OR event.value = 'report' AND json_extract(v.payload, '$.reviewed') = 1 AND NOT EXISTS (SELECT 1 FROM report_versions rv WHERE rv.visit_id = v.id) OR event.value = 'photo' AND json_array_length(v.payload, '$.photos') > 0 OR event.value = 'followup' AND (NULLIF(json_extract(v.payload, '$.followup'),'') IS NOT NULL OR EXISTS (SELECT 1 FROM json_each(v.payload, '$.actions') WHERE json_extract(value, '$.status') IN ('pending','progress'))))`);bindings.push(...filter.values);}
 if(kinds.includes('report')){const filter=visitFilter('rv');selects.push(`SELECT rv.id, substr(COALESCE(rv.published_at,rv.approved_at,rv.submitted_at,rv.created_at),1,10) AS occurred_on, COALESCE(rv.published_at,rv.approved_at,rv.submitted_at,rv.created_at) AS occurred_at, 'report' AS kind, rv.snapshot_json AS payload, rv.version_number, rv.status AS report_status, rv.visit_id FROM report_versions rv WHERE ${filter.sql} AND rv.snapshot_json IS NOT NULL`);bindings.push(...filter.values);}
 if(kinds.includes('request')){const filter=requestFilter();selects.push(`SELECT r.id, COALESCE(NULLIF(json_extract(r.payload, '$.date'),''),'') AS occurred_on, '' AS occurred_at, 'request' AS kind, r.payload, NULL AS version_number, NULL AS report_status, NULL AS visit_id FROM service_requests r WHERE ${filter.sql}`);bindings.push(...filter.values);}
 const cursorFilter=cursor?'WHERE occurred_on < ? OR (occurred_on = ? AND occurred_at < ?) OR (occurred_on = ? AND occurred_at = ? AND kind > ?) OR (occurred_on = ? AND occurred_at = ? AND kind = ? AND id < ?)':'';
 if(cursor)bindings.push(cursor[0],cursor[0],cursor[1],cursor[0],cursor[1],cursor[2],cursor[0],cursor[1],cursor[2],cursor[3]);
 bindings.push(rawLimit+1);
 const timeline=await db().prepare(`SELECT id,occurred_on,occurred_at,kind,payload,version_number,report_status,visit_id FROM (${selects.join(' UNION ALL ')}) ${cursorFilter} ORDER BY occurred_on DESC, occurred_at DESC, kind ASC, id DESC LIMIT ?`).bind(...bindings).all<Row>();
 const page=timeline.results.slice(0,rawLimit),next=timeline.results.length>rawLimit?cursorFor(page.at(-1)!):null;
 const today=new Date().toISOString().slice(0,10),recentSince=new Date(Date.now()-30*24*60*60*1000).toISOString();
 const [visitCount,reportCount,openRequestCount,pendingFollowupCount,overdueFollowupCount,recentCompletedFollowupCount,photoCount,latest]=await Promise.all([
  db().prepare('SELECT COUNT(*) AS count FROM visits WHERE farm_id = ?').bind(farmId).first<CountRow>(),
  db().prepare("SELECT (SELECT COUNT(*) FROM report_versions WHERE farm_id = ? AND snapshot_json IS NOT NULL) + (SELECT COUNT(*) FROM visits v WHERE v.farm_id = ? AND json_extract(v.payload, '$.reviewed') = 1 AND NOT EXISTS (SELECT 1 FROM report_versions rv WHERE rv.visit_id = v.id)) AS count").bind(farmId,farmId).first<CountRow>(),
  db().prepare("SELECT COUNT(*) AS count FROM service_requests WHERE farm_id = ? AND json_extract(payload, '$.status') IN ('requested','scheduled')").bind(farmId).first<CountRow>(),
  db().prepare("SELECT COUNT(*) AS count FROM visits v, json_each(v.payload, '$.actions') action WHERE v.farm_id = ? AND json_extract(action.value, '$.status') IN ('pending','progress')").bind(farmId).first<CountRow>(),
  db().prepare("SELECT COUNT(*) AS count FROM visits v, json_each(v.payload, '$.actions') action WHERE v.farm_id = ? AND json_extract(action.value, '$.status') IN ('pending','progress') AND NULLIF(json_extract(action.value, '$.due'),'') < ?").bind(farmId,today).first<CountRow>(),
  db().prepare("SELECT COUNT(*) AS count FROM visits v, json_each(v.payload, '$.actions') action WHERE v.farm_id = ? AND json_extract(action.value, '$.status') = 'closed' AND NULLIF(json_extract(action.value, '$.completedAt'),'') >= ?").bind(farmId,recentSince).first<CountRow>(),
  db().prepare('SELECT COUNT(*) AS count FROM photos WHERE farm_id = ?').bind(farmId).first<CountRow>(),
  db().prepare("SELECT id,date,payload FROM visits WHERE farm_id = ? AND json_extract(payload, '$.reviewed') = 1 ORDER BY date DESC, updated DESC LIMIT 1").bind(farmId).first<{id:string;date:string;payload:string}>(),
 ]);
 const latestVisit=latest?(()=>{const visit=parsePayload<Visit>(latest.payload),measurement=metrics(visit);return {id:latest.id,date:latest.date,responsible:visit.responsible,score:measurement.score,status:measurement.status};})():undefined;
 const dossier:FarmDossier={farm,summary:{visits:visitCount?.count||0,reports:reportCount?.count||0,openRequests:openRequestCount?.count||0,pendingFollowups:pendingFollowupCount?.count||0,overdueFollowups:overdueFollowupCount?.count||0,recentCompletedFollowups:recentCompletedFollowupCount?.count||0,photos:photoCount?.count||0,latestVisit},events:page.map(row=>occurrence(row.kind,row)),nextCursor:next};
 return Response.json(dossier,{headers:{'Cache-Control':'no-store'}});
}catch(error){return failure(error);}}
