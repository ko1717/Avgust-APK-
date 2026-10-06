'use client';
import {Bar,BarChart,CartesianGrid,Legend,Rectangle,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {metricStatusLabels,type MetricStatus} from '@/lib/model';
import type {ChapterMetricDetail,ConsolidatedMetricAnalysis} from '@/lib/metric-analysis';

function Status({value}:{value:MetricStatus}){
  const labels:Record<MetricStatus,string>={
    healthy:'Saludable',
    acceptable:'Aceptable',
    critical:'Crítico',
    pending:'Sin evaluar'
  };
  return <span className={`b2b-kpi-badge ${value}`}>{labels[value] || metricStatusLabels[value]}</span>;
}

function answerLabel(value:string|null){
  if(value==='SI') return <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs">Sí (Conforme)</span>;
  if(value==='NO') return <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded text-xs">No (Hallazgo)</span>;
  if(value==='NA') return <span className="text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded text-xs">No aplica</span>;
  return <span className="text-slate-400 italic text-xs">Sin evaluar</span>;
}

export function FarmChapterDetails({chapters}:{chapters:ChapterMetricDetail[]}){
  return (
    <div className="b2b-process-list">
      {chapters.map(chapter=>(
        <details className="b2b-process-card" key={chapter.id}>
          <summary className="b2b-process-summary">
            <div className="b2b-process-info">
              <div className="b2b-process-title">
                <span>{chapter.id}. {chapter.title}</span>
                <span className="b2b-process-weight-tag">{chapter.weightPct}% ({chapter.maxPoints} pts máx)</span>
              </div>
              <div className="b2b-process-subtitle">
                {chapter.score!==null ? (
                  <strong className="text-slate-800 mr-1">{chapter.pointsEarned} / {chapter.maxPoints} pts ganados ·</strong>
                ) : null}
                <span>{chapter.findings} hallazgo{chapter.findings===1?'':'s'} en {chapter.applicable} criterios</span>
                <span className="mx-1 text-slate-300">|</span>
                <span>Primera visita: {chapter.firstScore===null?'sin medición':`${chapter.firstScore}%`}</span>
              </div>
            </div>

            <div className="b2b-process-score">
              <b>{chapter.score===null?'—':`${chapter.score}%`}</b>
              <small>{chapter.applicable ? `${chapter.applicable - chapter.findings}/${chapter.applicable} conformes` : 'Sin evaluación'}</small>
            </div>

            <div>
              <Status value={chapter.status}/>
            </div>
          </summary>

          <div className="p-4 bg-slate-50 border-t border-slate-200 grid gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 m-0">
                  Comparativa de Cumplimiento por Subcriterio (Capítulo {chapter.id})
                </h4>
                <span className="text-xs text-slate-500 font-medium">Primera Visita vs Última Visita</span>
              </div>

              <div className="w-full overflow-x-auto">
                <div style={{minWidth:Math.max(500,chapter.items.length*55)}}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chapter.items} margin={{top:10,right:12,left:-20,bottom:4}}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3"/>
                      <XAxis dataKey="id" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/>
                      <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={value=>`${value}%`} tick={{fontSize:11,fill:'#64748b'}}/>
                      <Tooltip formatter={(value,name)=>[typeof value==='number'?`${value}%`:'Sin evaluar',name==='firstScore'?'Primera visita':'Última visita']}/>
                      <Legend formatter={value=>value==='firstScore'?'Primera visita':'Última visita'} wrapperStyle={{fontSize:'12px'}}/>
                      <Bar dataKey="firstScore" name="firstScore" fill="#0284c7" radius={[4,4,0,0]} isAnimationActive={false}/>
                      <Bar dataKey="latestScore" name="latestScore" fill="#f59e0b" radius={[4,4,0,0]} isAnimationActive={false}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="b2b-table-container">
              <table className="b2b-table">
                <thead>
                  <tr>
                    <th style={{width:'80px'}}>Código</th>
                    <th>Aspecto Evaluado y Criterio Técnico</th>
                    <th style={{width:'150px'}}>Primera Visita</th>
                    <th style={{width:'150px'}}>Última Visita</th>
                  </tr>
                </thead>
                <tbody>
                  {chapter.items.map(item=>(
                    <tr key={item.id}>
                      <td><strong className="text-slate-900">{item.id}</strong></td>
                      <td><span className="text-slate-700 text-xs leading-relaxed">{item.text}</span></td>
                      <td>{answerLabel(item.firstAnswer)}</td>
                      <td>{answerLabel(item.latestAnswer)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

type ConsolidatedChapter=ConsolidatedMetricAnalysis['chapters'][number];
type ConsolidatedItem=ConsolidatedMetricAnalysis['items'][number];

export function ConsolidatedChapterDetails({chapters,items}:{chapters:ConsolidatedChapter[];items:ConsolidatedItem[]}){
  return (
    <div className="b2b-process-list">
      {chapters.map(chapter=>{
        const chapterItems=items.filter(item=>item.chapter===chapter.id);
        return (
          <details className="b2b-process-card" key={chapter.id}>
            <summary className="b2b-process-summary">
              <div className="b2b-process-info">
                <div className="b2b-process-title">
                  <span>{chapter.id}. {chapter.title}</span>
                </div>
                <div className="b2b-process-subtitle">
                  <span>{chapter.findings} hallazgo{chapter.findings===1?'':'s'} acumulados en {chapter.applicable} criterios</span>
                  <span className="mx-1 text-slate-300">·</span>
                  <span>Evaluado en {chapter.farms} finca{chapter.farms===1?'':'s'}</span>
                </div>
              </div>

              <div className="b2b-process-score">
                <b>{chapter.score===null?'—':`${chapter.score}%`}</b>
                <small>{chapter.applicable ? `${chapter.applicable - chapter.findings}/${chapter.applicable} conformes` : 'Sin evaluación'}</small>
              </div>

              <div>
                <Status value={chapter.status}/>
              </div>
            </summary>

            <div className="p-4 bg-slate-50 border-t border-slate-200 grid gap-4">
              {chapterItems.length ? (
                <>
                  <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 m-0">
                        Frecuencia de Inconformidades por Subcriterio (Capítulo {chapter.id})
                      </h4>
                      <span className="text-xs text-slate-500 font-medium">Porcentaje de respuestas “No” sobre criterios evaluados</span>
                    </div>

                    <div className="w-full overflow-x-auto">
                      <div style={{minWidth:Math.max(500,chapterItems.length*55)}}>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={chapterItems} margin={{top:10,right:12,left:-20,bottom:4}}>
                            <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3"/>
                            <XAxis dataKey="id" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/>
                            <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={value=>`${value}%`} tick={{fontSize:11,fill:'#64748b'}}/>
                            <Tooltip formatter={(value,_name,entry)=>[entry.payload.applicable&&typeof value==='number'?`${value}%`:'Sin medición','Frecuencia de Hallazgos (“No”)']} labelFormatter={label=>`Subcriterio ${label}`}/>
                            <Bar dataKey="rate" name="Respuestas “No”" isAnimationActive={false} shape={props=>{
                              const measured=chapterItems[props.originalDataIndex]?.applicable;
                              return <Rectangle x={props.x} y={measured?props.y:props.y-2} width={props.width} height={measured?props.height:4} radius={[4,4,0,0]} fill={measured?'#f59e0b':'#94a3b8'}/>;
                            }}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="b2b-table-container">
                    <table className="b2b-table">
                      <thead>
                        <tr>
                          <th style={{width:'80px'}}>Código</th>
                          <th>Criterio Técnico Normativo</th>
                          <th>Criterios Evaluados</th>
                          <th>Hallazgos (“No”)</th>
                          <th>Frecuencia Relativa</th>
                          <th>Fincas Afectadas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chapterItems.map(item=>(
                          <tr key={item.id}>
                            <td><strong className="text-slate-900">{item.id}</strong></td>
                            <td><span className="text-slate-700 text-xs leading-relaxed">{item.text}</span></td>
                            <td><span className="font-semibold">{item.applicable||'Sin medición'}</span></td>
                            <td><strong className={item.findings>0?'text-rose-600 font-extrabold':'text-slate-500'}>{item.applicable?item.findings:'—'}</strong></td>
                            <td>
                              {item.applicable ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${item.rate>=50?'bg-rose-50 text-rose-700':item.rate>0?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'}`}>
                                  {item.rate}%
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs italic">Sin medición</span>
                              )}
                            </td>
                            <td><span className="font-medium text-slate-700">{item.applicable?item.farms:'—'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs">Sin mediciones en este capítulo para el periodo seleccionado.</div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
