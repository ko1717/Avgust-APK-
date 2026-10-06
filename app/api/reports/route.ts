import {db,identity,failure} from '@/lib/server';
import {access,field,jsonBody} from '@/lib/team-server';
import {audit} from '@/lib/audit';
import {issues,type Visit} from '@/lib/model';
import {isReportStatus,makeReportSnapshot,type ReportSnapshot,type ReportStatus,type ReportVersion} from '@/lib/reports';
import type {Role} from '@/lib/team';

type ReportRow={id:string;farm_id:string;visit_id:string;version_number:number;status:string;source_visit_revision:number;created_by:string;created_at:string;submitted_by:string|null;submitted_at:string|null;approved_by:string|null;approved_at:string|null;published_by:string|null;published_at:string|null;snapshot_json:string|null;revision:number;updated_at:string};
type VisitRow={id:string;farm_id:string|null;owner:string;revision:number;payload:string};
type MemberRow={name:string;role:Role};

function versionId(value:Record<string,unknown>){const id=field(value,'id',36);if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('400:Versión de informe inválida.');return id;}
function visitId(value:Record<string,unknown>){const id=field(value,'visitId',36);if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('400:Visita inválida.');return id;}
function expectedRevision(value:Record<string,unknown>){const revision=value.revision;if(!Number.isInteger(revision)||Number(revision)<1)throw new Error('400:Revisión de versión inválida.');return Number(revision);}
function parseSnapshot(value:string|null){if(!value)throw new Error('409:Esta versión todavía no tiene una captura enviada a revisión.');try{const snapshot=JSON.parse(value) as ReportSnapshot;if(snapshot?.schema!==1||!snapshot.source||!snapshot.content||!Array.isArray(snapshot.sections))throw new Error();return snapshot;}catch{throw new Error('500:La versión del informe no se puede leer.');}}
function output(row:ReportRow,includeSnapshot=false):ReportVersion{
 if(!isReportStatus(row.status))throw new Error('500:Estado de versión inválido.');
 const result:ReportVersion={id:row.id,farmId:row.farm_id,visitId:row.visit_id,versionNumber:row.version_number,status:row.status,sourceVisitRevision:row.source_visit_revision,createdBy:row.created_by,createdAt:row.created_at,revision:row.revision,updatedAt:row.updated_at};
 if(row.submitted_by)result.submittedBy=row.submitted_by;if(row.submitted_at)result.submittedAt=row.submitted_at;if(row.approved_by)result.approvedBy=row.approved_by;if(row.approved_at)result.approvedAt=row.approved_at;if(row.published_by)result.publishedBy=row.published_by;if(row.published_at)result.publishedAt=row.published_at;if(includeSnapshot&&row.snapshot_json)result.snapshot=parseSnapshot(row.snapshot_json);
 return result;
}
async function loadVisit(user:string,id:string,mode:'read'|'edit'='read'){
 const row=await db().prepare('SELECT id,farm_id,owner,revision,payload FROM visits WHERE id = ?').bind(id).first<VisitRow>();
 if(!row)throw new Error('404:Visita no encontrada.');
 if(!row.farm_id)throw new Error('400:Vincula la visita a una finca para gestionar versiones de informe.');
 const role=await access(user,row.farm_id,mode);return {row,role,visit:JSON.parse(row.payload) as Visit};
}
async function loadReport(id:string){const row=await db().prepare('SELECT * FROM report_versions WHERE id = ?').bind(id).first<ReportRow>();if(!row)throw new Error('404:Versión de informe no encontrada.');if(!isReportStatus(row.status))throw new Error('500:Estado de versión inválido.');return row;}
async function participants(farmId:string){const result=await db().prepare('SELECT name,role FROM farm_members WHERE farm_id = ? ORDER BY name').bind(farmId).all<MemberRow>();return result.results.filter(member=>member.role==='manager'||member.role==='editor'||member.role==='viewer');}
async function update(row:ReportRow,user:string,status:ReportStatus,fields:{sourceVisitRevision?:number;snapshot?:ReportSnapshot|null;submitted?:boolean;approved?:boolean;published?:boolean}={}){
 const now=new Date().toISOString(),revision=row.revision+1;
 const source=fields.sourceVisitRevision??row.source_visit_revision,snapshot=fields.snapshot===undefined?row.snapshot_json:fields.snapshot?JSON.stringify(fields.snapshot):null;
 const submittedBy=fields.submitted?user:row.submitted_by,submittedAt=fields.submitted?now:row.submitted_at;
 const approvedBy=fields.approved?user:row.approved_by,approvedAt=fields.approved?now:row.approved_at;
 const publishedBy=fields.published?user:row.published_by,publishedAt=fields.published?now:row.published_at;
 const result=await db().prepare('UPDATE report_versions SET status = ?, source_visit_revision = ?, snapshot_json = ?, submitted_by = ?, submitted_at = ?, approved_by = ?, approved_at = ?, published_by = ?, published_at = ?, revision = ?, updated_at = ? WHERE id = ? AND revision = ?').bind(status,source,snapshot,submittedBy,submittedAt,approvedBy,approvedAt,publishedBy,publishedAt,revision,now,row.id,row.revision).run();
 if(!result.meta.changes)throw new Error('409:La versión cambió en otra sesión. Actualiza antes de continuar.');
 return {...row,status,source_visit_revision:source,snapshot_json:snapshot,submitted_by:submittedBy,submitted_at:submittedAt,approved_by:approvedBy,approved_at:approvedAt,published_by:publishedBy,published_at:publishedAt,revision,updated_at:now};
}

