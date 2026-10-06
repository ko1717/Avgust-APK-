import {db,identity,failure} from '@/lib/server';
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
