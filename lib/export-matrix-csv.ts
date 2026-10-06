import {download} from './export-word';
import type {ConsolidatedMetricAnalysis} from './metric-analysis';

const csvValue=(value:string)=>`"${value.replace(/"/g,'""')}"`;

export async function exportConsolidatedMatrixCsv(data:ConsolidatedMetricAnalysis,generatedAt=new Date().toISOString().slice(0,10)){
 const rows=[['Finca','Fecha','Responsable AVGUST','Capítulo','Ítem','Criterio','Respuesta','Hallazgo / observación','Recomendación'],...data.matrix.map(row=>[row.farm,row.date,row.responsible,row.chapter,row.item,row.text,row.answer,row.observation,row.recommendation])];
 const contents=`\uFEFF${rows.map(row=>row.map(csvValue).join(';')).join('\r\n')}`;
 await download(new Blob([contents],{type:'text/csv;charset=utf-8'}),`AVGUST CARE 360 - Matriz consolidada - ${generatedAt}.csv`);
}