export async function GET(req:Request){try{
 const user=await identity(req),id=new URL(req.url).searchParams.get('visitId');if(!id||!/^[a-f0-9-]{36}$/.test(id))throw new Error('400:Visita inválida.');
 const {row,role}=await loadVisit(user,id);const result=await db().prepare('SELECT * FROM report_versions WHERE visit_id = ? ORDER BY version_number DESC').bind(row.id).all<ReportRow>();
 return Response.json({role,versions:result.results.map(item=>output(item))},{headers:{'Cache-Control':'no-store'}});
}catch(error){return failure(error);}}

export async function POST(req:Request){try{
 const user=await identity(req,true),input=await jsonBody(req),op=field(input,'op',30);
 if(op==='create'||op==='new_version'){
  const id=visitId(input),{row,visit}=await loadVisit(user,id,'edit');if(!visit.reviewed||issues(visit).length)throw new Error('422:Completa la revisión técnica de la visita antes de crear una versión de informe.');
  const existing=await db().prepare('SELECT * FROM report_versions WHERE visit_id = ? ORDER BY version_number DESC').bind(row.id).all<ReportRow>();
  if(op==='create'&&existing.results.length)throw new Error('409:Esta visita ya tiene una versión de informe. Usa una nueva versión después de publicar la anterior.');
  if(op==='new_version'){
   if(!existing.results.some(item=>item.status==='published'))throw new Error('409:Publica la versión anterior antes de crear una nueva.');
   if(existing.results.some(item=>item.status==='draft'||item.status==='in_review'||item.status==='approved'))throw new Error('409:Ya existe una versión activa para esta visita.');
  }
  const number=(existing.results[0]?.version_number||0)+1,now=new Date().toISOString(),newId=crypto.randomUUID();
  const created:ReportRow={id:newId,farm_id:row.farm_id!,visit_id:row.id,version_number:number,status:'draft',source_visit_revision:row.revision,created_by:user,created_at:now,submitted_by:null,submitted_at:null,approved_by:null,approved_at:null,published_by:null,published_at:null,snapshot_json:null,revision:1,updated_at:now};
  await db().batch([db().prepare('INSERT INTO report_versions (id,farm_id,visit_id,version_number,status,source_visit_revision,created_by,created_at,revision,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(created.id,created.farm_id,created.visit_id,created.version_number,created.status,created.source_visit_revision,created.created_by,created.created_at,created.revision,created.updated_at),audit(created.farm_id,user,op==='create'?'report_draft_created':'report_version_created','report_version',created.id,{version:number,status:'draft'})]);
  return Response.json(output(created));
 }
 const id=versionId(input),row=await loadReport(id),storedRevision=expectedRevision(input);if(storedRevision!==row.revision)throw new Error('409:La versión cambió en otra sesión. Actualiza antes de continuar.');
 if(op==='submit'){
  if(row.status!=='draft')throw new Error('409:Solo un borrador se puede enviar a revisión.');
  const {row:visitRow,visit}=await loadVisit(user,row.visit_id,'edit');if(!visit.reviewed||issues(visit).length)throw new Error('422:Completa la revisión técnica de la visita antes de enviarla.');
  const snapshot=makeReportSnapshot(visit,await participants(row.farm_id));const updated=await update(row,user,'in_review',{sourceVisitRevision:visitRow.revision,snapshot,submitted:true});await audit(row.farm_id,user,'report_submitted','report_version',row.id,{version:row.version_number,status:'in_review'}).run();return Response.json(output(updated));
 }
 if(op==='return'){
  if(row.status!=='in_review')throw new Error('409:Solo un informe en revisión puede volver a borrador.');await access(user,row.farm_id,'manage');const {row:visitRow}=await loadVisit(user,row.visit_id);const updated=await update(row,user,'draft',{sourceVisitRevision:visitRow.revision,snapshot:null});await audit(row.farm_id,user,'report_returned','report_version',row.id,{version:row.version_number,status:'draft'}).run();return Response.json(output(updated));
 }
 if(op==='approve'){
  if(row.status!=='in_review')throw new Error('409:Solo un informe en revisión puede aprobarse.');await access(user,row.farm_id,'manage');const {row:visitRow}=await loadVisit(user,row.visit_id);if(visitRow.revision!==row.source_visit_revision)throw new Error('409:La visita cambió después del envío. Devuelve el informe a borrador o crea una nueva presentación para revisar la información actual.');parseSnapshot(row.snapshot_json);const updated=await update(row,user,'approved',{approved:true});await audit(row.farm_id,user,'report_approved','report_version',row.id,{version:row.version_number,status:'approved'}).run();return Response.json(output(updated));
 }
 if(op==='publish'){
  if(row.status!=='approved')throw new Error('409:Solo un informe aprobado puede publicarse.');await access(user,row.farm_id,'manage');parseSnapshot(row.snapshot_json);const updated=await update(row,user,'published',{published:true});await audit(row.farm_id,user,'report_published','report_version',row.id,{version:row.version_number,status:'published'}).run();return Response.json(output(updated));
 }
 throw new Error('400:Operación de informe inválida.');
}catch(error){if(error instanceof Error&&error.message.includes('report_versions'))return Response.json({error:'Otra sesión creó una versión de informe. Actualiza antes de continuar.'},{status:409});return failure(error);}}
