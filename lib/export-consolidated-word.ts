import {Document,HeadingLevel,Packer,Paragraph,Table} from 'docx';
import {download} from './export-word';
import {actionLabels,findings,farmKey,metricStatusDescriptions,metricStatusLabels,metricTrendLabels} from './model';
import type {ConsolidatedMetricAnalysis} from './metric-analysis';
import {
 bodyParagraph,
 callout,
 coverPage,
 documentFooter,
 documentHeader,
 labelValueTable,
 professionalDocumentStyles,
 professionalTable,
 safeWordFilePart,
 sectionHeading
} from './word-design';

export async function exportConsolidatedWord(data:ConsolidatedMetricAnalysis,period:string){
 const children:(Paragraph|Table)[]=[];
 const periodLabel=period||'Histórico seleccionado';
 children.push(...coverPage({
  label:'Informe técnico consolidado',
  title:'Consolidado de aseguramientos',
  subtitle:'Lectura ejecutiva de resultados, hallazgos y acciones por finca',
  meta:[
   ['Periodo',periodLabel],
   ['Fincas analizadas',String(data.farms)],
   ['Aseguramientos revisados',String(data.records.length)]
  ],
  score:data.score===null?'—':`${data.score}%`,
  status:metricStatusLabels[data.status],
  statusKey:data.status
 }));

 children.push(
  sectionHeading('Resumen ejecutivo'),
  bodyParagraph(metricStatusDescriptions[data.status]),
  labelValueTable([
   ['Indicador consolidado',data.score===null?'Sin medición':`${data.score}% · ${metricStatusLabels[data.status]}`],
   ['Comportamiento',metricTrendLabels[data.trend]],
   ['Fincas analizadas',String(data.farms)],
   ['Aseguramientos revisados',String(data.records.length)]
  ]),
  sectionHeading('Resultado por capítulo'),
  bodyParagraph('Los porcentajes resumen el cumplimiento de los criterios aplicables en el periodo seleccionado.',{color:'60737D'}),
  professionalTable([
   ['Capítulo','Indicador','Hallazgos','Criterios aplicables','Fincas','Estado'],
   ...data.chapters.map(chapter=>[
    `${chapter.id}. ${chapter.title}`,
    chapter.score===null?'Sin medición':`${chapter.score}%`,
    String(chapter.findings),
    String(chapter.applicable),
    String(chapter.farms),
    metricStatusLabels[chapter.status]
   ])
  ],{compact:true}),
  sectionHeading('Ítems prioritarios'),
  professionalTable([
   ['Ítem','Capítulo','Hallazgos','Frecuencia','Descripción'],
   ...data.items
    .filter(item=>item.findings>0)
    .slice(0,15)
    .map(item=>[
     item.id,
     `${item.chapter}. ${item.chapterTitle}`,
     String(item.findings),
     `${item.rate}%`,
     item.text
    ])
  ],{compact:true})
 );

 const latestByFarm=new Map<string,typeof data.records[number]>();
 for(const record of data.records){
  const key=farmKey(record.visit.farm);
  const previous=latestByFarm.get(key);
  if(!previous||record.date>previous.date||(record.date===previous.date&&(record.visit.revision||0)>(previous.visit.revision||0))){
   latestByFarm.set(key,record);
  }
 }
 const correctiveItems=[...latestByFarm.values()].flatMap(record=>
  findings(record.visit).map(problem=>({
   farm:record.visit.farm,
   date:record.date,
   id:problem.id,
   text:problem.text,
   observation:problem.answer.observation,
   recommendation:problem.answer.recommendation||'Definir acción correctiva',
   owner:problem.action.owner||'Sin asignar',
   due:problem.action.due||'Sin definir',
   status:actionLabels[problem.action.status]||problem.action.status,
   closure:problem.action.closure||'Pendiente'
  }))
 );

 children.push(sectionHeading('Hallazgos y acciones correctivas por finca'));
 if(correctiveItems.length){
  for(const item of correctiveItems){
   children.push(
    sectionHeading(`${item.farm} · ${item.id}`,HeadingLevel.HEADING_2),
    bodyParagraph(item.text,{bold:true,color:'263E4A',keepNext:true}),
    callout(
     'Hallazgo / observación registrada',
     item.observation||'Sin observación registrada en este informe.',
     'finding'
    ),
    new Paragraph({spacing:{before:80,after:0}}),
    callout('Acción recomendada',item.recommendation,'recommendation'),
    new Paragraph({spacing:{before:80,after:0}}),
    labelValueTable([
     ['Fecha del aseguramiento',item.date],
     ['Responsable',item.owner],
     ['Fecha objetivo',item.due],
     ['Estado',item.status],
     ['Verificación de cierre',item.closure]
    ])
   );
  }
 }else{
  children.push(callout('Resultado','Las últimas visitas revisadas no registran respuestas No.','neutral'));
 }

 children.push(
  sectionHeading('Tendencia del periodo'),
  professionalTable([
   ['Periodo','Indicador','Hallazgos','Aseguramientos'],
   ...data.timeline.map(point=>[
    point.period,
    `${point.score}%`,
    String(point.findings),
    String(point.reports)
   ])
  ],{compact:true})
 );

 const reportLabel='Consolidado de aseguramientos';
 const doc=new Document({
  creator:'AVGUST CARE 360',
  title:'Consolidado de aseguramientos',
  description:'Resultados consolidados del programa de aseguramiento técnico',
  styles:professionalDocumentStyles,
  sections:[{
   properties:{
    titlePage:true,
    page:{size:{width:11906,height:16838},margin:{top:1080,bottom:900,left:960,right:960,header:500,footer:450}}
   },
   headers:{default:documentHeader(reportLabel)},
   footers:{default:documentFooter()},
   children
  }]
 });
 await download(
  await Packer.toBlob(doc),
  `AVGUST CARE 360 - Informe consolidado - ${safeWordFilePart(periodLabel)}.docx`
 );
}
