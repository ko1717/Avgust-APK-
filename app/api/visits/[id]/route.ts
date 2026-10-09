import {db,files,identity,failure} from '@/lib/server';
import {access} from '@/lib/team-server';
import type {Visit} from '@/lib/model';

type VisitRow={id:string;payload:string;revision:number;updated:string;role:string|null};

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{
 const user=await identity(req);const {id}=await params;
 if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('404:Visita no encontrada.');
 const row=await db().prepare("SELECT v.id,v.payload,v.revision,v.updated,m.role FROM visits v LEFT JOIN farm_members m ON m.farm_id = v.farm_id AND m.user_id = ? WHERE v.id = ? AND ((v.farm_id IS NULL AND v.owner = ?) OR m.user_id IS NOT NULL)").bind(user,id,user).first<VisitRow>();
 if(!row)throw new Error('404:Visita no encontrada.');
 const visit=JSON.parse(row.payload) as Visit;
 return Response.json({...visit,id:row.id,revision:row.revision,updated:row.updated,canEdit:row.role!=='viewer'},{headers:{'Cache-Control':'no-store'}});
}catch(error){return failure(error);}}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){try{
 const user=await identity(req,true),{id}=await params;
 if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('404:Informe no encontrado.');
 const row=await db().prepare('SELECT owner,farm_id,payload FROM visits WHERE id = ?').bind(id).first<{owner:string;farm_id:string|null;payload:string}>();
 if(!row)throw new Error('404:Informe no encontrado.');
 if(row.farm_id)await access(user,row.farm_id,'edit');else if(row.owner!==user)throw new Error('403:No tienes permiso para eliminar este informe.');
 const visit=JSON.parse(row.payload) as Visit;
 const photoRows=await db().prepare('SELECT id,key FROM photos WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify((visit.photos||[]).map(photo=>photo.id))).all<{id:string;key:string}>();
 await db().batch([
  db().prepare('DELETE FROM report_events WHERE report_version_id IN (SELECT id FROM report_versions WHERE visit_id = ?)').bind(id),
  db().prepare('DELETE FROM report_versions WHERE visit_id = ?').bind(id),
  db().prepare('DELETE FROM photos WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify((visit.photos||[]).map(photo=>photo.id))),
  db().prepare('DELETE FROM visits WHERE id = ?').bind(id)
 ]);
 await Promise.all(photoRows.results.map(photo=>files().delete(photo.key)));
 return Response.json({ok:true});
}catch(error){return failure(error);}}
