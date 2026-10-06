import {identity,db,failure} from '@/lib/server';
import {access} from '@/lib/team-server';

type AuditRow={id:string;actor_id:string;event:string;subject_type:string;subject_id:string;details:string;created:string};

function safeDetails(value:string){
 try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch{return {};}
}

export async function GET(req:Request){try{
 const user=await identity(req);const farmId=new URL(req.url).searchParams.get('farmId');
 if(!farmId||!/^[a-f0-9-]{36}$/.test(farmId))throw new Error('400:Finca inválida.');
 await access(user,farmId,'manage');
 const rows=await db().prepare('SELECT id,actor_id,event,subject_type,subject_id,details,created FROM audit_events WHERE farm_id = ? ORDER BY created DESC, id DESC LIMIT 200').bind(farmId).all<AuditRow>();
 return Response.json({events:rows.results.map(row=>({id:row.id,actorId:row.actor_id,event:row.event,subjectType:row.subject_type,subjectId:row.subject_id,details:safeDetails(row.details),created:row.created}))},{headers:{'Cache-Control':'no-store'}});
}catch(error){return failure(error);}}
