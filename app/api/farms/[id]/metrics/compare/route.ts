import {db,failure,identity} from '@/lib/server';
import {compareMetricReadings,metricDefinitions,metricReading,type MetricDefinition,type MetricReading} from '@/lib/metric-definitions';
import type {Visit} from '@/lib/model';
import {access,field,jsonBody} from '@/lib/team-server';

type VisitRow={id:string;farm_id:string;date:string;payload:string};
function farmIdParam(value:string){if(!/^[a-f0-9-]{36}$/.test(value))throw new Error('404:Finca no encontrada.');return value;}
function visitId(value:string,name:string){if(!/^[a-f0-9-]{36}$/.test(value))throw new Error(`400:Visita inválida: ${name}.`);return value;}
function publicDefinition(definition:MetricDefinition){const {id,label,kind,unit,precision,tolerance,graphable}=definition;return {id,label,kind,unit,precision,tolerance,graphable};}
function ordered(a:VisitRow,b:VisitRow){const comparison=a.date.localeCompare(b.date)||a.id.localeCompare(b.id);return comparison<=0?[a,b] as const:[b,a] as const;}

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{
 const user=await identity(req,true),farmId=farmIdParam((await params).id);await access(user,farmId);const input=await jsonBody(req);
 const firstId=visitId(field(input,'visitAId',36),'A'),secondId=visitId(field(input,'visitBId',36),'B');if(firstId===secondId)throw new Error('400:Selecciona dos visitas diferentes.');
 const [a,b]=await Promise.all([db().prepare('SELECT id,farm_id,date,payload FROM visits WHERE id = ? AND farm_id = ?').bind(firstId,farmId).first<VisitRow>(),db().prepare('SELECT id,farm_id,date,payload FROM visits WHERE id = ? AND farm_id = ?').bind(secondId,farmId).first<VisitRow>()]);
 if(!a||!b)throw new Error('404:Una de las visitas no pertenece a esta finca.');const [previousRow,currentRow]=ordered(a,b),previousVisit=JSON.parse(previousRow.payload) as Visit,currentVisit=JSON.parse(currentRow.payload) as Visit;
 if(!previousVisit.reviewed||!currentVisit.reviewed)throw new Error('422:Las dos visitas deben estar revisadas para compararlas.');
 const onlyPrevious:string[]=[],onlyCurrent:string[]=[],comparisons=metricDefinitions.flatMap(definition=>{
  const previous=metricReading(previousVisit,definition),current=metricReading(currentVisit,definition);
  if(previous&&!current){onlyPrevious.push(definition.id);return [];}if(!previous&&current){onlyCurrent.push(definition.id);return [];}if(!previous||!current)return [];
  const comparison=compareMetricReadings(previous,current,definition);
  return [{metric:publicDefinition(definition),previous:readingPayload(previous),current:readingPayload(current),comparison}];
 });
 return Response.json({farmId,previous:visitPayload(previousRow,previousVisit),current:visitPayload(currentRow,currentVisit),comparisons,onlyPrevious,onlyCurrent},{headers:{'Cache-Control':'no-store'}});
}catch(error){return failure(error);}}

function readingPayload(reading:MetricReading){return {originalValue:reading.originalValue,numericValue:reading.numericValue,textValue:reading.textValue,unit:reading.unit};}
function visitPayload(row:VisitRow,visit:Visit){return {id:row.id,date:row.date,responsible:visit.responsible||''};}
