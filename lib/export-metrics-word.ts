import {Document,HeadingLevel,Packer,Paragraph,Table} from 'docx';
import {download} from './export-word';
import {actionLabels,metricStatusDescriptions,metricStatusLabels,metricTrendLabels} from './model';
import type {FarmMetricAnalysis} from './metric-analysis';
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

export async function exportFarmMetricsWord(data:FarmMetricAnalysis){
 const children:(Paragraph|Table)[]=[];
 const latest=data.latest;
 children.push(...coverPage({
  label:'Informe de evolución por finca',
  title:data.farm,
  subtitle:'Acompañamiento en campo y evolución del aseguramiento técnico',
  meta:[
   ['Finca',data.farm],
   ['Periodo analizado',`${data.first?.date||'Sin mediciones'} a ${latest?.date||'Sin mediciones'}`],
   ['Aseguramientos revisados',String(data.records.length)]
  ],
  score:latest?`${latest.score}%`:'—',
  status:latest?metricStatusLabels[latest.status]:'Sin medición',
  statusKey:latest?.status||'pending'
 }));

 children.push(sectionHeading('Resumen ejecutivo'));
 if(latest){
  children.push(
   bodyParagraph(metricStatusDescriptions[latest.status]),
   labelValueTable([
    ['Indicador de aseguramiento',`${latest.score}% · ${metricStatusLabels[latest.status]}`],
    ['Puntos oficiales ganados',`${latest.pointsEarned}/100`],
    ['Alcance evaluado',`${latest.evaluatedChapters} de 5 capítulos (${latest.weightedCoveragePct}% del peso)`],
    ['Variación desde la primera medición',`${metricTrendLabels[data.trend]}${data.delta===null?'':` (${data.delta>0?'+':''}${data.delta} puntos)`}`],
    ['Informes revisados con indicador',String(data.records.length)]
   ])
  );
 }else{
  children.push(bodyParagraph('Aún no hay mediciones revisadas para esta finca.'));
 }

 children.push(
  sectionHeading('Resumen anual'),
  professionalTable([
   ['Año','Indicador promedio','Cierre del año','Visitas','Estado'],
   ...data.yearly.map(year=>[
    year.year,
    `${year.average}%`,
    `${year.closing}%`,
    String(year.visits),
    metricStatusLabels[year.status]
   ])
  ],{compact:true}),
  sectionHeading('Resultado por capítulo · última visita'),
  bodyParagraph('El indicador porcentual muestra el nivel de cumplimiento de cada capítulo evaluado.',{color:'60737D'}),
  professionalTable([
   ['Capítulo','Indicador','Hallazgos','Criterios aplicables','Estado'],
   ...data.chapters.map(chapter=>[
    `${chapter.id}. ${chapter.title}`,
    chapter.score===null?'Sin medición':`${chapter.score}%`,
    String(chapter.findings),
    String(chapter.applicable),
    metricStatusLabels[chapter.status]
   ])
  ],{compact:true})
 );

 children.push(sectionHeading('Hallazgos y acciones correctivas · última visita'));
 if(data.problems.length){
  for(const problem of data.problems){
   children.push(
    sectionHeading(`${problem.id} · ${problem.text}`,HeadingLevel.HEADING_2),
    callout(
     'Hallazgo / observación registrada',
     problem.observation||'Sin observación registrada en este informe.',
     'finding'
    ),
    new Paragraph({spacing:{before:80,after:0}}),
    callout(
     'Recomendación sugerida',
     problem.recommendation||'Definir y documentar la acción correctiva.',
     'recommendation'
    ),
    new Paragraph({spacing:{before:80,after:0}}),
    labelValueTable([
     ['Responsable',problem.action.owner||'Sin asignar'],
     ['Fecha objetivo',problem.action.due||'Sin definir'],
     ['Estado',actionLabels[problem.action.status as keyof typeof actionLabels]||problem.action.status],
     ['Cierre',problem.action.closure||'Pendiente']
    ])
   );
  }
 }else{
  children.push(callout('Resultado','No se identificaron respuestas No en la última evaluación.','neutral'));
 }

 children.push(
  sectionHeading('Historial de aseguramientos'),
  professionalTable([
   ['Fecha','Indicador','Puntos ganados','Capítulos evaluados','Estado','Responsable','Hallazgos'],
   ...data.records.map(record=>[
    record.date,
    `${record.score}%`,
    `${record.pointsEarned}/100`,
    `${record.evaluatedChapters}/5 · ${record.weightedCoveragePct}%`,
    metricStatusLabels[record.status],
    record.responsible||'Sin registrar',
    String(record.findings)
   ])
  ],{compact:true})
 );

 const reportLabel='Evolución por finca';
 const doc=new Document({
  creator:'AVGUST CARE 360',
  title:`Informe de evolución · ${data.farm}`,
  description:'Evolución del indicador de aseguramiento técnico por finca',
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
  `AVGUST CARE 360 - Informe de evolución - ${safeWordFilePart(data.farm)} - ${latest?.date||'sin-fecha'}.docx`
 );
}
