'use client';
import {Bar,BarChart,CartesianGrid,Legend,Rectangle,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {metricStatusLabels,type MetricStatus} from '@/lib/model';
import type {ChapterMetricDetail,ConsolidatedMetricAnalysis} from '@/lib/metric-analysis';

function Status({value}:{value:MetricStatus}){return <span className={'metric-status '+value}>{metricStatusLabels[value]}</span>;}
function answerLabel(value:string|null){return value==='SI'?'Sí':value==='NO'?'No':value==='NA'?'No aplica':'Sin evaluar';}

export function FarmChapterDetails({chapters}:{chapters:ChapterMetricDetail[]}){
 return <div className="chapter-details">
  {chapters.map(chapter=><details className="chapter-detail" key={chapter.id}>
   <summary>
    <span><strong>{chapter.id}. {chapter.title}</strong><small>{chapter.findings} hallazgo{chapter.findings===1?'':'s'} · {chapter.applicable} criterios aplicables · primera visita {chapter.firstScore===null?'sin medición':`${chapter.firstScore}%`}</small></span>
    <b>{chapter.score===null?'—':`${chapter.score}%`}</b>
    <Status value={chapter.status}/>
   </summary>
   <div className="chapter-detail-body">
    <div className="metric-chart">
     <div><h4>Primera visita vs última visita</h4><p>Indicador por subcapítulo en este periodo.</p></div>
     <div className="chart-scroll"><div className="chapter-detail-chart">
      <ResponsiveContainer width="100%" height={260}>
       <BarChart data={chapter.items} margin={{top:10,right:12,left:-16,bottom:4}}>
        <CartesianGrid vertical={false} stroke="#e3ebeb"/>
        <XAxis dataKey="id" tickLine={false} axisLine={false}/>
        <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={value=>`${value}%`}/>
        <Tooltip formatter={(value,name)=>[typeof value==='number'?`${value}%`:'Sin evaluar',name]}/>
        <Legend/>
        <Bar dataKey="firstScore" name="Primera visita" fill="#007fa3" radius={[4,4,0,0]} isAnimationActive={false}/>
        <Bar dataKey="latestScore" name="Última visita" fill="#f2a900" radius={[4,4,0,0]} isAnimationActive={false}/>
       </BarChart>
      </ResponsiveContainer>
     </div></div>
    </div>
    <div className="table-scroll">
     <table className="followup-table metric-table"><thead><tr><th>Subcapítulo</th><th>Aspecto evaluado</th><th>Primera visita</th><th>Última visita</th></tr></thead>
      <tbody>{chapter.items.map(item=><tr key={item.id}><td><strong>{item.id}</strong></td><td>{item.text}</td><td>{answerLabel(item.firstAnswer)}</td><td>{answerLabel(item.latestAnswer)}</td></tr>)}</tbody>
     </table>
    </div>
   </div>
  </details>)}
 </div>;
}

type ConsolidatedChapter=ConsolidatedMetricAnalysis['chapters'][number];
type ConsolidatedItem=ConsolidatedMetricAnalysis['items'][number];

export function ConsolidatedChapterDetails({chapters,items}:{chapters:ConsolidatedChapter[];items:ConsolidatedItem[]}){
 return <div className="chapter-details consolidated-chapter-details">
  {chapters.map(chapter=>{
   const chapterItems=items.filter(item=>item.chapter===chapter.id);
   return <details className="chapter-detail" key={chapter.id}>
    <summary>
     <span><strong>{chapter.id}. {chapter.title}</strong><small>{chapter.findings} hallazgo{chapter.findings===1?'':'s'} en {chapter.applicable} criterios · {chapter.farms} finca{chapter.farms===1?'':'s'}</small></span>
     <b>{chapter.score===null?'—':`${chapter.score}%`}</b>
     <Status value={chapter.status}/>
    </summary>
    <div className="chapter-detail-body">
     {chapterItems.length?<>
      <div className="metric-chart">
       <div><h4>Incumplimientos por subcapítulo</h4><p>Porcentaje de respuestas “No” entre los criterios medidos; gris indica sin medición.</p></div>
       <div className="chart-scroll"><div className="chapter-detail-chart">
        <ResponsiveContainer width="100%" height={260}>
         <BarChart data={chapterItems} margin={{top:10,right:12,left:-16,bottom:4}}>
          <CartesianGrid vertical={false} stroke="#e3ebeb"/>
          <XAxis dataKey="id" tickLine={false} axisLine={false}/>
          <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={value=>`${value}%`}/>
          <Tooltip formatter={(value,_name,entry)=>[entry.payload.applicable&&typeof value==='number'?`${value}%`:'Sin medición','Respuestas “No”']} labelFormatter={label=>`Subcapítulo ${label}`}/>
          <Bar dataKey="rate" name="Respuestas “No”" isAnimationActive={false} shape={props=>{
           const measured=chapterItems[props.originalDataIndex]?.applicable;
           return <Rectangle x={props.x} y={measured?props.y:props.y-2} width={props.width} height={measured?props.height:4} radius={[4,4,0,0]} fill={measured?'#f2a900':'#9ba7aa'}/>;
          }}/>
         </BarChart>
        </ResponsiveContainer>
       </div></div>
      </div>
      <div className="table-scroll">
       <table className="followup-table metric-table"><thead><tr><th>Subcapítulo</th><th>Aspecto evaluado</th><th>Criterios aplicables</th><th>Hallazgos</th><th>Frecuencia</th><th>Fincas</th></tr></thead>
        <tbody>{chapterItems.map(item=><tr key={item.id}><td><strong>{item.id}</strong></td><td>{item.text}</td><td>{item.applicable||'Sin medición'}</td><td>{item.applicable?item.findings:'—'}</td><td>{item.applicable?`${item.rate}%`:'Sin medición'}</td><td>{item.applicable?item.farms:'—'}</td></tr>)}</tbody>
       </table>
      </div>
     </>:<p className="metric-clear">Sin mediciones de subcapítulos en el periodo seleccionado.</p>}
    </div>
   </details>;
  })}
 </div>;
}
