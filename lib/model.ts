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
 id:string; revision:number; updated?:string; farmId?:string; requestId?:string; canEdit?:boolean; serviceKind?:string; farm:string; date:string; city:string; zone:string; technician:string; responsible:string; rtc:string;
 chapters:number[]; answers:Record<string,Answer>; notes:Record<string,string>; recommendations:Record<string,string>;
 measurements:Record<string,string>; delivery:string; followup:string; conclusion:string; photos:Photo[]; reviewed:boolean; actions?:Record<string,Action>;
};
export const measurementLabels:Record<string,string>={ph:'pH del agua',hardness:'Dureza del agua (ppm)',conductivity:'Conductividad del agua (mS/cm)',mixPh:'pH mezcla final',mixConductivity:'Conductividad mezcla final (mS/cm)',pressure:'Presión de la bomba (PSI)',implementPressure:'Presión del implemento (PSI)',volume:'Volumen por cama (L)',time:'Tiempo por cama (s)',equipment:'Equipo de aplicación',implement:'Implementos de aplicación'};
export const measurementGroups=[
 {criterionId:'4.6',title:'4.6 Calidad del agua',keys:['ph','hardness','conductivity']},
 {criterionId:'4.6',title:'4.6 Mezcla final',keys:['mixPh','mixConductivity']},
 {criterionId:'5.1',title:'5.1 Presión',keys:['pressure','implementPressure']},
 {criterionId:'5.3',title:'5.3 Equipo de aplicación',keys:['equipment','implement']},
 {criterionId:'5.6',title:'5.6 Volumen y tiempo por cama',keys:['volume','time']}
] as const;
export function measurementGroupsFor(measurements:Record<string,string>,criterionId?:string){
 return measurementGroups.filter(group=>!criterionId||group.criterionId===criterionId).map(group=>({criterionId:group.criterionId,title:group.title,rows:group.keys.filter(key=>!!measurements[key]?.trim()).map(key=>({key,label:measurementLabels[key],value:measurements[key]}))})).filter(group=>group.rows.length);
}
export function ungroupedMeasurements(measurements:Record<string,string>){
 const grouped=new Set<string>(measurementGroups.flatMap(group=>group.keys));
 return Object.entries(measurementLabels).filter(([key])=>!grouped.has(key)&&!!measurements[key]?.trim()).map(([key,label])=>({key,label,value:measurements[key]}));
}
export const CHAPTER_WEIGHTS:Record<number,number> = {1:0.05, 2:0.25, 3:0.10, 4:0.30, 5:0.30};
export const CHAPTER_MAX_POINTS:Record<number,number> = {1:5, 2:25, 3:10, 4:30, 5:30};

