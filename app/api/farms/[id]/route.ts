import {db,files,identity,failure} from '@/lib/server';
import {access} from '@/lib/team-server';

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){try{
 const user=await identity(req,true),{id}=await params;
 if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('404:Finca no encontrada.');
 await access(user,id,'manage');
 const photos=await db().prepare('SELECT key FROM photos WHERE farm_id = ?').bind(id).all<{key:string}>();
 await db().batch([
  db().prepare('DELETE FROM report_events WHERE farm_id = ?').bind(id),
  db().prepare('DELETE FROM report_versions WHERE farm_id = ?').bind(id),
  db().prepare('DELETE FROM visits WHERE farm_id = ?').bind(id),
  db().prepare('DELETE FROM photos WHERE farm_id = ?').bind(id),
  db().prepare('DELETE FROM service_requests WHERE farm_id = ?').bind(id),
  db().prepare('DELETE FROM farm_invitations WHERE farm_id = ?').bind(id),
  db().prepare('DELETE FROM farm_contacts WHERE farm_id = ?').bind(id),
  db().prepare('DELETE FROM farm_members WHERE farm_id = ?').bind(id),
  db().prepare('DELETE FROM audit_events WHERE farm_id = ?').bind(id),
  db().prepare('DELETE FROM farms WHERE id = ?').bind(id)
 ]);
 await Promise.all(photos.results.map(photo=>files().delete(photo.key)));
 return Response.json({ok:true});
}catch(error){return failure(error);}}
