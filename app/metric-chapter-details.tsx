'use client';
import {useState} from 'react';
import {
  Info,
  Layers,
  ShieldCheck
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
  return <span className={`b2b-kpi-badge ${value}`}>{metricStatusLabels[value]}</span>;
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

function answerOnVisit(item:{allVisits?:{date:string;visitId:string;answer:string|null;score:number|null}[]},visit?:{date:string;visitId:string}){
  if(!visit) return undefined;
  return item.allVisits?.find(entry=>entry.visitId&&entry.visitId===visit.visitId)
    ?? item.allVisits?.find(entry=>entry.date===visit.date);
}

function CompareMark(props:{x?:number;y?:number;width?:number;height?:number;fill?:string;payload?:{scoreA:number|null;scoreB:number|null};dataKey?:string}){
  const {x=0,y=0,width=0,height=0,fill='#007fa3',payload,dataKey}=props;
  const value=dataKey==='scoreB'?payload?.scoreB:payload?.scoreA;
  if(value===null||value===undefined) return <g/>;
  if(value===0) return <Rectangle x={x} y={y-8} width={width} height={8} radius={[3,3,0,0]} fill="#dc2626"/>;
  return <Rectangle x={x} y={y} width={width} height={Math.max(height,0)} radius={[3,3,0,0]} fill={fill}/>;
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
    score: v.score,
    hasScore: v.score !== null,
    points: v.pointsEarned,
    findings: v.findings,
    applicable: v.applicable
  }));

  // 2. Data for Subcriteria Compliance Rate (Single bar per subcriterion)
  const subcriteriaData = displayItems.map(item => {
    const applicableVisits = visits.filter(v => {
      const a = answerOnVisit(item, v)?.answer;
      return a === 'SI' || a === 'NO';
    });
    const siVisits = visits.filter(v => {
      const a = answerOnVisit(item, v)?.answer;
      return a === 'SI';
    });
    const complianceRate = applicableVisits.length > 0
      ? Math.round((siVisits.length / applicableVisits.length) * 100)
      : null;

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
    const ansA = answerOnVisit(item, visitA);
    const ansB = answerOnVisit(item, visitB);
    return {
      id: item.id,
      text: item.text,
      scoreA: ansA?.score ?? null,
      scoreB: ansB?.score ?? null
    };
  });

  return (
    <details className={`b2b-process-card ${!isEvaluated?'opacity-85 border-dashed border-slate-300':''}`} key={chapter.id}>
      <summary className="b2b-process-summary">
        <div className="b2b-process-info">
          <div className="b2b-process-title">
            <span>{chapter.id}. {chapter.title}</span>
            <span className="b2b-process-weight-tag">{chapter.weightPct}%</span>
          </div>
          <div className="b2b-process-subtitle">
            {isEvaluated ? (
              <span>{chapter.pointsEarned}/{chapter.maxPoints} pts · {chapter.findings} hallazgo{chapter.findings===1?'':'s'} · {visits.length} visita{visits.length===1?'':'s'}</span>
            ) : (
              <span>No evaluado · 0 de {chapter.maxPoints} pts</span>
            )}
          </div>
        </div>

        <div className="b2b-process-score">
          <b>{chapter.score===null?'—':`${chapter.score}%`}</b>
          <small>{chapter.applicable ? `${chapter.applicable - chapter.findings}/${chapter.applicable} conformes` : 'Sin medición'}</small>
        </div>

        <div>
          <Status value={chapter.status}/>
        </div>
      </summary>

      <div className="p-4 bg-slate-50 border-t border-slate-200 grid gap-4">
        {isEvaluated ? (
          <>
            {/* Multi-Visit Executive Analysis Container */}
            <div className="chapter-detail-panel">
              <div className="chapter-detail-toolbar">
                <p>{evaluatedItems.length} criterios · {naItems.length} no aplican · {visits.length} visita{visits.length===1?'':'s'}</p>
                <div className="flex items-center flex-wrap gap-2">
                  {visits.length > 1 && (
                    <div className="b2b-quick-ranges">
                      <button type="button" className={`b2b-range-btn ${chartMode==='trend'?'active':''}`} onClick={()=>setChartMode('trend')}>Evolución</button>
                      <button type="button" className={`b2b-range-btn ${chartMode==='subcriteria'?'active':''}`} onClick={()=>setChartMode('subcriteria')}>Criterios</button>
                      <button type="button" className={`b2b-range-btn ${chartMode==='compare2'?'active':''}`} onClick={()=>setChartMode('compare2')}>Comparar</button>
                    </div>
                  )}
                  <div className="b2b-quick-ranges">
                    <button type="button" className={`b2b-range-btn ${showOnlyEvaluatedSub?'active':''}`} onClick={()=>setShowOnlyEvaluatedSub(true)}>Evaluados ({evaluatedItems.length})</button>
                    <button type="button" className={`b2b-range-btn ${!showOnlyEvaluatedSub?'active':''}`} onClick={()=>setShowOnlyEvaluatedSub(false)}>Todos ({chapter.items.length})</button>
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
                  <div className="b2b-chart-legend mb-2">
                    <div className="b2b-legend-item"><span className="b2b-legend-dot bg-[#007fa3]"/><span>Capítulo</span></div>
                    <div className="b2b-legend-item"><span className="b2b-legend-dot bg-[#78be20]"/><span>Saludable, desde 95%</span></div>
                    <div className="b2b-legend-item"><span className="b2b-legend-dot bg-[#f2a900]"/><span>Aceptable, desde 85%</span></div>
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trendData} margin={{top:12,right:16,left:-15,bottom:4}}>
                      <defs>
                        <linearGradient id={`chapterGradient-${chapter.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#007fa3" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#007fa3" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#d8e2e2" strokeDasharray="3 3"/>
                      <XAxis dataKey="visitName" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#58696d'}}/>
                      <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} tick={{fontSize:11,fill:'#58696d'}}/>
                      <ReferenceLine y={95} stroke="#78be20" strokeDasharray="4 4" strokeWidth={1.5}/>
                      <ReferenceLine y={85} stroke="#f2a900" strokeDasharray="4 4" strokeWidth={1.5}/>
                      <Tooltip
                        content={({active,payload})=>{
                          if(!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-lg border border-slate-700">
                              <div className="font-bold text-white mb-1">{d.fullLabel}</div>
                              <div className="font-extrabold text-sm mb-1" style={{color:'#78be20'}}>{d.hasScore?`${d.score}%`:'Sin medición'}</div>
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
                        fill={`url(#chapterGradient-${chapter.id})`}
                        dot={{r:4,fill:'#007fa3',stroke:'#ffffff',strokeWidth:2}}
                        activeDot={{r:6,fill:'#78be20',stroke:'#ffffff',strokeWidth:2}}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* CHART AREA 2: Subcriteria Compliance Rate (1 clean bar per subcriterion) */}
              {chartMode === 'subcriteria' && (
                <div className="py-2">
                  <div className="b2b-chart-legend mb-2">
                    <div className="b2b-legend-item"><span className="b2b-legend-dot bg-[#78be20]"/><span>Desde 95%</span></div>
                    <div className="b2b-legend-item"><span className="b2b-legend-dot bg-[#f2a900]"/><span>85% a 94%</span></div>
                    <div className="b2b-legend-item"><span className="b2b-legend-dot bg-[#dc2626]"/><span>Menor de 85%</span></div>
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
                      <Bar
                        dataKey="complianceRate"
                        radius={[4,4,0,0]}
                        barSize={24}
                        isAnimationActive={false}
                        shape={(raw) => {
                          const bar = raw as {x?:number;y?:number;width?:number;height?:number;payload?:{complianceRate?:number|null}};
                          const rawRate = bar.payload?.complianceRate;
                          if(rawRate===null||rawRate===undefined) return <g/>;
                          const rate = Number(rawRate);
                          const fill = rate >= 95 ? '#78be20' : rate >= 85 ? '#f2a900' : '#dc2626';
                          return <Rectangle x={bar.x} y={bar.y} width={bar.width} height={bar.height} radius={[4,4,0,0]} fill={fill}/>;
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* CHART AREA 3: Contrast 2 Visits Side by Side */}
              {chartMode === 'compare2' && (
                <div className="py-2">
                  <div className="chapter-compare-picks">
                    <label>
                      <span className="b2b-legend-dot bg-[#007fa3]"/>
                      Base
                      <select aria-label="Visita base" value={visitIndexA} onChange={e=>setVisitIndexA(Number(e.target.value))}>
                        {visits.map((v, idx) => (
                          <option key={idx} value={idx}>V{idx+1} · {shortDate(v.date)} · {v.score === null ? 'Sin medición' : `${v.score}%`}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="b2b-legend-dot bg-[#78be20]"/>
                      Contraste
                      <select aria-label="Visita de contraste" value={visitIndexB} onChange={e=>setVisitIndexB(Number(e.target.value))}>
                        {visits.map((v, idx) => (
                          <option key={idx} value={idx}>V{idx+1} · {shortDate(v.date)} · {v.score === null ? 'Sin medición' : `${v.score}%`}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={compare2Data} margin={{top:10,right:12,left:-15,bottom:4}}>
                      <CartesianGrid vertical={false} stroke="#d8e2e2" strokeDasharray="3 3"/>
                      <XAxis dataKey="id" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#58696d'}}/>
                      <YAxis domain={[0,100]} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} tick={{fontSize:11,fill:'#58696d'}}/>
                      <Tooltip formatter={(value,name)=>[value===100?'Sí':value===0?'No':'Sin medición',String(name)]}/>
                      <Legend wrapperStyle={{fontSize:'12px',color:'#58696d'}}/>
                      <Bar dataKey="scoreA" name={`Base · V${visitIndexA+1}`} fill="#007fa3" barSize={16} isAnimationActive={false} shape={CompareMark}/>
                      <Bar dataKey="scoreB" name={`Contraste · V${visitIndexB+1}`} fill="#78be20" barSize={16} isAnimationActive={false} shape={CompareMark}/>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="chapter-chart-note">El azul es la visita base y el verde el contraste. Un No se marca en rojo sobre la base. Si no hay barra, ese criterio no se midió.</p>
                </div>
              )}
            </div>

            {/* High-Contrast Clean Audit Matrix Table */}
            <div className="audit-table-wrap">
              <table className="audit-matrix">
                <thead>
                  <tr>
                    <th style={{width:'55px'}}>Código</th>
                    <th style={{minWidth:'260px'}}>Criterio</th>
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
                    <th style={{width:'130px',textAlign:'center'}}>Conformidad</th>
                    <th style={{width:'110px',textAlign:'center'}}>Lectura</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map(item=>{
                    const firstV = item.allVisits?.[0];
                    const lastV = item.allVisits?.at(-1);
                    const improved = firstV?.answer === 'NO' && lastV?.answer === 'SI';
                    const worsened = firstV?.answer === 'SI' && lastV?.answer === 'NO';
                    
                    const applicableVisits = visits.filter(v => {
                      const a = answerOnVisit(item, v)?.answer;
                      return a === 'SI' || a === 'NO';
                    });
                    const siVisits = visits.filter(v => {
                      const a = answerOnVisit(item, v)?.answer;
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
                            const vAns = answerOnVisit(item, v);
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
                                <div className="h-full" style={{width:`${compliancePct}%`,background:compliancePct>=95?'#78be20':compliancePct>=85?'#f2a900':'#dc2626'}}/>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No aplica</span>
                          )}
                        </td>

                        {/* Trajectory Diagnosis */}
                        <td style={{textAlign:'center'}}>
                          {improved ? (
                            <span className="chapter-diagnosis corrected">Corregido</span>
                          ) : worsened ? (
                            <span className="chapter-diagnosis worse">Empeoró</span>
                          ) : allSi ? (
                            <span className="chapter-diagnosis stable">Estable</span>
                          ) : allNo ? (
                            <span className="chapter-diagnosis repeat">Hallazgo</span>
                          ) : (
                            <span className="chapter-diagnosis mixed">Mixto</span>
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
        <div className="chapter-detail-toolbar">
          <p className="chapter-scope-note">{evaluatedChapters.length} de {chapters.length} capítulos evaluados · sin medir: {unevaluatedChapters.map(c=>c.id).join(', ')}</p>
          <div className="b2b-quick-ranges">
            <button type="button" className={`b2b-range-btn ${showOnlyEvaluated?'active':''}`} onClick={()=>setShowOnlyEvaluated(true)}>Evaluados</button>
            <button type="button" className={`b2b-range-btn ${!showOnlyEvaluated?'active':''}`} onClick={()=>setShowOnlyEvaluated(false)}>Los 5</button>
          </div>
        </div>
      ) : (
        <p className="chapter-scope-note"><ShieldCheck size={14} className="inline mr-1 text-[#78be20]"/>Los cinco procesos están evaluados.</p>
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
          <small>{chapter.applicable ? `${chapter.applicable - chapter.findings}/${chapter.applicable} conformes` : 'Sin medición'}</small>
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
