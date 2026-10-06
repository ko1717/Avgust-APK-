import {db,identity,failure,body} from '@/lib/server';
import {validate} from '@/lib/validate';
import type {Visit} from '@/lib/model';
import {access} from '@/lib/team-server';
import {audit} from '@/lib/audit';
import {transitionAction} from '@/lib/commitments';
export async function GET(req:Request){try{const user=await identity(req);const result=await db().prepare("SELECT v.*, m.role FROM visits v LEFT JOIN farm_members m ON m.farm_id = v.farm_id AND m.user_id = ? WHERE (v.farm_id IS NULL AND v.owner = ?) OR m.user_id IS NOT NULL ORDER BY v.date DESC, v.updated DESC").bind(user,user).all<{id:string;payload:string;revision:number;updated:string;role:string|null}>();return Response.json(result.results.map(r=>({...JSON.parse(r.payload),id:r.id,revision:r.revision,updated:r.updated,canEdit:r.role!=='viewer'})),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const user=await identity(req,true);let input:unknown;try{input=JSON.parse(new TextDecoder().decode(await body(req,500000)));}catch(e){if(e instanceof SyntaxError)throw new Error('400:Formulario inválido.');throw e;}
 const v=validate(input),farmId=v.farmId||null;
 const old=v.id?await db().prepare('SELECT owner,farm_id,revision,payload FROM visits WHERE id = ?').bind(v.id).first<{owner:string;farm_id:string|null;revision:number;payload:string}>():null;
 if(v.id&&!old)throw new Error('404:Visita no encontrada.');
 if(old){if(old.farm_id){await access(user,old.farm_id,'edit');if(old.farm_id!==farmId)throw new Error('400:No puedes trasladar una visita compartida a otra finca.');}else if(old.owner!==user)throw new Error('403:No tienes permiso para esta visita.');if(old.revision!==v.revision)throw new Error('409:La visita cambió en otro dispositivo. Conserva tus cambios descargando un respaldo y vuelve a abrir la visita.');}
 if(farmId){await access(user,farmId,'edit');const farm=await db().prepare('SELECT name FROM farms WHERE id = ?').bind(farmId).first<{name:string}>();v.farm=farm!.name;}
 if(v.requestId){const request=await db().prepare('SELECT farm_id FROM service_requests WHERE id = ?').bind(v.requestId).first<{farm_id:string}>();if(!request||request.farm_id!==farmId)throw new Error('400:La solicitud no pertenece a esta finca.');}
 const photoUpdates:string[]=[];
 for(const p of v.photos){const photo=await db().prepare('SELECT owner,farm_id FROM photos WHERE id = ?').bind(p.id).first<{owner:string;farm_id:string|null}>();if(!photo||(photo.farm_id?photo.farm_id!==farmId:photo.owner!==user))throw new Error('400:No se encontró una fotografía autorizada para esta finca.');if(farmId&&!photo.farm_id)photoUpdates.push(p.id);}
 const id=v.id||crypto.randomUUID(),revision=v.revision+1,changedAt=new Date().toISOString(),previous=old?JSON.parse(old.payload) as Visit:undefined;
 const actionEvents=[] as ReturnType<typeof transitionAction>['events'];const actions={...v.actions};
 for(const [criterionId,next] of Object.entries(actions)){const prior=previous?.actions?.[criterionId];const candidate={...next,completedAt:prior?.completedAt||'',completedBy:prior?.completedBy||'',reopenedAt:prior?.reopenedAt||''};const transition=transitionAction(prior,candidate,user,changedAt,criterionId);actions[criterionId]=transition.action;actionEvents.push(...transition.events);}
 const saved={...v,actions,id,revision};
 const write=old?db().prepare('UPDATE visits SET farm = ?, farm_id = ?, date = ?, payload = ?, revision = ?, updated = ? WHERE id = ? AND revision = ?').bind(v.farm,farmId,v.date,JSON.stringify(saved),revision,changedAt,id,v.revision):db().prepare('INSERT INTO visits (id,owner,farm,farm_id,date,payload,revision,updated) VALUES (?,?,?,?,?,?,?,?)').bind(id,user,v.farm,farmId,v.date,JSON.stringify(saved),revision,changedAt);
 const results=await db().batch([write,...photoUpdates.map(photoId=>db().prepare('UPDATE photos SET farm_id = ? WHERE id = ? AND owner = ? AND farm_id IS NULL AND EXISTS (SELECT 1 FROM visits WHERE id = ? AND revision = ? AND payload = ?)').bind(farmId,photoId,user,id,revision,JSON.stringify(saved))),...(farmId?actionEvents.map(event=>audit(farmId,user,event.event,'commitment',`${id}:${event.criterionId}`,event.details)):[])]);if(!results[0].meta.changes)throw new Error('409:La visita cambió. Actualiza antes de guardar.');
 return Response.json({...saved,canEdit:true});
 }catch(e){return failure(e);}}
