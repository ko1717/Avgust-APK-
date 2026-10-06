import {db,identity,failure} from '@/lib/server';
import {access,jsonBody,field} from '@/lib/team-server';
import {serviceLabels,validDate} from '@/lib/team';
export async function GET(req:Request){try{const user=await identity(req);const rows=await db().prepare('SELECT r.payload FROM service_requests r JOIN farm_members m ON m.farm_id = r.farm_id WHERE m.user_id = ?').bind(user).all<{payload:string}>();return Response.json(rows.results.map(r=>JSON.parse(r.payload)),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity(req,true),x=await jsonBody(req),farmId=field(x,'farmId',36);const role=await access(user,farmId,'edit');const id=field(x,'id',36)||crypto.randomUUID();const revision=Number(x.revision);if(!Number.isInteger(revision)||revision<0)throw new Error('400:Versión inválida.');
 const kind=field(x,'kind'),reason=field(x,'reason',3000),date=field(x,'date',10),rtc=field(x,'rtc'),assignee=field(x,'assignee'),status=field(x,'status');
 if(!Object.hasOwn(serviceLabels,kind)||!reason||!validDate(date)||!['requested','scheduled','done','cancelled'].includes(status))throw new Error('400:Completa el motivo, tipo de servicio y una fecha válida.');
 for(const target of [rtc,assignee].filter(Boolean))await access(target,farmId,'edit');
 if(status==='scheduled'&&(!date||!assignee))throw new Error('400:Para programar, asigna profesional y fecha.');
 const old=await db().prepare('SELECT farm_id,payload FROM service_requests WHERE id = ?').bind(id).first<{farm_id:string;payload:string}>();if(old&&old.farm_id!==farmId)throw new Error('403:La solicitud pertenece a otra finca.');
 if(role!=='manager'&&(old?JSON.parse(old.payload).assignee!==assignee||JSON.parse(old.payload).rtc!==rtc:assignee!==''||rtc!==''))throw new Error('403:La coordinación asigna los participantes.');
 const saved={id,farmId,revision:revision+1,kind,reason,date,rtc,assignee,status};
 if(old){const result=await db().prepare('UPDATE service_requests SET payload = ?, revision = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(saved),saved.revision,id,revision).run();if(!result.meta.changes)throw new Error('409:La solicitud cambió. Actualiza el equipo y vuelve a abrirla.');}else {if(revision!==0)throw new Error('409:Solicitud no encontrada.');await db().prepare('INSERT INTO service_requests (id,farm_id,owner,revision,payload) VALUES (?,?,?,?,?)').bind(id,farmId,user,1,JSON.stringify(saved)).run();}return Response.json(saved);
 }catch(e){return failure(e);}}
