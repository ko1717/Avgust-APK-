import {db,failure,identity} from '@/lib/server';
import {metricDefinition,metricReading,type MetricDefinition} from '@/lib/metric-definitions';
import type {Visit} from '@/lib/model';
import {access} from '@/lib/team-server';

type VisitRow={id:string;date:string;payload:string};
type Cursor=[string,string];

function dateParam(value:string|null,name:string){if(!value)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error(`400:Fecha inválida: ${name}.`);return value;}
function farmIdParam(value:string){if(!/^[a-f0-9-]{36}$/.test(value))throw new Error('404:Finca no encontrada.');return value;}
function cursorFrom(value:string|null):Cursor|undefined{if(!value)return;try{const decoded=atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'='));const parsed=JSON.parse(decoded);if(!Array.isArray(parsed)||parsed.length!==2||!parsed.every(item=>typeof item==='string')||!/^\d{4}-\d{2}-\d{2}$/.test(parsed[0])||!/^[a-f0-9-]{36}$/.test(parsed[1]))throw new Error();return parsed as Cursor;}catch{throw new Error('400:Cursor inválido.');}}
function cursorFor(row:VisitRow){return btoa(JSON.stringify([row.date,row.id])).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function publicDefinition(definition:MetricDefinition){const {id,label,kind,unit,precision,tolerance,graphable}=definition;return {id,label,kind,unit,precision,tolerance,graphable};}

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{
 const user=await identity(req);const farmId=farmIdParam((await params).id);await access(user,farmId);
 const url=new URL(req.url),definition=metricDefinition(url.searchParams.get('metric')||'');
 if(!definition||definition.kind!=='numeric'||!definition.graphable)throw new Error('400:Métrica no disponible para historial.');
 const from=dateParam(url.searchParams.get('from'),'desde'),to=dateParam(url.searchParams.get('to'),'hasta');if(from&&to&&from>to)throw new Error('400:La fecha inicial no puede ser posterior a la final.');
 const limit=Number(url.searchParams.get('limit')||30);if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('400:Límite inválido.');const cursor=cursorFrom(url.searchParams.get('cursor'));
 const conditions=['farm_id = ?',"json_extract(payload, '$.reviewed') = 1"],values:unknown[]=[farmId];
 if(from){conditions.push('date >= ?');values.push(from);}if(to){conditions.push('date <= ?');values.push(to);}if(cursor){conditions.push('(date < ? OR date = ? AND id < ?)');values.push(cursor[0],cursor[0],cursor[1]);}
 const result=await db().prepare(`SELECT id,date,payload FROM visits WHERE ${conditions.join(' AND ')} ORDER BY date DESC,id DESC LIMIT ?`).bind(...values,limit+1).all<VisitRow>();
 const rows=result.results.slice(0,limit),next=result.results.length>limit?cursorFor(rows.at(-1)!):null;
 const points=rows.slice().reverse().flatMap(row=>{const visit=JSON.parse(row.payload) as Visit,reading=metricReading(visit,definition);return reading?.numericValue===undefined?[]:[{visitId:row.id,visitDate:row.date,originalValue:reading.originalValue,numericValue:reading.numericValue,unit:reading.unit,responsible:visit.responsible||''}];});
 return Response.json({farmId,metric:publicDefinition(definition),points,nextCursor:next},{headers:{'Cache-Control':'no-store'}});
}catch(error){return failure(error);}}
