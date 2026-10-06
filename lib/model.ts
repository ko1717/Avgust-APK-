import catalog from './catalog.json';
export { catalog };
export type Answer = {value:string; observation:string; recommendation:string};
export type ActionStatus='proposed'|'pending'|'progress'|'closed'|'cancelled';
export type Action = {owner:string; due:string; status:ActionStatus; closure:string; beforePhotoId:string; photoId:string; completedAt?:string; completedBy?:string; reopenedAt?:string};
export const actionLabels:Record<ActionStatus,string> = {proposed:'Propuesta',pending:'Aceptada',progress:'En proceso',closed:'Completado',cancelled:'Cancelado'};
export const blankAction = ():Action => ({owner:'',due:'',status:'proposed',closure:'',beforePhotoId:'',photoId:'',completedAt:'',completedBy:'',reopenedAt:''});
export type Photo = {id:string; caption:string; chapter:number; criterionId?:string};
export const MAX_PHOTOS=60;
export const MAX_PHOTO_BYTES=8*1024*1024;
export type MetricStatus='healthy'|'acceptable'|'critical'|'pending';
export type VisitMetric={score:number|null;status:MetricStatus;applicable:number;positive:number;findings:number;date:string;responsible:string};
export type Visit = {
 id:string; revision:number; farmId?:string; requestId?:string; canEdit?:boolean; serviceKind?:string; farm:string; date:string; city:string; zone:string; technician:string; responsible:string; rtc:string;
 chapters:number[]; answers:Record<string,Answer>; notes:Record<string,string>; recommendations:Record<string,string>;
 measurements:Record<string,string>; delivery:string; followup:string; conclusion:string; photos:Photo[]; reviewed:boolean; actions?:Record<string,Action>;
};
export const measurementLabels:Record<string,string>={ph:'pH del agua',hardness:'Dureza (ppm)',pressure:'Presión (PSI)',volume:'Volumen por cama (L)',time:'Tiempo por cama (s)',equipment:'Equipo de aplicación'};
export function blankVisit():Visit {const d=new Date();return {id:'',revision:0,farm:'',date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,city:'',zone:'',technician:'',responsible:'Wilson Castro',rtc:'',chapters:[3,4,5],answers:{},notes:{},recommendations:{},measurements:{},delivery:'',followup:'',conclusion:'',photos:[],reviewed:false};}
export function metrics(v:Visit) {
 const items=catalog.filter(c=>v.chapters.includes(c.id)).flatMap(c=>c.items);
 const answered=items.filter(q=>['SI','NO','NA'].includes(v.answers[q.id]?.value));
 const applicable=items.filter(q=>['SI','NO'].includes(v.answers[q.id]?.value));
 const positive=applicable.filter(q=>v.answers[q.id]?.value==='SI').length;
 const findings=items.filter(q=>v.answers[q.id]?.value==='NO').length;
 const score=applicable.length?Math.round(positive/applicable.length*100):null;
 return {total:items.length,answered:answered.length,applicable:applicable.length,positive,findings,score,status:metricStatus(score)};
}
export function metricStatus(score:number|null):MetricStatus{return score===null?'pending':score>=80?'healthy':score>=50?'acceptable':'critical';}
export const metricStatusLabels:Record<MetricStatus,string>={healthy:'Saludable',acceptable:'Aceptable',critical:'Crítico',pending:'Sin medición'};
export function visitMetric(v:Visit):VisitMetric{const m=metrics(v);return {score:m.score,status:m.status,applicable:m.applicable,positive:m.positive,findings:m.findings,date:v.date,responsible:v.responsible};}
export function metricTrend(previous:VisitMetric|undefined,current:VisitMetric):'improved'|'stable'|'declined'|'first'|'pending'{if(!previous)return current.score===null?'pending':'first';if(previous.score===null||current.score===null)return 'pending';const delta=current.score-previous.score;return delta>=5?'improved':delta<=-5?'declined':'stable';}
export const metricTrendLabels={improved:'Aumentó',stable:'Estable',declined:'Disminuyó',first:'Primera medición',pending:'Sin comparación'};
export function issues(v:Visit):string[] {
 const errors:string[]=[];
 for(const [key,label] of [['farm','Finca'],['date','Fecha'],['responsible','Responsable AVGUST'],['technician','Representante de la finca']] as const) if(!v[key].trim())errors.push(`Completa: ${label}.`);
 if(!v.chapters.length&&(!v.serviceKind||v.serviceKind==='assurance'))errors.push('Selecciona al menos un capítulo.');
 if(v.serviceKind&&v.serviceKind!=='assurance'&&!v.conclusion.trim())errors.push('Describe la actividad realizada y sus resultados.');
 for(const c of catalog.filter(c=>v.chapters.includes(c.id))){
  for(const q of c.items){
   const a=v.answers[q.id];
   if(!a?.value)errors.push(`Responde el ítem ${q.id}.`);
   else if(a.value==='NO'&&(!a.observation.trim()||!a.recommendation.trim()))errors.push(`Completa el hallazgo y la recomendación del ítem ${q.id}.`);
  }
 }
 if(!v.reviewed)errors.push('Confirma la revisión técnica del informe.');
 return errors;
}
export function findings(v:Visit){
 return catalog.filter(c=>v.chapters.includes(c.id)).flatMap(c=>c.items).filter(q=>v.answers[q.id]?.value==='NO').map(q=>({id:q.id,text:q.text,answer:v.answers[q.id],action:v.actions?.[q.id]||blankAction()}));
}
export function recommendationDraft(itemId:string){const item=catalog.flatMap(c=>c.items).find(q=>q.id===itemId);return `Corregir el incumplimiento identificado${item?` en ${item.id}`:''}, documentar la acción realizada y verificar su cierre en la próxima visita.`;}
export function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function overdue(a:Action,today=localDate()){return ['pending','progress'].includes(a.status)&&!!a.due&&a.due<today;}
export function farmKey(name:string){return name.trim().replace(/\s+/g,' ').toLocaleLowerCase('es');}
export function compareVisits(previous:Visit,current:Visit){
 const prior=findings(previous);const active=new Set(catalog.filter(c=>current.chapters.includes(c.id)).flatMap(c=>c.items.map(q=>q.id)));
 return prior.map(q=>({...q,result:!active.has(q.id)?'Sin reevaluar':current.answers[q.id]?.value==='SI'?'Corregido':current.answers[q.id]?.value==='NO'?'Recurrente':current.answers[q.id]?.value==='NA'?'No aplica':'Sin reevaluar'}));
}
