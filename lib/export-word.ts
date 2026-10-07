import {serviceLabels} from './team';
import {Document,Packer,Paragraph,TextRun,HeadingLevel,Table,TableRow,TableCell,WidthType,ImageRun} from 'docx';
import {measurementGroupsFor,ungroupedMeasurements,actionLabels,metricStatusLabels,type Visit} from './model';
import {reportFindings,reportSections,type ReportSnapshot} from './reports';
import {nativeFiles,saveThroughBridge} from './native';
import template from './template.json';
export async function download(blob:Blob,name:string){const bridge=nativeFiles();if(bridge)return saveThroughBridge(bridge,blob,name);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export async function exportWord(v:Visit,snapshot?:ReportSnapshot){
  const sections=snapshot?.sections||reportSections(),m=snapshot?.indicator||(()=>{const items=sections.filter(c=>v.chapters.includes(c.id)).flatMap(c=>c.items),applicable=items.filter(q=>['SI','NO'].includes(v.answers[q.id]?.value)),positive=applicable.filter(q=>v.answers[q.id]?.value==='SI').length;return {total:items.length,answered:items.filter(q=>['SI','NO','NA'].includes(v.answers[q.id]?.value)).length,applicable:applicable.length,positive,findings:applicable.filter(q=>v.answers[q.id]?.value==='NO').length,score:applicable.length?Math.round(positive/applicable.length*100):null,status:applicable.length?(positive/applicable.length>=.95?'healthy':positive/applicable.length>=.85?'acceptable':'critical'):'pending' as const};})(),reportFindingsForVersion=reportFindings(v,sections);
 const groupedMeasurements=measurementGroupsFor(v.measurements),unplacedGroups=groupedMeasurements.filter(group=>!v.chapters.includes(Number(group.criterionId.split('.')[0]))),otherMeasurements=ungroupedMeasurements(v.measurements);
 const children:(Paragraph|Table)[]=[];
 const text=(s:string)=>children.push(new Paragraph({children:[new TextRun(s)],spacing:{after:120}}));
 const heading=(s:string,level:typeof HeadingLevel.HEADING_1|typeof HeadingLevel.HEADING_2=HeadingLevel.HEADING_1)=>children.push(new Paragraph({text:s,heading:level,keepNext:true,spacing:{before:240,after:120}}));
 const table=(rows:string[][])=>children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:rows.map(r=>new TableRow({children:r.map(s=>new TableCell({children:[new Paragraph(s)],margins:{top:100,bottom:100,left:120,right:120}}))}))}));
 children.push(new Paragraph({text:'AVGUST CARE 360',heading:HeadingLevel.TITLE}));text('Programa de aseguramiento del proceso MIPE');heading('Informe técnico de visita');if(v.serviceKind)text('Servicio: '+serviceLabels[v.serviceKind as keyof typeof serviceLabels]);text(`${v.farm} · ${v.date}`);text(v.reviewed?'Revisado por el responsable técnico':'BORRADOR · Pendiente de revisión técnica');
 table([['Finca',v.farm],['Fecha',v.date],['Ciudad / departamento',v.city],['Municipio / zona',v.zone],['Representante de la finca',v.technician],['Responsable AVGUST',v.responsible],['Representante técnico comercial',v.rtc]].map(([k,a])=>[k,a||'No registrado']));
 for(const s of template){heading(s.title);for(const p of s.paragraphs)text(p);}
 heading('Cronograma de actividades');table([['Visita y aseguramiento',v.date],['Entrega del informe',v.delivery||'No programado'],['Seguimiento',v.followup||'No programado']]);
 heading('Indicador de la visita');text(m.score===null?'Sin medición: no hay respuestas aplicables para calcular el indicador.':`${metricStatusLabels[m.status]} · ${m.score}%. ${m.positive} respuestas “Sí” de ${m.applicable} criterios aplicables; ${m.findings} hallazgos por corregir.`);heading('Alcance de la evaluación');text(`${m.answered} de ${m.total} criterios respondidos. ${m.findings} respuestas “No” en los capítulos con cuestionario.`);text(`Capítulos no evaluados: ${sections.filter(c=>!v.chapters.includes(c.id)).map(c=>`${c.id}. ${c.title}`).join('; ')||'Ninguno'}.`);
 for(const c of sections.filter(c=>v.chapters.includes(c.id))){
  heading(`Capítulo ${c.id}. ${c.title}`);
  for(const q of c.items){
   const a=v.answers[q.id];
   heading(`${q.id} · ${a?.value==='SI'?'Sí':a?.value==='NO'?'No':a?.value==='NA'?'No aplica':'Sin evaluar'}`,HeadingLevel.HEADING_2);
   text(q.text);
   if(a?.observation)text(`Hallazgo / observación: ${a.observation}`);
   if(a?.recommendation)text(`Recomendación: ${a.recommendation}`);
   for(const group of groupedMeasurements.filter(item=>item.criterionId===q.id)){
    heading(group.title,HeadingLevel.HEADING_2);
    table(group.rows.map(row=>[row.label,row.value]));
   }
  }
  if(v.notes[c.id]){heading('Observaciones del capítulo',HeadingLevel.HEADING_2);text(v.notes[c.id]);}
  if(v.recommendations[c.id]){heading('Recomendaciones del capítulo',HeadingLevel.HEADING_2);text(v.recommendations[c.id]);}
 }
 if(unplacedGroups.length||otherMeasurements.length){
  heading('Mediciones de capítulos no evaluados');
  for(const group of unplacedGroups){heading(group.title,HeadingLevel.HEADING_2);table(group.rows.map(row=>[row.label,row.value]));}
  if(otherMeasurements.length)table(otherMeasurements.map(row=>[row.label,row.value]));
 }
 if(v.conclusion){heading('Conclusiones y seguimiento');text(v.conclusion);}
 heading('Plan de acción');
 for(const f of reportFindingsForVersion){const action=f.action||{owner:'',due:'',status:'proposed' as const,closure:'',photoId:''};heading('Hallazgo '+f.id+' · '+actionLabels[action.status],HeadingLevel.HEADING_2);text(f.answer.observation||f.text);text('Acción: '+(f.answer.recommendation||'Sin registrar'));text('Responsable: '+(action.owner||'Sin asignar')+' · Fecha límite: '+(action.due||'Sin fecha'));if(action.closure)text('Seguimiento / cierre: '+action.closure);if(action.photoId)text('Evidencia: fotografía '+(v.photos.findIndex(p=>p.id===action.photoId)+1)+' del registro fotográfico.');}
 if(!reportFindingsForVersion.length)text('No hay hallazgos en los capítulos evaluados.');
 heading('Registro fotográfico');if(!v.photos.length)text('No se adjuntaron fotografías.');
 for(const [i,p]of v.photos.entries()){const r=await fetch(`/api/photos/${p.id}`);if(!r.ok)throw new Error('No se pudo cargar una fotografía. No se generó el Word.');const blob=await r.blob();const bitmap=await createImageBitmap(blob);const scale=Math.min(530/bitmap.width,390/bitmap.height,1);const width=Math.round(bitmap.width*scale),height=Math.round(bitmap.height*scale);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No se pudo preparar la imagen.');ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(bitmap,0,0,width,height);bitmap.close();const jpg=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo preparar la imagen.')),'image/jpeg',.9));children.push(new Paragraph({children:[new ImageRun({type:'jpg',data:new Uint8Array(await jpg.arrayBuffer()),transformation:{width,height}})],keepNext:true}));text(`Fotografía ${i+1} · Capítulo ${p.chapter}${p.criterionId?` · Subcapítulo ${p.criterionId}`:''}. ${p.caption||'Sin descripción'}`);}
 heading('Responsables');text(`${v.responsible} · AVGUST`);if(v.rtc)text(`${v.rtc} · Representante técnico comercial`);text(`${v.technician||'Pendiente'} · Representante de la finca`);
 const doc=new Document({
  creator:'AVGUST CARE 360',title:`Informe ${v.farm}`,
  styles:{default:{
   document:{run:{font:'Arial',size:22,color:'172D31'},paragraph:{spacing:{after:120,line:276}}},
   title:{run:{font:'Arial',size:36,bold:true,color:'000000'}},
   heading1:{run:{font:'Arial',size:28,bold:true,color:'000000'}},
   heading2:{run:{font:'Arial',size:24,bold:true,color:'000000'}}
  }},
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1020,bottom:1020,left:1020,right:1020}}},children}]
 });
 await download(await Packer.toBlob(doc),`AVGUST CARE 360 - ${v.farm.replace(/[^\p{L}\p{N} -]/gu,'')} - ${v.date}.docx`);
}
