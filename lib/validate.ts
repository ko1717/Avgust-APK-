import {catalog,issues,MAX_PHOTOS,type Visit} from './model';
export function validate(input:unknown):Visit {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('400:Datos de visita inválidos.');
 const x=input as Record<string,unknown>;
 const string=(key:string,max=300)=>{if(typeof x[key]!=='string'||(x[key] as string).length>max)throw new Error(`400:Campo inválido: ${key}.`);return (x[key] as string).trim();};
 const map=(key:string)=>{const v=x[key];if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(`400:Campo inválido: ${key}.`);const result:Record<string,string>={};for(const [k,a]of Object.entries(v)){if(!/^[a-z0-9.]+$/i.test(k)||typeof a!=='string'||a.length>12000)throw new Error('400:Texto inválido.');result[k]=a;}return result;};
 if(!Array.isArray(x.chapters)||!x.chapters.every(c=>Number.isInteger(c)&&c>=1&&c<=5)||new Set(x.chapters).size!==x.chapters.length)throw new Error('400:Capítulos inválidos.');
 if(!Number.isInteger(x.revision)||Number(x.revision)<0)throw new Error('400:Versión inválida.');
 if(typeof x.reviewed!=='boolean')throw new Error('400:Revisión inválida.');
 const answers:Visit['answers']={};const raw=x.answers;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('400:Respuestas inválidas.');
 const codes=new Set(catalog.flatMap(c=>c.items.map(i=>i.id)));
 for(const [k,a]of Object.entries(raw)){if(!codes.has(k)||!a||typeof a!=='object'||!['','SI','NO','NA'].includes(a.value)||typeof a.observation!=='string'||typeof a.recommendation!=='string'||a.observation.length>12000||a.recommendation.length>12000)throw new Error('400:Respuesta inválida.');answers[k]={value:a.value,observation:a.observation,recommendation:a.recommendation};}
 if(!Array.isArray(x.photos)||x.photos.length>MAX_PHOTOS)throw new Error('400:Máximo '+MAX_PHOTOS+' fotografías por informe.');
 const photos=x.photos.map(p=>{if(!p||typeof p.id!=='string'||!/^[a-f0-9-]{36}$/.test(p.id)||typeof p.caption!=='string'||p.caption.length>2000||!Number.isInteger(p.chapter)||p.chapter<1||p.chapter>5||p.criterionId!==undefined&&typeof p.criterionId!=='string')throw new Error('400:Fotografía inválida.');const criterionId=p.criterionId||'';if(criterionId&&!catalog.find(c=>c.id===p.chapter)?.items.some(q=>q.id===criterionId))throw new Error('400:El subcapítulo de la fotografía no corresponde al capítulo seleccionado.');return {id:p.id,caption:p.caption,chapter:p.chapter,criterionId};});
 if(new Set(photos.map(p=>p.id)).size!==photos.length)throw new Error('400:Fotografías duplicadas.');
 const actions:NonNullable<Visit['actions']>={};
 if(x.actions!==undefined){
  if(!x.actions||typeof x.actions!=='object'||Array.isArray(x.actions))throw new Error('400:Plan de acción inválido.');
  for(const [key,a] of Object.entries(x.actions)){
   if(!codes.has(key)||!a||typeof a!=='object'||Array.isArray(a))throw new Error('400:Acción inválida.');
   const raw=a as Record<string,unknown>;
   for(const [field,max] of [['owner',300],['due',10],['closure',12000],['photoId',36]] as const)if(typeof raw[field]!=='string'||(raw[field] as string).length>max)throw new Error('400:Campo de acción inválido.');
   if(!['proposed','pending','progress','closed','cancelled'].includes(String(raw.status)))throw new Error('400:Estado de acción inválido.');
   const action={owner:(raw.owner as string).trim(),due:raw.due as string,status:raw.status as 'proposed'|'pending'|'progress'|'closed'|'cancelled',closure:(raw.closure as string).trim(),beforePhotoId:typeof raw.beforePhotoId==='string'?raw.beforePhotoId:'',photoId:raw.photoId as string,completedAt:typeof raw.completedAt==='string'?raw.completedAt:'',completedBy:typeof raw.completedBy==='string'?raw.completedBy:'',reopenedAt:typeof raw.reopenedAt==='string'?raw.reopenedAt:''};
   if(action.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(action.due)||!Number.isFinite(Date.parse(action.due))||new Date(action.due).toISOString().slice(0,10)!==action.due))throw new Error('400:Fecha límite inválida.');
   if(action.beforePhotoId.length>36)throw new Error('400:Campo de acción inválido.');
   for(const stamp of [action.completedAt,action.reopenedAt])if(stamp&&(!Number.isFinite(Date.parse(stamp))||stamp.length>40))throw new Error('400:Fecha de seguimiento inválida.');
   if(action.completedBy.length>300)throw new Error('400:Campo de acción inválido.');
   if(action.photoId&&!photos.some(p=>p.id===action.photoId&&p.chapter===Number(key.split('.')[0])))throw new Error('400:La evidencia debe ser una fotografía del capítulo y de esta visita.');
   if(action.beforePhotoId&&!photos.some(p=>p.id===action.beforePhotoId&&p.chapter===Number(key.split('.')[0])))throw new Error('400:La evidencia inicial debe ser una fotografía del capítulo y de esta visita.');
   if(action.beforePhotoId&&action.beforePhotoId===action.photoId)throw new Error('400:Selecciona fotografías distintas para el antes y el cierre.');
   if(action.status==='closed'&&(!action.owner||!action.due||!action.closure))throw new Error('400:Para cerrar un hallazgo completa responsable, fecha límite y nota de cierre.');
   actions[key]=action;
  }
 }
 const v:Visit={id:string('id',36),revision:Number(x.revision),farm:string('farm'),date:string('date'),city:string('city'),zone:string('zone'),technician:string('technician'),responsible:string('responsible'),rtc:string('rtc'),chapters:x.chapters as number[],answers,notes:map('notes'),recommendations:map('recommendations'),measurements:map('measurements'),delivery:string('delivery'),followup:string('followup'),conclusion:string('conclusion',15000),photos,reviewed:x.reviewed};
 v.actions=actions;
 if(x.serviceKind!==undefined){const serviceKind=x.serviceKind;if(typeof serviceKind!=='string'||!['assurance','training','calibration','followup'].includes(serviceKind))throw new Error('400:Tipo de servicio inválido.');v.serviceKind=serviceKind;}
 for(const key of ['farmId','requestId'] as const){if(x[key]!==undefined&&x[key]!==''){if(typeof x[key]!=='string'||!/^([a-f0-9-]{36})$/.test(x[key] as string))throw new Error('400:Vínculo inválido.');v[key]=x[key] as string;}}
 if(!v.farm||!v.responsible)throw new Error('400:Completa la finca y el responsable AVGUST para guardar.');
 for(const date of [v.date,v.delivery,v.followup])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw new Error('400:Fecha inválida.');
 if(!v.date)throw new Error('400:Completa la fecha.');
 if(v.id&&!/^[a-f0-9-]{36}$/.test(v.id))throw new Error('400:Identificador inválido.');
 if(v.reviewed&&issues(v).length)throw new Error('422:Completa los datos, respuestas y recomendaciones antes de marcar el informe revisado.');
 return v;
}