export function todayDate(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

export function blankVisit():Visit {return {id:'',revision:0,farm:'',date:todayDate(),city:'',zone:'',technician:'',responsible:'Wilson Castro',rtc:'',chapters:[2,3,4,5],answers:{},notes:{},recommendations:{},measurements:{},delivery:'',followup:'',conclusion:'',photos:[],reviewed:false};}
export function metrics(v:Visit) {
 const selected = new Set(v.chapters && v.chapters.length ? v.chapters : [1, 2, 3, 4, 5]);
 const items=catalog.filter(c=>selected.has(c.id)).flatMap(c=>c.items);
 const answered=items.filter(q=>['SI','NO','NA'].includes(v.answers[q.id]?.value));
 const applicable=items.filter(q=>['SI','NO'].includes(v.answers[q.id]?.value));
 const positive=applicable.filter(q=>v.answers[q.id]?.value==='SI').length;
 const findings=applicable.filter(q=>v.answers[q.id]?.value==='NO').length;

 let totalPointsEarned = 0;
 let totalAuditedWeight = 0;
 const chapterScores: Record<number, number | null> = {};
 const chapterPoints: Record<number, number> = {};
 const evaluatedChapters: number[] = [];

 for (const c of catalog) {
  if (!selected.has(c.id)) {
   chapterScores[c.id] = null;
   chapterPoints[c.id] = 0;
   continue;
  }
  const cApplicable = c.items.filter(q => ['SI', 'NO'].includes(v.answers[q.id]?.value));
  const cPositive = cApplicable.filter(q => v.answers[q.id]?.value === 'SI').length;
  if (cApplicable.length > 0) {
   const cCompliance = (cPositive / cApplicable.length) * 100;
   const weight = CHAPTER_WEIGHTS[c.id] ?? 0.2;
   const points = (cCompliance / 100) * (weight * 100);
   chapterScores[c.id] = Math.round(cCompliance * 10) / 10;
   chapterPoints[c.id] = Math.round(points * 10) / 10;
   evaluatedChapters.push(c.id);
   totalPointsEarned += points;
   totalAuditedWeight += weight;
  } else {
   chapterScores[c.id] = null;
   chapterPoints[c.id] = 0;
  }
 }

 const weightedScore = totalAuditedWeight > 0 ? Math.round((totalPointsEarned / totalAuditedWeight) * 10) / 10 : null;
 const pointsEarned = Math.round(totalPointsEarned * 10) / 10;
 const criteriaCompliance = applicable.length ? Math.round((positive / applicable.length) * 100) : null;
 const score = weightedScore !== null ? Math.round(weightedScore) : null;

 return {
  total: items.length,
  answered: answered.length,
  applicable: applicable.length,
  positive,
  findings,
  score,
  weightedScore,
  pointsEarned,
  criteriaCompliance,
  auditedWeight: Math.round(totalAuditedWeight * 100) / 100,
  evaluatedChapters,
  chapterScores,
  chapterPoints,
  status: metricStatus(score)
 };
}
export function metricStatus(score:number|null):MetricStatus{return score===null?'pending':score>=95?'healthy':score>=80?'acceptable':'critical';}
export const metricStatusLabels:Record<MetricStatus,string>={healthy:'Saludable',acceptable:'Alerta',critical:'Vulnerable',pending:'Sin medición'};
export const metricStatusDescriptions:Record<MetricStatus,string>={healthy:'Proceso de aspersión confiable que favorece la eficiencia del control fitosanitario y contribuye a mantener la sanidad del cultivo.',acceptable:'Desviaciones que pueden comprometer la eficiencia de la aspersión que requiere una acción correctiva.',critical:'Deficiencias importantes que ponen en riesgo la protección fitosanitaria del cultivo.',pending:'Sin una visita revisada con criterios aplicables.'};
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
 const chapters=v.chapters?.length?v.chapters:[1,2,3,4,5];
 return catalog.filter(c=>chapters.includes(c.id)).flatMap(c=>c.items).filter(q=>v.answers[q.id]?.value==='NO').map(q=>({id:q.id,text:q.text,answer:v.answers[q.id],action:v.actions?.[q.id]||blankAction()}));
}
export function recommendationDraft(itemId:string){const item=catalog.flatMap(c=>c.items).find(q=>q.id===itemId);return `Corregir el incumplimiento identificado${item?` en ${item.id}`:''}, documentar la acción realizada y verificar su cierre en la próxima visita.`;}
export function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function overdue(a:Action,today=localDate()){return ['pending','progress'].includes(a.status)&&!!a.due&&a.due<today;}
export function farmKey(name:string){return name.trim().replace(/\s+/g,' ').toLocaleLowerCase('es');}
export function sameChapterScope(a:Pick<Visit,'chapters'>,b:Pick<Visit,'chapters'>){
 const ids=(visit:Pick<Visit,'chapters'>)=>visit.chapters?.length?[...visit.chapters].sort((x,y)=>x-y):[1,2,3,4,5];
 return JSON.stringify(ids(a))===JSON.stringify(ids(b));
}
export function compareVisits(previous:Visit,current:Visit){
 const prior=findings(previous);const active=new Set(catalog.filter(c=>current.chapters.includes(c.id)).flatMap(c=>c.items.map(q=>q.id)));
 return prior.map(q=>({...q,result:!active.has(q.id)?'Sin reevaluar':current.answers[q.id]?.value==='SI'?'Corregido':current.answers[q.id]?.value==='NO'?'Recurrente':current.answers[q.id]?.value==='NA'?'No aplica':'Sin reevaluar'}));
}
