import {db,identity,failure} from '@/lib/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {access,contacts,jsonBody,field} from '@/lib/team-server';
import {audit} from '@/lib/audit';
export async function GET(req:Request){try{const user=await identity(req);const farms=await db().prepare('SELECT f.*, m.role FROM farms f JOIN farm_members m ON m.farm_id = f.id WHERE m.user_id = ? ORDER BY f.name').bind(user).all<{id:string}>();const data=await Promise.all(farms.results.map(async f=>({...f,members:(await db().prepare('SELECT user_id, name, role FROM farm_members WHERE farm_id = ? ORDER BY name').bind(f.id).all()).results,contacts:(await db().prepare('SELECT id,name,role,phone,email,receive_reports FROM farm_contacts WHERE farm_id = ? ORDER BY name').bind(f.id).all()).results.map(c=>({...c,receiveReports:Boolean(c.receive_reports)}))})));return Response.json({userId:user,farms:data},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const user=await identity(req,true),x=await jsonBody(req),op=field(x,'op');const profile=await getChatGPTUser();
 if(op==='create'){
  const name=field(x,'name'),zone=field(x,'zone'),initialContacts=contacts(x);if(!name)throw new Error('400:Escribe el nombre de la finca.');const id=crypto.randomUUID();
  await db().batch([db().prepare('INSERT INTO farms (id,owner,name,zone,contact) VALUES (?,?,?,?,?)').bind(id,user,name,zone,initialContacts[0]?.name||''),db().prepare('INSERT INTO farm_members (farm_id,user_id,name,role) VALUES (?,?,?,?)').bind(id,user,profile!.displayName,'manager'),...initialContacts.map(c=>db().prepare('INSERT INTO farm_contacts (id,farm_id,name,role,phone,email,receive_reports) VALUES (?,?,?,?,?,?,?)').bind(c.id,id,c.name,c.role,c.phone,c.email,Number(c.receiveReports))),audit(id,user,'farm.created','farm',id,{contactCount:initialContacts.length})]);return Response.json({id});
 }
 if(op==='join'){
  const token=field(x,'token',64);const invite=await db().prepare('SELECT farm_id,role FROM farm_invitations WHERE token = ? AND expires > ?').bind(token,new Date().toISOString()).first<{farm_id:string;role:string}>();if(!invite)throw new Error('400:El código no existe o ha vencido.');
  // Claim and consume in one transaction; the SELECT checks the still-present invitation.
  const result=await db().batch([db().prepare('INSERT INTO farm_members (farm_id,user_id,name,role) SELECT farm_id,?,?,role FROM farm_invitations WHERE token = ? AND expires > ? ON CONFLICT(farm_id,user_id) DO NOTHING').bind(user,profile!.displayName,token,new Date().toISOString()),db().prepare('DELETE FROM farm_invitations WHERE token = ?').bind(token)]);
  if(!result[0].meta.changes)throw new Error('409:Ya participas en la finca o el código fue utilizado.');await audit(invite.farm_id,user,'team.member_joined','membership',user,{role:invite.role}).run();return Response.json({ok:true});
 }
 const farmId=field(x,'farmId',36);await access(user,farmId,'manage');
 if(op==='contacts'){const updated=contacts(x);await db().batch([db().prepare('DELETE FROM farm_contacts WHERE farm_id = ?').bind(farmId),...updated.map(c=>db().prepare('INSERT INTO farm_contacts (id,farm_id,name,role,phone,email,receive_reports) VALUES (?,?,?,?,?,?,?)').bind(c.id,farmId,c.name,c.role,c.phone,c.email,Number(c.receiveReports))),db().prepare('UPDATE farms SET contact = ? WHERE id = ?').bind(updated[0]?.name||'',farmId),audit(farmId,user,'farm.contacts_updated','farm',farmId,{contactCount:updated.length})]);return Response.json({ok:true});}
 if(op==='invite'){
  const role=field(x,'role');if(!['manager','editor','viewer'].includes(role))throw new Error('400:Permiso inválido.');const token=crypto.randomUUID()+crypto.randomUUID().slice(0,8);const expires=new Date(Date.now()+24*3600000).toISOString();await db().batch([db().prepare('INSERT INTO farm_invitations (token,farm_id,role,expires) VALUES (?,?,?,?)').bind(token,farmId,role,expires),audit(farmId,user,'team.invitation_created','invitation',farmId,{role,expires})]);return Response.json({token,expires});
 }
 if(op==='revokeInvite'){const result=await db().prepare('DELETE FROM farm_invitations WHERE token = ? AND farm_id = ?').bind(field(x,'token',64),farmId).run();if(result.meta.changes)await audit(farmId,user,'team.invitation_revoked','invitation',farmId,{}).run();return Response.json({ok:true});}
 if(op==='member'){
  const target=field(x,'userId'),role=field(x,'role');const farm=await db().prepare('SELECT owner FROM farms WHERE id = ?').bind(farmId).first<{owner:string}>();if(target===farm?.owner||target===user)throw new Error('400:No puedes modificar al creador de la finca ni tus propios permisos.');
  if(role==='remove'){const result=await db().prepare('DELETE FROM farm_members WHERE farm_id = ? AND user_id = ?').bind(farmId,target).run();if(result.meta.changes)await audit(farmId,user,'team.member_removed','membership',target,{}).run();}else {if(!['manager','editor','viewer'].includes(role))throw new Error('400:Permiso inválido.');const result=await db().prepare('UPDATE farm_members SET role = ? WHERE farm_id = ? AND user_id = ?').bind(role,farmId,target).run();if(result.meta.changes)await audit(farmId,user,'team.member_role_changed','membership',target,{role}).run();}return Response.json({ok:true});
 }
 throw new Error('400:Operación inválida.');
 }catch(e){return failure(e);}}
