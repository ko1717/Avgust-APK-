'use client';
import {useState} from 'react';
import {
  Info,
  Layers,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {metricStatusLabels,type MetricStatus} from '@/lib/model';
import type {ChapterMetricDetail,ConsolidatedMetricAnalysis} from '@/lib/metric-analysis';

function Status({value}:{value:MetricStatus}){
  const labels:Record<MetricStatus,string>={
    healthy:'Saludable',
    acceptable:'Alerta',
    critical:'Vulnerable',
    pending:'Sin evaluar'
  };
  return <span className={`b2b-kpi-badge ${value}`}>{labels[value] || metricStatusLabels[value]}</span>;
}

function answerChip(value:string|null){
  if(value==='SI') return <span className="audit-chip healthy" title="Conforme">✓ Sí</span>;
  if(value==='NO') return <span className="audit-chip critical" title="Hallazgo">✕ No</span>;
  if(value==='NA') return <span className="audit-chip na" title="No aplica">— NA</span>;
  return <span className="audit-chip pending" title="Sin evaluar">·</span>;
}

function shortDate(dateStr:string){
  if(!dateStr) return '';
  const parts=dateStr.split('-');
  if(parts.length===3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
}

function FarmChapterCard({chapter}:{chapter:ChapterMetricDetail}){
  const [showOnlyEvaluatedSub,setShowOnlyEvaluatedSub]=useState(true);
  
  const isEvaluated=chapter.score!==null || chapter.applicable>0;
  
  // Extract all visits from evolution or items
  const visits = chapter.visitEvolution && chapter.visitEvolution.length > 0
    ? chapter.visitEvolution
    : (chapter.items[0]?.allVisits?.map(v => ({
        date: v.date,
        visitId: v.visitId,
        score: v.score,
        pointsEarned: 0,
        findings: 0,
        applicable: 0,
        status: 'pending' as MetricStatus
      })) || []);

  const [chartMode,setChartMode]=useState<'trend'|'subcriteria'|'compare2'>(
    visits.length > 1 ? 'trend' : 'subcriteria'
  );
  const [visitIndexA,setVisitIndexA]=useState<number>(0);
  const [visitIndexB,setVisitIndexB]=useState<number>(Math.max(0, visits.length - 1));

  const evaluatedItems=chapter.items.filter(item=>
    item.allVisits && item.allVisits.length
      ? item.allVisits.some(v=>v.answer==='SI'||v.answer==='NO')
      : item.latestAnswer==='SI'||item.latestAnswer==='NO'
  );
  const naItems=chapter.items.filter(item=>
    item.allVisits && item.allVisits.length
      ? item.allVisits.every(v=>v.answer==='NA'||!v.answer) && item.allVisits.some(v=>v.answer==='NA')
      : item.latestAnswer==='NA'
  );
  
  const displayItems=(showOnlyEvaluatedSub && evaluatedItems.length>0)?evaluatedItems:chapter.items;

  // 1. Data for Trend Mode (AreaChart over all visits)
  const trendData = visits.map((v, idx) => ({
    visitName: `V${idx+1}`,
    fullLabel: `V${idx+1} (${v.date})`,
    date: v.date,
    score: v.score ?? 0,
    hasScore: v.score !== null,
    points: v.pointsEarned,
    findings: v.findings,
    applicable: v.applicable
  }));

  // 2. Data for Subcriteria Compliance Rate (Single bar per subcriterion)
  const subcriteriaData = displayItems.map(item => {
    const applicableVisits = visits.filter(v => {
      const a = item.allVisits?.find(av => av.date === v.date || av.visitId === v.visitId)?.answer;
      return a === 'SI' || a === 'NO';
    });
    const siVisits = visits.filter(v => {
      const a = item.allVisits?.find(av => av.date === v.date || av.visitId === v.visitId)?.answer;
      return a === 'SI';
    });
    const complianceRate = applicableVisits.length > 0
      ? Math.round((siVisits.length / applicableVisits.length) * 100)
      : (item.latestAnswer === 'SI' ? 100 : item.latestAnswer === 'NO' ? 0 : 100);

    return {
      id: item.id,
      text: item.text,
      complianceRate,
      siCount: siVisits.length,
      applicableCount: applicableVisits.length,
      findingsCount: applicableVisits.length - siVisits.length
    };
  });

  // 3. Data for 2-visit comparison
  const visitA = visits[visitIndexA] || visits[0];
  const visitB = visits[visitIndexB] || visits[visits.length - 1];
  const compare2Data = displayItems.map(item => {
    const ansA = item.allVisits?.find(av => av.date === visitA?.date || av.visitId === visitA?.visitId);
    const ansB = item.allVisits?.find(av => av.date === visitB?.date || av.visitId === visitB?.visitId);
    return {
      id: item.id,
      text: item.text,
      scoreA: ansA ? ansA.score : (item.firstScore ?? 0),
      scoreB: ansB ? ansB.score : (item.latestScore ?? 0)
    };
  });

  return (
    <details className={`b2b-process-card ${!isEvaluated?'opacity-85 border-dashed border-slate-300':''}`} key={chapter.id}>
      <summary className="b2b-process-summary">
        <div className="b2b-process-info">
          <div className="b2b-process-title">
            <span>{chapter.id}. {chapter.title}</span>
            <span className="b2b-process-weight-tag">{chapter.weightPct}% ({chapter.maxPoints} pts máx)</span>
            {!isEvaluated && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                No evaluado en esta visita
              </span>
            )}
          </div>
          <div className="b2b-process-subtitle">
            {isEvaluated ? (
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                <strong className="text-slate-800">{chapter.pointsEarned} / {chapter.maxPoints} pts ganados ·</strong>
                <span>{chapter.findings} hallazgo{chapter.findings===1?'':'s'} en {chapter.applicable} criterios</span>
                <span className="text-slate-300">|</span>
                {visits.length > 1 ? (
                  <span className="inline-flex items-center flex-wrap gap-1 text-[11px]">
                    <strong className="text-slate-700">Evolución en {visits.length} visitas:</strong>
                    {visits.map((v, i) => {
                      const sc = v.score;
                      const badgeCls = sc === null
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : sc >= 95
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                          : sc >= 80
                            ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                            : 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
                      return (
                        <span key={v.visitId || i} className="inline-flex items-center gap-0.5">
                          {i > 0 && <span className="text-slate-400 font-bold">→</span>}
                          <span className={`px-1.5 py-0.2 rounded border text-[10px] ${badgeCls}`} title={`Visita ${i+1} (${v.date})`}>
                            V{i+1}: {sc === null ? '—' : `${sc}%`}
                          </span>
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  <span>Visita única ({visits[0]?.date || 'actual'}): {chapter.score === null ? 'sin medición' : `${chapter.score}%`}</span>
                )}
              </div>
            ) : (
              <span className="text-slate-500 italic">
                Capítulo excluido de esta auditoría · 0 pts asignados de {chapter.maxPoints} pts posibles
              </span>
            )}
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
        {isEvaluated ? (
          <>
            {/* Multi-Visit Executive Analysis Container */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              {/* Header with Mode Tabs and Filters */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 m-0 flex items-center gap-1.5">
                    <TrendingUp size={15} className="text-[#007fa3]"/>
                    <span>Análisis Histórico de Visitas · Capítulo {chapter.id}</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {evaluatedItems.length} criterios evaluados · {naItems.length} no aplican · {visits.length} visita{visits.length === 1 ? '' : 's'} registradas
                  </span>
                </div>
                
                {/* View Mode Selector */}
                <div className="flex items-center flex-wrap gap-2">
                  {visits.length > 1 && (
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                      <button
                        type="button"
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${chartMode === 'trend' ? 'bg-[#007fa3] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                        onClick={()=>setChartMode('trend')}
                        title="Ver línea de evolución del capítulo a través de todas las visitas"
                      >
                        <TrendingUp size={12}/>
                        <span>Evolución Temporal</span>
                      </button>
                      <button
                        type="button"
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${chartMode === 'subcriteria' ? 'bg-[#007fa3] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                        onClick={()=>setChartMode('subcriteria')}
                        title="Ver porcentaje de cumplimiento global por cada subcriterio"
                      >
                        <BarChart3 size={12}/>
                        <span>Tasa por Subcriterio</span>
                      </button>
                      <button
                        type="button"
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${chartMode === 'compare2' ? 'bg-[#007fa3] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                        onClick={()=>setChartMode('compare2')}
                        title="Comparar 2 visitas puntuales lado a lado"
                      >
                        <GitCompare size={12}/>
                        <span>Contrastar 2 Visitas</span>
                      </button>
                    </div>
                  )}

                  {/* Filter Evaluated / All */}
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${showOnlyEvaluatedSub ? 'bg-white text-[#007fa3] shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                      onClick={()=>setShowOnlyEvaluatedSub(true)}
                    >
                      Evaluados ({evaluatedItems.length})
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${!showOnlyEvaluatedSub ? 'bg-white text-[#007fa3] shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                      onClick={()=>setShowOnlyEvaluatedSub(false)}
                    >
                      Todos ({chapter.items.length})
                    </button>
                  </div>
                </div>
              </div>

              {naItems.length > 0 && (
                <div className="my-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-center gap-2">
                  <span className="font-semibold text-slate-700">No aplican en esta finca:</span>
                  <span>{naItems.map(i=>`${i.id}`).join(', ')}</span>
                  <span className="text-slate-400 italic">(Excluidos formalmente del denominador)</span>
                </div>
              )}

              {/* CHART AREA 1: Trend Mode (Smooth Evolution AreaChart across all visits) */}
              {chartMode === 'trend' && visits.length > 1 && (
                <div className="py-2">
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span className="text-slate-600 font-semibold">
                      Comportamiento del proceso a lo largo de las {visits.length} visitas realizadas:
                    </span>
                    <div className="flex items-center gap-3 text-[11px] font-medium">
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <span className="w-2.5 h-0.5 bg-emerald-600 inline-block"/> Meta Saludable ≥ 95%
                      </span>
                      <span className="flex items-center gap-1 text-amber-700 font-semibold">
                        <span className="w-2.5 h-0.5 bg-amber-500 inline-block"/> Alerta ≥ 80%
                      </span>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trendData} margin={{top:12,right:16,left:-15,bottom:4}}>
                      <defs>
                        <linearGradient id="chapterGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#007fa3" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#007fa3" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3"/>
                      <XAxis dataKey="visitName" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#475569'}}/>
                      <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} tick={{fontSize:11,fill:'#64748b'}}/>
                      <ReferenceLine y={95} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5}/>
                      <ReferenceLine y={80} stroke="#d97706" strokeDasharray="4 4" strokeWidth={1.5}/>
                      <Tooltip
                        content={({active,payload})=>{
                          if(!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-lg border border-slate-700">
                              <div className="font-bold text-white mb-1">{d.fullLabel}</div>
                              <div className="text-emerald-400 font-extrabold text-sm mb-1">{d.score}% de cumplimiento</div>
                              <div className="text-slate-300 text-[11px]">{d.applicable} criterios aplicables · {d.findings} hallazgo(s)</div>
                              <div className="text-slate-400 text-[10px] mt-0.5">{d.points} puntos aportados</div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#007fa3"
                        strokeWidth={2.5}
                        fill="url(#chapterGradient)"
                        dot={{r:4,fill:'#007fa3',stroke:'#ffffff',strokeWidth:2}}
                        activeDot={{r:6,fill:'#78be20',stroke:'#ffffff',strokeWidth:2}}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Evolution Strip below Chart */}
                  <div className="flex items-center justify-between flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500 font-medium">Secuencia cronológica:</span>
                    <div className="flex items-center flex-wrap gap-1">
                      {visits.map((v, i) => {
                        const sc = v.score ?? 0;
                        const chipColor = sc >= 95 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : sc >= 80 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-rose-700 bg-rose-50 border-rose-200';
                        return (
                          <span key={v.visitId || i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${chipColor}`}>
                            <span>V{i+1} ({shortDate(v.date)}):</span>
                            <strong>{v.score === null ? '—' : `${v.score}%`}</strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* CHART AREA 2: Subcriteria Compliance Rate (1 clean bar per subcriterion) */}
              {chartMode === 'subcriteria' && (
                <div className="py-2">
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span className="text-slate-600 font-semibold">
                      Tasa de conformidad histórica por subcriterio (% de visitas con resultado "Sí"):
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#16a34a]"/> ≥ 95%
                      <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#f59e0b]"/> 80-94%
                      <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#e11d48]"/> &lt; 80%
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={subcriteriaData} margin={{top:10,right:12,left:-15,bottom:4}}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3"/>
                      <XAxis dataKey="id" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#475569'}}/>
                      <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} tick={{fontSize:11,fill:'#64748b'}}/>
                      <Tooltip
                        content={({active,payload})=>{
                          if(!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-lg max-w-xs border border-slate-700">
                              <div className="font-bold text-white mb-0.5">Criterio {d.id}</div>
                              <div className="text-slate-300 text-[11px] mb-1 line-clamp-2">{d.text}</div>
                              <div className="text-emerald-400 font-extrabold text-sm">{d.complianceRate}% Conforme</div>
                              <div className="text-slate-400 text-[10px] mt-0.5">
                                {d.siCount} de {d.applicableCount} visitas conformes · {d.findingsCount} hallazgo(s)
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="complianceRate" radius={[4,4,0,0]} barSize={24} isAnimationActive={false}>
                        {subcriteriaData.map(entry => {
                          const rate = entry.complianceRate;
                          const fill = rate >= 95 ? '#16a34a' : rate  >= 80 ? '#f59e0b' : '#e11d48';
                          return <Cell key={`cell-${entry.id}`} fill={fill}/>;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* CHART AREA 3: Contrast 2 Visits Side by Side */}
              {chartMode === 'compare2' && (
                <div className="py-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">Visita A (Base):</span>
                      <select
                        aria-label="Seleccionar Visita A de referencia"
                        className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-medium text-slate-800"
                        value={visitIndexA}
                        onChange={e=>setVisitIndexA(Number(e.target.value))}
                      >
                        {visits.map((v, idx) => (
                          <option key={idx} value={idx}>V{idx+1} ({v.date}) - {v.score === null ? '—' : `${v.score}%`}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">Visita B (Contraste):</span>
                      <select
                        aria-label="Seleccionar Visita B de contraste"
                        className="text-xs bg-white border border-slate-300 rounded px-2 py-1 font-medium text-slate-800"
                        value={visitIndexB}
                        onChange={e=>setVisitIndexB(Number(e.target.value))}
                      >
                        {visits.map((v, idx) => (
                          <option key={idx} value={idx}>V{idx+1} ({v.date}) - {v.score === null ? '—' : `${v.score}%`}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={compare2Data} margin={{top:10,right:12,left:-15,bottom:4}}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3"/>
                      <XAxis dataKey="id" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#475569'}}/>
                      <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} tick={{fontSize:11,fill:'#64748b'}}/>
                      <Tooltip formatter={(value, name)=>[typeof value === 'number' ? `${value}%` : '—', String(name)]}/>
                      <Legend wrapperStyle={{fontSize:'12px'}}/>
                      <Bar dataKey="scoreA" name={`V${visitIndexA+1} (${visitA?.date || ''})`} fill="#007fa3" radius={[3,3,0,0]} barSize={14} isAnimationActive={false}/>
                      <Bar dataKey="scoreB" name={`V${visitIndexB+1} (${visitB?.date || ''})`} fill="#78be20" radius={[3,3,0,0]} barSize={14} isAnimationActive={false}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* High-Contrast Clean Audit Matrix Table */}
            <div className="audit-table-wrap">
              <table className="audit-matrix">
                <thead>
                  <tr>
                    <th style={{width:'55px'}}>Cód.</th>
                    <th style={{minWidth:'260px'}}>Criterio Técnico MIPE</th>
                    {visits.length > 1 ? (
                      visits.map((v, idx) => (
                        <th key={v.visitId || idx} style={{width:'68px',textAlign:'center'}}>
                          <div className="font-bold text-slate-800">V{idx+1}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{shortDate(v.date)}</div>
                        </th>
                      ))
                    ) : (
                      <>
                        <th style={{width:'110px',textAlign:'center'}}>Primera Visita</th>
                        <th style={{width:'110px',textAlign:'center'}}>Última Visita</th>
                      </>
                    )}
                    <th style={{width:'130px',textAlign:'center'}}>Conformidad Histórica</th>
                    <th style={{width:'110px',textAlign:'center'}}>Diagnóstico</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map(item=>{
                    const firstV = item.allVisits?.[0];
                    const lastV = item.allVisits?.at(-1);
                    const improved = firstV?.answer === 'NO' && lastV?.answer === 'SI';
                    const worsened = firstV?.answer === 'SI' && lastV?.answer === 'NO';
                    
                    const applicableVisits = visits.filter(v => {
                      const a = item.allVisits?.find(av => av.date === v.date || av.visitId === v.visitId)?.answer;
                      return a === 'SI' || a === 'NO';
                    });
                    const siVisits = visits.filter(v => {
                      const a = item.allVisits?.find(av => av.date === v.date || av.visitId === v.visitId)?.answer;
                      return a === 'SI';
                    });
                    const allSi = applicableVisits.length > 0 && applicableVisits.length === siVisits.length;
                    const allNo = applicableVisits.length > 0 && siVisits.length === 0;

                    const compliancePct = applicableVisits.length > 0
                      ? Math.round((siVisits.length / applicableVisits.length) * 100)
                      : (item.latestAnswer === 'SI' ? 100 : item.latestAnswer === 'NO' ? 0 : null);

                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {item.id}
                          </span>
                        </td>
                        <td>
                          <span className="text-slate-800 text-xs leading-normal font-medium">
                            {item.text}
                          </span>
                        </td>

                        {visits.length > 1 ? (
                          visits.map((v, idx) => {
                            const vAns = item.allVisits?.find(av => av.date === v.date || av.visitId === v.visitId);
                            return (
                              <td key={v.visitId || idx} style={{textAlign:'center'}}>
                                {answerChip(vAns ? vAns.answer : null)}
                              </td>
                            );
                          })
                        ) : (
                          <>
                            <td style={{textAlign:'center'}}>{answerChip(item.firstAnswer)}</td>
                            <td style={{textAlign:'center'}}>{answerChip(item.latestAnswer)}</td>
                          </>
                        )}

                        {/* Historical compliance rate & mini-progress */}
                        <td style={{textAlign:'center'}}>
                          {compliancePct !== null ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className="text-[11px] font-bold text-slate-700">
                                {siVisits.length}/{applicableVisits.length} ({compliancePct}%)
                              </span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full ${compliancePct >= 95 ? 'bg-emerald-500' : compliancePct  >= 80 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{width:`${compliancePct}%`}}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No aplica</span>
                          )}
                        </td>

                        {/* Trajectory Diagnosis */}
                        <td style={{textAlign:'center'}}>
                          {improved ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded">
                              ✓ Subsanado
                            </span>
                          ) : worsened ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded">
                              ⚠ Retroceso
                            </span>
                          ) : allSi ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              ✓ Consistente
                            </span>
                          ) : allNo ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                              ⚠ Recurrente
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Variable</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="p-6 text-center bg-white border border-slate-200 rounded-lg">
            <Info size={24} className="mx-auto text-slate-400 mb-2"/>
            <strong className="block text-slate-800 text-sm mb-1">Capítulo no evaluado en esta visita</strong>
            <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
              Los {chapter.items.length} criterios de este capítulo no fueron seleccionados para la auditoría técnica. Para evaluarlos, selecciona el capítulo en la pestaña de datos de la visita.
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

export function FarmChapterDetails({chapters}:{chapters:ChapterMetricDetail[]}){
  const [showOnlyEvaluated,setShowOnlyEvaluated]=useState(true);

  const evaluatedChapters=chapters.filter(c=>c.score!==null || c.applicable>0);
  const unevaluatedChapters=chapters.filter(c=>c.score===null && c.applicable===0);

  const displayedChapters=(showOnlyEvaluated && evaluatedChapters.length>0)?evaluatedChapters:chapters;

  return (
    <div className="b2b-process-list">
      {/* Evidence & Scope Banner */}
      {unevaluatedChapters.length > 0 ? (
        <div className="p-4 bg-gradient-to-r from-sky-50 to-white border border-sky-200 rounded-xl mb-1 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-[#007fa3]"/>
              <strong className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                Alcance Técnico Evaluado: {evaluatedChapters.length} de {chapters.length} Capítulos ({Math.round(evaluatedChapters.length / chapters.length * 100)}%)
              </strong>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Visualización:</span>
              <div className="inline-flex rounded-lg border border-sky-300 bg-white p-0.5">
                <button
                  type="button"
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${showOnlyEvaluated ? 'bg-[#007fa3] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  onClick={()=>setShowOnlyEvaluated(true)}
                >
                  Solo evaluados ({evaluatedChapters.length})
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!showOnlyEvaluated ? 'bg-[#007fa3] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  onClick={()=>setShowOnlyEvaluated(false)}
                >
                  Ver todos los 5 ({chapters.length})
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-800">Capítulos no evaluados en esta visita:</span>{' '}
            <div className="inline-flex flex-wrap gap-1.5 mt-1">
              {unevaluatedChapters.map(c=>(
                <span key={c.id} className="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  Cap. {c.id} · {c.title}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500 italic">
              Metodología oficial AVGUST MIPE: Los capítulos excluidos no aportan puntos al numerador ni al denominador ponderado. La calificación representa el 100% de los procesos auditados.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-gradient-to-r from-emerald-50 to-white border border-emerald-200 rounded-xl mb-1 flex items-center gap-2 text-xs text-emerald-900 shadow-xs">
          <ShieldCheck size={18} className="text-[#78be20]"/>
          <span>
            <strong>Auditoría Integral Completa:</strong> Los 5 procesos normativos MIPE fueron evaluados en su totalidad (100% del alcance de evaluación).
          </span>
        </div>
      )}

      {/* Chapter Cards */}
      {displayedChapters.map(chapter=>(
        <FarmChapterCard chapter={chapter} key={chapter.id}/>
      ))}
    </div>
  );
}

type ConsolidatedChapter=ConsolidatedMetricAnalysis['chapters'][number];
type ConsolidatedItem=ConsolidatedMetricAnalysis['items'][number];

function ConsolidatedChapterCard({chapter,items}:{chapter:ConsolidatedChapter;items:ConsolidatedItem[]}){
  const [showOnlyEvaluatedSub,setShowOnlyEvaluatedSub]=useState(true);
  
  const isEvaluated=chapter.applicable>0;
  const chapterItems=items.filter(item=>item.chapter===chapter.id);
  const evaluatedItems=chapterItems.filter(item=>item.applicable>0);
  
  const displayItems=(showOnlyEvaluatedSub && evaluatedItems.length>0)?evaluatedItems:chapterItems;

  return (
    <details className={`b2b-process-card ${!isEvaluated?'opacity-85 border-dashed border-slate-300':''}`} key={chapter.id}>
      <summary className="b2b-process-summary">
        <div className="b2b-process-info">
          <div className="b2b-process-title">
            <span>{chapter.id}. {chapter.title}</span>
            {!isEvaluated && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                Sin evaluaciones en el periodo
              </span>
            )}
          </div>
          <div className="b2b-process-subtitle">
            {isEvaluated ? (
              <>
                <span>{chapter.findings} hallazgo{chapter.findings===1?'':'s'} acumulados en {chapter.applicable} criterios</span>
                <span className="mx-1 text-slate-300">·</span>
                <span>Evaluado en {chapter.farms} finca{chapter.farms===1?'':'s'}</span>
              </>
            ) : (
              <span className="text-slate-500 italic">
                Ninguna finca de la flota evaluó este capítulo en el periodo seleccionado
              </span>
            )}
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
        {isEvaluated && displayItems.length ? (
          <>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 m-0">
                    Frecuencia de Inconformidades por Subcriterio (Capítulo {chapter.id})
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">Porcentaje de respuestas “No” sobre criterios evaluados en la flota</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Mostrar:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${showOnlyEvaluatedSub ? 'bg-white text-[#007fa3] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                      onClick={()=>setShowOnlyEvaluatedSub(true)}
                    >
                      Solo evaluados ({evaluatedItems.length})
                    </button>
                    <button
                      type="button"
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${!showOnlyEvaluatedSub ? 'bg-white text-[#007fa3] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                      onClick={()=>setShowOnlyEvaluatedSub(false)}
                    >
                      Todos ({chapterItems.length})
                    </button>
                  </div>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <div style={{minWidth:Math.max(450,displayItems.length*55)}}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={displayItems} margin={{top:10,right:12,left:-20,bottom:4}}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3"/>
                      <XAxis dataKey="id" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/>
                      <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={value=>`${value}%`} tick={{fontSize:11,fill:'#64748b'}}/>
                      <Tooltip formatter={(value,_name,entry)=>[entry.payload.applicable&&typeof value==='number'?`${value}%`:'Sin medición','Frecuencia de Hallazgos (“No”)']} labelFormatter={label=>`Subcriterio ${label}`}/>
                      <Bar dataKey="rate" name="Respuestas “No”" isAnimationActive={false} shape={props=>{
                        const measured=displayItems[props.originalDataIndex]?.applicable;
                        return <Rectangle x={props.x} y={measured?props.y:props.y-2} width={props.width} height={measured?props.height:4} radius={[4,4,0,0]} fill={measured?'#f2a900':'#94a3b8'}/>;
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
                  {displayItems.map(item=>(
                    <tr key={item.id}>
                      <td><strong className="text-slate-900">{item.id}</strong></td>
                      <td><span className="text-slate-700 text-xs leading-relaxed">{item.text}</span></td>
                      <td><span className="font-semibold">{item.applicable||'Sin medición'}</span></td>
                      <td><strong className={item.findings>0?'text-[#dc2626] font-extrabold':'text-slate-500'}>{item.applicable?item.findings:'—'}</strong></td>
                      <td>
                        {item.applicable ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${item.rate>=50?'bg-rose-50 text-rose-700 border border-rose-200':item.rate>0?'bg-amber-50 text-amber-700 border border-amber-200':'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
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
          <div className="p-6 text-center bg-white border border-slate-200 rounded-lg">
            <Info size={24} className="mx-auto text-slate-400 mb-2"/>
            <strong className="block text-slate-800 text-sm mb-1">Sin mediciones en este capítulo</strong>
            <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
              Ninguna finca de la flota cuenta con aseguramientos registrados en este capítulo para el periodo seleccionado.
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

export function ConsolidatedChapterDetails({chapters,items}:{chapters:ConsolidatedChapter[];items:ConsolidatedItem[]}){
  const [showOnlyEvaluated,setShowOnlyEvaluated]=useState(true);

  const evaluatedChapters=chapters.filter(c=>c.applicable>0);
  const unevaluatedChapters=chapters.filter(c=>c.applicable===0);

  const displayedChapters=(showOnlyEvaluated && evaluatedChapters.length>0)?evaluatedChapters:chapters;

  return (
    <div className="b2b-process-list">
      {/* Evidence & Scope Banner */}
      {unevaluatedChapters.length > 0 ? (
        <div className="p-4 bg-gradient-to-r from-sky-50 to-white border border-sky-200 rounded-xl mb-1 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-[#007fa3]"/>
              <strong className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                Alcance Multi-Finca: {evaluatedChapters.length} de {chapters.length} Capítulos con Evaluaciones
              </strong>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Visualización:</span>
              <div className="inline-flex rounded-lg border border-sky-300 bg-white p-0.5">
                <button
                  type="button"
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${showOnlyEvaluated ? 'bg-[#007fa3] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  onClick={()=>setShowOnlyEvaluated(true)}
                >
                  Solo evaluados ({evaluatedChapters.length})
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!showOnlyEvaluated ? 'bg-[#007fa3] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  onClick={()=>setShowOnlyEvaluated(false)}
                >
                  Ver todos los 5 ({chapters.length})
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-800">Capítulos sin evaluaciones en la flota durante este periodo:</span>{' '}
            <div className="inline-flex flex-wrap gap-1.5 mt-1">
              {unevaluatedChapters.map(c=>(
                <span key={c.id} className="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  Cap. {c.id} · {c.title}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-gradient-to-r from-emerald-50 to-white border border-emerald-200 rounded-xl mb-1 flex items-center gap-2 text-xs text-emerald-900 shadow-xs">
          <ShieldCheck size={18} className="text-[#78be20]"/>
          <span>
            <strong>Cobertura Multi-Finca Completa:</strong> Todos los 5 procesos del catálogo oficial fueron auditados en al menos una finca durante el periodo.
          </span>
        </div>
      )}

      {/* Chapters list */}
      {displayedChapters.map(chapter=>(
        <ConsolidatedChapterCard chapter={chapter} items={items} key={chapter.id}/>
      ))}
    </div>
  );
}
