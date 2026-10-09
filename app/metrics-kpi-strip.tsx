'use client';
import {ClipboardCheck,TrendingDown,TrendingUp} from 'lucide-react';
import './b2b-metrics.css';

export type ChapterTrendKpi={id:number;title:string;weightPct:number;score:number|null;delta:number|null;comparisons:number};

function formatPoints(value:number){return Number.isInteger(value)?String(value):value.toFixed(1);}

export default function MetricsKpiStrip({count,scope,chapterTrends,comparisonLabel}:{count:number;scope:string;chapterTrends:ChapterTrendKpi[];comparisonLabel:string}){
  return <div className="metrics-kpi-strip" aria-label="Indicadores clave del aseguramiento">
    <article className="metrics-kpi-card metrics-assurance-count">
      <div className="metrics-kpi-count-content">
        <span className="metrics-section-kicker">ACTIVIDAD</span>
        <h3>Aseguramientos realizados</h3>
        <strong className="metrics-kpi-number">{count}</strong>
        <p>{scope}</p>
      </div>
      <span className="metrics-kpi-icon" aria-hidden="true"><ClipboardCheck size={23}/></span>
    </article>

    <section className="metrics-kpi-card metrics-chapter-trends" aria-labelledby="chapter-trends-title">
      <div className="metrics-kpi-heading">
        <div><span className="metrics-section-kicker">CAPÍTULOS</span><h3 id="chapter-trends-title">Tendencia por capítulo</h3></div>
        <span className="metrics-kpi-context">{comparisonLabel}</span>
      </div>
      <div className="metrics-chapter-trend-list">
        {chapterTrends.map(chapter=><div className="metrics-chapter-trend" key={chapter.id}>
          <div className="metrics-chapter-trend-name"><strong>Cap. {chapter.id}</strong><span title={chapter.title}>{chapter.title}</span><small>{chapter.weightPct}%</small></div>
          <div className="metrics-chapter-trend-track" aria-label={chapter.score===null?'Sin evaluar':`Resultado ${chapter.score}%`}><span className={chapter.score===null?'empty':chapter.score>=95?'healthy':chapter.score>=80?'acceptable':'critical'} style={{width:`${Math.min(100,Math.max(0,chapter.score??0))}%`}}/></div>
          <strong className="metrics-chapter-trend-score">{chapter.score===null?'—':`${formatPoints(chapter.score)}%`}</strong>
          <div className="metrics-chapter-trend-change"><span className={`metrics-chapter-trend-delta ${chapter.delta===null?'neutral':chapter.delta>0?'positive':chapter.delta<0?'negative':'neutral'}`} title={chapter.delta===null?'Sin una comparación comparable':`${chapter.comparisons} ${chapter.comparisons===1?'comparación':'comparaciones'}`}>{chapter.delta===null?'Sin base':chapter.delta===0?'Sin cambio':<>{chapter.delta>0?<TrendingUp size={13}/>:<TrendingDown size={13}/>} {chapter.delta>0?'+':''}{formatPoints(chapter.delta)} pts</>}</span>{chapter.delta!==null&&<small>{chapter.comparisons} {chapter.comparisons===1?'finca':'fincas'}</small>}</div>
        </div>)}
      </div>
      <p className="metrics-chapter-trend-note">El resultado corresponde al aseguramiento consultado; la variación solo compara con el anterior cuando tienen el mismo alcance de capítulos.</p>
    </section>
  </div>;
}
