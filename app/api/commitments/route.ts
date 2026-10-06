import {audit} from '@/lib/audit';
import {COMMITMENT_DUE_SOON_DAYS,actionFor,completionDate,inBucket,isDueToday,isOverdue,isUpcoming,transitionAction,type CommitmentBucket} from '@/lib/commitments';
import {findings,type Action,type ActionStatus,type Visit} from '@/lib/model';
import {db,identity,failure} from '@/lib/server';
import {access,field,jsonBody} from '@/lib/team-server';
import {validate} from '@/lib/validate';

type VisitRow={id:string;owner:string;farm_id:string|null;farm:string;date:string;payload:string;revision:number;updated:string;role:string|null};
type Commitment={id:string;visitId:string;criterionId:string;revision:number;farmId:string|null;farm:string;visitDate:string;technician:string;description:string;recommendation:string;action:Action;canEdit:boolean};
const statuses:ActionStatus[]=['proposed','pending','progress','closed','cancelled'];
const buckets:CommitmentBucket[]=['all','today','upcoming','overdue','completed'];

function today(){const value=new Date();return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;}
function plusDays(date:string,days:number){const value=new Date(`${date}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);}
function date(value:string|null,name:string){if(!value)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error(`400:Fecha inválida: ${name}.`);return value;}
function queryText(value:string|null,name:string){if(!value)return '';if(value.length>300)throw new Error(`400:Filtro inválido: ${name}.`);return value.trim().toLocaleLowerCase('es');}
function cursor(value:string|null){if(!value)return '';try{const decoded=atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'='));if(!/^[a-f0-9-]{36}:[1-5]\.\d{1,3}$/.test(decoded))throw new Error();return decoded;}catch{throw new Error('400:Cursor inválido.');}}
function cursorFor(value:string){return btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function parseVisit(value:string){try{return JSON.parse(value) as Visit;}catch{throw new Error('500:No se pudo leer una visita.');}}
function includes(value:string,term:string){return !term||value.toLocaleLowerCase('es').includes(term);}
function operationalDate(item:Commitment){return item.action.status==='closed'?completionDate(item.action):item.action.due;}

async function visitRows(user:string,farmId:string){
 if(farmId){await access(user,farmId);return db().prepare("SELECT v.id,v.owner,v.farm_id,v.farm,v.date,v.payload,v.revision,v.updated,m.role FROM visits v LEFT JOIN farm_members m ON m.farm_id = v.farm_id AND m.user_id = ? WHERE v.farm_id = ? AND m.user_id IS NOT NULL").bind(user,farmId).all<VisitRow>();}
 return db().prepare("SELECT v.id,v.owner,v.farm_id,v.farm,v.date,v.payload,v.revision,v.updated,m.role FROM visits v LEFT JOIN farm_members m ON m.farm_id = v.farm_id AND m.user_id = ? WHERE (v.farm_id IS NULL AND v.owner = ?) OR m.user_id IS NOT NULL").bind(user,user).all<VisitRow>();
}
function rowsToCommitments(rows:VisitRow[],user:string){return rows.flatMap(row=>{const visit=parseVisit(row.payload);return findings(visit).map(f=>({id:`${row.id}:${f.id}`,visitId:row.id,criterionId:f.id,revision:row.revision,farmId:row.farm_id,farm:row.farm,visitDate:row.date,technician:visit.responsible,description:f.answer.observation||f.text,recommendation:f.answer.recommendation,action:actionFor(f.action),canEdit:row.farm_id?row.role!=='viewer':row.owner===user}));});}

export async function GET(req:Request){try{
 const user=await identity(req);const url=new URL(req.url),farmId=url.searchParams.get('farmId')||'',from=date(url.searchParams.get('from'),'desde'),to=date(url.searchParams.get('to'),'hasta');if(from&&to&&from>to)throw new Error('400:La fecha inicial no puede ser posterior a la final.');
 if(farmId&&!/^[a-f0-9-]{36}$/.test(farmId))throw new Error('400:Finca inválida.');
 const rawStatus=url.searchParams.get('status')||'all';if(rawStatus!=='all'&&!statuses.includes(rawStatus as ActionStatus))throw new Error('400:Estado inválido.');const status=rawStatus as ActionStatus|'all';
 const rawBucket=url.searchParams.get('bucket')||'all';if(!buckets.includes(rawBucket as CommitmentBucket))throw new Error('400:Sección inválida.');const bucket=rawBucket as CommitmentBucket;
 const limit=Number(url.searchParams.get('limit')||20);if(!Number.isInteger(limit)||limit<1||limit>50)throw new Error('400:Límite inválido.');const after=cursor(url.searchParams.get('cursor'));
 const responsible=queryText(url.searchParams.get('responsible'),'responsable'),technician=queryText(url.searchParams.get('technician'),'técnico'),current=today(),until=plusDays(current,COMMITMENT_DUE_SOON_DAYS);
 const all=rowsToCommitments((await visitRows(user,farmId)).results,user).filter(item=>includes(item.action.owner,responsible)&&includes(item.technician,technician)&&(!from||Boolean(operationalDate(item))&&operationalDate(item)>=from)&&(!to||Boolean(operationalDate(item))&&operationalDate(item)<=to));
 const summary={today:all.filter(item=>isDueToday(item.action,current)).length,upcoming:all.filter(item=>isUpcoming(item.action,current,until)).length,overdue:all.filter(item=>isOverdue(item.action,current)).length,completed:all.filter(item=>item.action.status==='closed').length,pending:all.filter(item=>item.action.status==='pending'||item.action.status==='progress').length};
 const ordered=all.filter(item=>(status==='all'||item.action.status===status)&&inBucket(item.action,bucket,current,until)).sort((a,b)=>{const aDate=operationalDate(a)||'9999-12-31',bDate=operationalDate(b)||'9999-12-31';if(bucket==='completed')return bDate.localeCompare(aDate)||b.id.localeCompare(a.id);return aDate.localeCompare(bDate)||a.id.localeCompare(b.id);});
 const start=after?ordered.findIndex(item=>item.id===after)+1:0;if(after&&start===0)throw new Error('400:Cursor vencido. Actualiza la consulta.');const page=ordered.slice(start,start+limit),next=start+limit<ordered.length?cursorFor(page.at(-1)!.id):null;
 return Response.json({today:current,dueSoonDays:COMMITMENT_DUE_SOON_DAYS,summary,items:page,nextCursor:next},{headers:{'Cache-Control':'no-store'}});
}catch(error){return failure(error);}}

export async function POST(req:Request){try{
 const user=await identity(req,true),input=await jsonBody(req);const visitId=field(input,'visitId',36),criterionId=field(input,'criterionId',12);if(!/^[a-f0-9-]{36}$/.test(visitId)||!/^[1-5]\.\d{1,3}$/.test(criterionId))throw new Error('400:Compromiso inválido.');if(!Number.isInteger(input.revision)||Number(input.revision)<1)throw new Error('400:Versión inválida.');
 const supplied=input.action;if(!supplied||typeof supplied!=='object'||Array.isArray(supplied))throw new Error('400:Acción inválida.');const raw=supplied as Record<string,unknown>;
 const row=await db().prepare('SELECT id,owner,farm_id,farm,payload,revision,updated FROM visits WHERE id = ?').bind(visitId).first<VisitRow>();if(!row)throw new Error('404:Visita no encontrada.');
 if(row.farm_id)await access(user,row.farm_id,'edit');else if(row.owner!==user)throw new Error('403:No tienes permiso para esta visita.');if(row.revision!==input.revision)throw new Error('409:El compromiso cambió. Actualiza la consulta antes de guardar.');
 const visit=parseVisit(row.payload);if(visit.answers[criterionId]?.value!=='NO')throw new Error('400:El compromiso debe originarse en un hallazgo de la visita.');const previous=visit.actions?.[criterionId];const base=actionFor(previous);
 for(const key of ['owner','due','status','closure'])if(typeof raw[key]!=='string')throw new Error('400:Acción inválida.');
 const candidate={...base,owner:raw.owner,due:raw.due,status:raw.status as ActionStatus,closure:raw.closure};const checked=validate({...visit,revision:row.revision,actions:{...visit.actions,[criterionId]:candidate}});const changedAt=new Date().toISOString(),transition=transitionAction(previous,checked.actions![criterionId],user,changedAt,criterionId),revision=row.revision+1,saved={...checked,id:row.id,revision,actions:{...checked.actions,[criterionId]:transition.action}};
 const write=db().prepare('UPDATE visits SET payload = ?, revision = ?, updated = ? WHERE id = ? AND revision = ?').bind(JSON.stringify(saved),revision,changedAt,row.id,row.revision);const result=await db().batch([write,...(row.farm_id?transition.events.map(event=>audit(row.farm_id!,user,event.event,'commitment',`${row.id}:${event.criterionId}`,event.details)):[])]);if(!result[0].meta.changes)throw new Error('409:El compromiso cambió. Actualiza la consulta antes de guardar.');
 return Response.json({visitId:row.id,criterionId,revision,action:transition.action});
}catch(error){return failure(error);}}
