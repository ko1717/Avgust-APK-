'use client';
import {useMemo,useState} from 'react';
import {
  FileDown,
  FileSpreadsheet,
  Layers,
  Printer,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {catalog,metricStatusLabels,metricTrendLabels,type MetricStatus,type Visit} from '@/lib/model';
import {AVGUST_COMPLIANCE_TARGET} from './metric-display';
import {compareFarmBenchmarks,consolidatedMetricAnalysis} from '@/lib/metric-analysis';
import {exportConsolidatedMatrixExcel} from '@/lib/export-matrix-excel';
import {exportConsolidatedMatrixCsv} from '@/lib/export-matrix-csv';
import {exportConsolidatedWord} from '@/lib/export-consolidated-word';
import ImportMatrix from './import-matrix';
import {ConsolidatedChapterDetails} from './metric-chapter-details';
import {KpiSparkline,type SparklinePoint} from './kpi-sparkline';
import './b2b-metrics.css';

function StatusBadge({value}:{value:MetricStatus}){
  const labels:Record<MetricStatus,string>={
    healthy:'Saludable',
    acceptable:'Aceptable',
    critical:'Crítico',
    pending:'Sin evaluar'
  };
  return <span className={`b2b-kpi-badge ${value}`}>{labels[value] || metricStatusLabels[value]}</span>;
}

const monthLabel=(period:string)=>new Intl.DateTimeFormat('es-CO',{month:'short',year:'numeric'}).format(new Date(`${period}-01T12:00:00`));

export default function ConsolidatedMetrics({visits,loading,onImport}:{visits:Visit[];loading:boolean;onImport:(visits:Visit[])=>Promise<void>}){
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [month,setMonth]=useState('');
  
  const scoped=useMemo(()=>visits.filter(v=>(!from||v.date>=`${from}-01-01`)&&(!to||v.date<=`${to}-12-31`)&&(!month||v.date.startsWith(month))),[visits,from,to,month]);
  const data=useMemo(()=>consolidatedMetricAnalysis(scoped),[scoped]);
  const benchmark=useMemo(()=>compareFarmBenchmarks(scoped),[scoped]);
  
  const chart=data.timeline.map(row=>({...row,label:monthLabel(row.period)}));
  const chapterChart=data.chapters.map(row=>({chapter:`Cap ${row.id}`,hallazgos:row.findings,title:row.title}));

  const scoreSparkline:SparklinePoint[]=useMemo(()=>data.timeline.map(t=>({
    date:t.period,
    label:monthLabel(t.period),
    value:t.score,
    formattedValue:`${t.score}% MIPE`
  })),[data.timeline]);

  const reportsSparkline:SparklinePoint[]=useMemo(()=>data.timeline.map(t=>({
    date:t.period,
    label:monthLabel(t.period),
    value:t.reports,
    formattedValue:`${t.reports} informes`
  })),[data.timeline]);

  const findingsSparkline:SparklinePoint[]=useMemo(()=>data.timeline.map(t=>({
    date:t.period,
    label:monthLabel(t.period),
    value:t.findings,
    formattedValue:`${t.findings} hallazgos`
  })),[data.timeline]);

  return (
    <div className="b2b-metrics-wrapper" aria-labelledby="consolidated-title">
      {/* Brand & Print Header */}
      <div className="metrics-print-brand hidden print:flex">
        <img src="/avgust-logo.svg" alt="Avgust Crop Protection" className="h-10"/>
        <div>
          <strong className="text-lg">AVGUST CARE 360 · Business Intelligence MIPE</strong>
          <span className="block text-xs text-slate-500">Informe Técnico Consolidado Multi-Finca</span>
        </div>
      </div>

      {/* Executive Command Header */}
      <div className="b2b-header no-print">
        <div className="b2b-header-title">
          <div className="b2b-kicker">Consolidado Corporativo · Multi-Finca</div>
          <h2 id="consolidated-title">Matriz Técnica de Aseguramientos</h2>
          <p>Análisis transversal de todas las fincas para identificar procesos críticos, patrones de no conformidad y desempeño relativo.</p>
        </div>
        {data.records.length>0 && (
          <div className="b2b-header-actions">
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>void exportConsolidatedWord(data,month||`${from||'Inicio'} a ${to||'hoy'}`)}>
              <FileSpreadsheet size={16}/> Informe Word
            </button>
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>void exportConsolidatedMatrixExcel(data)}>
              <FileSpreadsheet size={16}/> Matriz Excel
            </button>
            <button className="b2b-btn b2b-btn-secondary" onClick={()=>void exportConsolidatedMatrixCsv(data)}>
              <FileDown size={16}/> CSV
            </button>
            <button className="b2b-btn b2b-btn-primary" onClick={()=>window.print()}>
              <Printer size={16}/> Guardar PDF
            </button>
          </div>
        )}
      </div>

      {/* Filter & Selector Ribbon */}
      <div className="b2b-filter-card no-print">
        <div className="b2b-filter-group">
          <label className="b2b-filter-label">
            <span>Mes Específico</span>
            <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="b2b-input"/>
          </label>
          <label className="b2b-filter-label">
            <span>Año Desde</span>
            <input type="number" min="2020" max="2100" placeholder="2022" value={from} onChange={e=>setFrom(e.target.value)} className="b2b-input w-24"/>
          </label>
          <label className="b2b-filter-label">
            <span>Año Hasta</span>
            <input type="number" min="2020" max="2100" placeholder="2026" value={to} onChange={e=>setTo(e.target.value)} className="b2b-input w-24"/>
          </label>
        </div>

        <div>
          <ImportMatrix onImport={onImport}/>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Cargando consolidado multi-finca…</div>
      ) : !data.records.length ? (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-500">
          No hay aseguramientos revisados con criterios aplicables en el periodo seleccionado.
        </div>
      ) : (
        <>
          {/* Executive Multi-Farm KPI Grid with Recharts Trend Lines */}
          <div className="b2b-kpi-grid">
            <div className={`b2b-kpi-card ${data.status}`}>
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Índice Consolidado</span>
                <StatusBadge value={data.status}/>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{data.score}%</span>
              </div>
              <div className="mt-1 mb-2">
                <KpiSparkline data={scoreSparkline} color="#007fa3" fillGradientId="sparkConsolidatedScore" unit="%" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Promedio de conformidad de los criterios revisados. Meta AVGUST {AVGUST_COMPLIANCE_TARGET}%:
                {' '}{data.score===null?'sin medición':data.score>=AVGUST_COMPLIANCE_TARGET?'alcanzada':`faltan ${AVGUST_COMPLIANCE_TARGET-data.score} puntos porcentuales`}.
              </div>
              <div className="b2b-kpi-progress">
                <div className={`b2b-kpi-progress-fill ${data.status}`} style={{width:`${data.score||0}%`}}/>
              </div>
            </div>

            <div className="b2b-kpi-card highlight">
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Comportamiento Global</span>
                <span className="text-xs font-bold text-[#007fa3]">
                  {metricTrendLabels[data.trend]}
                </span>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">
                  {data.trend==='improved'?<TrendingUp size={24} className="text-emerald-600 inline mr-1"/>:data.trend==='declined'?<TrendingDown size={24} className="text-rose-600 inline mr-1"/>:null}
                  {metricTrendLabels[data.trend]}
                </span>
              </div>
              <div className="mt-1 mb-2">
                <KpiSparkline data={scoreSparkline} color={data.trend==='improved'?'#10b981':data.trend==='declined'?'#f43f5e':'#007fa3'} fillGradientId="sparkConsolidatedTrend" unit="%" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Comparación temporal entre el primer y último periodo registrado.
              </div>
            </div>

            <div className="b2b-kpi-card">
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Población de Fincas</span>
                <Users size={15} className="text-indigo-600"/>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{data.farms}</span>
                <span className="text-xs font-semibold text-slate-500">fincas auditadas</span>
              </div>
              <div className="mt-1 mb-2">
                <KpiSparkline data={reportsSparkline} color="#6366f1" fillGradientId="sparkConsolidatedFarms" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                {data.records.length} aseguramientos técnicos completados y revisados.
              </div>
            </div>

            <div className={`b2b-kpi-card ${data.findings>0?'critical':'healthy'}`}>
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Inconformidades Totales</span>
                <ShieldAlert size={15} className="text-rose-600"/>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value text-rose-600">{data.findings}</span>
                <span className="text-xs font-semibold text-slate-500">en {data.applicable} criterios</span>
              </div>
              <div className="mt-1 mb-2">
                <KpiSparkline data={findingsSparkline} color={data.findings>0?'#e11d48':'#10b981'} fillGradientId="sparkConsolidatedFindings" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Tasa global de hallazgos: {data.applicable ? Math.round((data.findings/data.applicable)*100) : 0}% de los criterios evaluados.
              </div>
            </div>

            <div className="b2b-kpi-card">
              <div className="b2b-kpi-header">
                <span className="b2b-kpi-title">Aseguramientos</span>
                <Layers size={15} className="text-[#007fa3]"/>
              </div>
              <div className="b2b-kpi-body">
                <span className="b2b-kpi-value">{data.records.length}</span>
                <span className="text-xs font-semibold text-slate-500">visitas / 5 caps</span>
              </div>
              <div className="mt-1 mb-2">
                <KpiSparkline data={reportsSparkline} color="#007fa3" fillGradientId="sparkConsolidatedVisits" height={38}/>
              </div>
              <div className="b2b-kpi-footer">
                Almacén, Dosificación, Transporte, Mezclas y Aplicación.
              </div>
            </div>
          </div>

          {/* Benchmark / Ranking Comparison */}
          <div className="b2b-card-block">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="b2b-kicker">Clasificación Comparativa Homogénea</div>
                <h3>Benchmark de Desempeño entre Fincas con Igual Alcance</h3>
                <p className="sub">Compara la auditoría revisada más reciente de cada finca dentro del periodo. Solo se agrupan fincas con idénticos capítulos evaluados para garantizar rigor estadístico y equidad.</p>
              </div>
            </div>

            {benchmark.groups.length ? (
              <div className="grid gap-4 mt-3">
                {benchmark.groups.map(group=>{
                  const scope=group.chapterIds.map(id=>catalog.find(chapter=>chapter.id===id)?.title||`Capítulo ${id}`).join(' · ');
                  return (
                    <div key={group.chapterIds.join('-')} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Trophy size={16} className="text-amber-500"/>
                        <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Alcance Evaluado: {scope}</span>
                      </div>

                      <div className="b2b-table-container">
                        <table className="b2b-table">
                          <thead>
                            <tr>
                              <th style={{width:'90px'}}>Posición</th>
                              <th>Finca</th>
                              <th>Último Informe</th>
                              <th>Índice Oficial MIPE</th>
                              <th>Hallazgos Abiertos</th>
                              <th>Criterios Evaluados</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.records.map(record=>(
                              <tr key={record.farm}>
                                <td>
                                  <span className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded text-xs ${record.rank===1?'bg-amber-100 text-amber-800 border border-amber-300':record.rank===2?'bg-slate-200 text-slate-800':'bg-slate-100 text-slate-600'}`}>
                                    {record.tied ? `Empate #${record.rank}` : `#${record.rank}`}
                                  </span>
                                </td>
                                <td><strong className="text-slate-900">{record.farm}</strong></td>
                                <td><span className="text-slate-600">{record.date}</span></td>
                                <td><strong className="text-[#007fa3] text-sm">{record.score}%</strong></td>
                                <td><span className={`font-bold ${record.findings>0?'text-rose-600':'text-emerald-600'}`}>{record.findings}</span></td>
                                <td><span className="text-slate-600">{record.applicable}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs">
                Aún no hay dos fincas con informes revisados de alcance idéntico en este periodo.
              </div>
            )}

            {benchmark.singleScopes.length>0 && (
              <details className="mt-3 p-3 bg-slate-100 rounded-lg text-xs text-slate-600">
                <summary className="font-semibold cursor-pointer">{benchmark.singleScopes.length} finca{benchmark.singleScopes.length===1?'':'s'} con alcance particular sin pares directos</summary>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  {benchmark.singleScopes.map(item=>(
                    <li key={item.farm}><strong>{item.farm}</strong> · {item.date} ({item.chapterIds.length?item.chapterIds.map(id=>`Cap. ${id}`).join(', '):'sin capítulos'})</li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* Charts Row: Timeline & Findings by Chapter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="b2b-chart-card">
              <div className="b2b-chart-header">
                <div>
                  <h3>Evolución Mensual Consolidada</h3>
                  <p>Promedio ponderado mensual de la flota de fincas.</p>
                </div>
              </div>
              <div className="w-full overflow-x-auto">
                <div style={{minWidth:Math.max(400,chart.length*60)}}>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chart} margin={{top:15,right:20,left:-15,bottom:4}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/>
                      <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} tick={{fontSize:11,fill:'#64748b'}}/>
                      <Tooltip formatter={value=>[`${value}%`,'Índice Promedio']}/>
                      <ReferenceLine y={AVGUST_COMPLIANCE_TARGET} stroke="#78be20" strokeDasharray="5 4" label={{value:`Meta AVGUST ${AVGUST_COMPLIANCE_TARGET}%`,fill:'#4b7413',fontSize:10,position:'insideTopRight'}}/>
                      <Line type="monotone" dataKey="score" name="Índice" stroke="#007fa3" strokeWidth={3} dot={{r:5,fill:'#007fa3'}} activeDot={{r:7}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="b2b-chart-card">
              <div className="b2b-chart-header">
                <div>
                  <h3>Concentración de Hallazgos por Proceso</h3>
                  <p>Número total de incumplimientos por capítulo MIPE.</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chapterChart} margin={{top:15,right:12,left:-20,bottom:4}}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3"/>
                  <XAxis dataKey="chapter" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/>
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/>
                  <Tooltip formatter={(value,_name,item)=>[value,`Hallazgos en ${item.payload.title}`]}/>
                  <Bar dataKey="hallazgos" name="Hallazgos" fill="#f59e0b" radius={[6,6,0,0]} isAnimationActive={false}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pareto / Top Inconvenientes */}
          <div className="b2b-card-block">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="b2b-kicker">Priorización de Intervención</div>
                <h3>Criterios con Mayor Frecuencia de No Conformidad</h3>
                <p className="sub">Listado ordenado por respuestas “No”. Abre la evidencia para ver la finca, fecha, observación y recomendación registradas. La meta es ≥{AVGUST_COMPLIANCE_TARGET}% de conformidad.</p>
              </div>
            </div>

            <div className="b2b-table-container">
              <table className="b2b-table">
                <thead>
                  <tr>
                    <th>Capítulo</th>
                    <th style={{width:'80px'}}>Código</th>
                    <th>Criterio Técnico / Inconveniente</th>
                    <th>Hallazgos Totales</th>
                    <th>Frecuencia Relativa</th>
                    <th>Fincas Afectadas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.filter(item=>item.findings>0).slice(0,12).map(item=>(
                    <tr key={item.id}>
                      <td><span className="font-semibold text-slate-700">Cap. {item.chapter} · {item.chapterTitle}</span></td>
                      <td><strong className="text-slate-900">{item.id}</strong></td>
                      <td>
                        <span className="text-slate-700 text-xs">{item.text}</span>
                        {item.findings>0 && (
                          <details className="b2b-finding-evidence">
                            <summary>Ver {item.findings} registro{item.findings===1?'':'s'} con “No”</summary>
                            <ul className="b2b-evidence-list">
                              {data.matrix.filter(row=>row.item===item.id&&row.answer==='No').map((row,index)=>(
                                <li key={`${row.farm}-${row.date}-${index}`}>
                                  <strong>{row.farm}</strong><span>{row.date} · {row.responsible||'Responsable sin registrar'}</span>
                                  <p><b>Observación:</b> {row.observation||'No registrada.'}</p>
                                  <p><b>Recomendación:</b> {row.recommendation||'No registrada.'}</p>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                      <td><strong className="text-rose-600 text-sm">{item.findings}</strong></td>
                      <td>
                        {item.applicable ? (
                          <>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${(item.applicable-item.findings)/item.applicable*100<AVGUST_COMPLIANCE_TARGET?'b2b-target-badge below':'b2b-target-badge met'}`}>
                              {item.rate}%
                            </span>
                            <small className={`b2b-target-status ${(item.applicable-item.findings)/item.applicable*100>=AVGUST_COMPLIANCE_TARGET?'met':'below'}`}>
                              {(item.applicable-item.findings)/item.applicable*100>=AVGUST_COMPLIANCE_TARGET?`Meta ${AVGUST_COMPLIANCE_TARGET}% alcanzada`:`Bajo meta ${AVGUST_COMPLIANCE_TARGET}%`}
                            </small>
                          </>
                        ) : (
                          <span className="b2b-target-status">Sin medición</span>
                        )}
                      </td>
                      <td><span className="font-bold text-slate-800">{item.farms}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.some(item=>item.findings>0) && (
              <div className="p-6 text-center text-emerald-800 text-xs">No hay hallazgos registrados en el periodo.</div>
            )}
          </div>

          {/* Consolidated Chapter Deep Dive */}
          <div className="b2b-card-block">
            <div className="mb-2">
              <h3>Estado y Auditoría por Capítulo Normativo</h3>
              <p className="sub">Desglose exhaustivo de los 37 criterios oficiales por proceso.</p>
            </div>
            <ConsolidatedChapterDetails chapters={data.chapters} items={data.items}/>
          </div>
        </>
      )}
    </div>
  );
}
