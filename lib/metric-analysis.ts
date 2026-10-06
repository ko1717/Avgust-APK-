import {catalog,farmKey,findings,metrics,metricStatus,metricTrend,type MetricStatus,type Visit} from './model';
import {calculateVisitScore} from '../migration/source-core/mipe-scoring.mjs';

export type MetricRecord={visit:Visit;score:number;status:MetricStatus;applicable:number;positive:number;findings:number;date:string;responsible:string;weightedScore:number|null;pointsEarned:number;criteriaCompliance:number|null;weightedCoveragePct:number;evaluatedChapters:number};
export type ChapterMetricItem={id:string;text:string;firstAnswer:string|null;latestAnswer:string|null;firstScore:number|null;latestScore:number|null};
export type ChapterMetricDetail={id:number;title:string;weight:number;weightPct:number;maxPoints:number;pointsEarned:number;firstPointsEarned:number;score:number|null;firstScore:number|null;findings:number;applicable:number;status:MetricStatus;items:ChapterMetricItem[]};
export type FarmMetricAnalysis={farm:string;records:MetricRecord[];first?:MetricRecord;latest?:MetricRecord;trend:ReturnType<typeof metricTrend>;delta:number|null;yearly:{year:string;average:number;closing:number;visits:number;status:MetricStatus}[];chapters:ChapterMetricDetail[];problems:{id:string;text:string;recommendation:string;chapter:number;occurrences:number}[]};
export type ConsolidatedMetricAnalysis={records:MetricRecord[];farms:number;applicable:number;findings:number;score:number|null;status:MetricStatus;timeline:{period:string;score:number;findings:number;reports:number;status:MetricStatus}[];trend:ReturnType<typeof metricTrend>;chapters:{id:number;title:string;applicable:number;findings:number;score:number|null;status:MetricStatus;farms:number}[];items:{id:string;chapter:number;chapterTitle:string;text:string;applicable:number;findings:number;rate:number;farms:number}[];matrix:{farm:string;date:string;responsible:string;chapter:string;item:string;text:string;answer:string;observation:string;recommendation:string}[]};
export type FarmBenchmarkRecord={farm:string;date:string;score:number;findings:number;applicable:number;chapterIds:number[];rank:number;tied:boolean};
export type FarmBenchmark={groups:{chapterIds:number[];records:FarmBenchmarkRecord[]}[];singleScopes:{farm:string;date:string;chapterIds:number[]}[];ambiguousFarms:string[]};

function metricRecord(visit:Visit):MetricRecord|null{
 const m=metrics(visit),weighted=calculateVisitScore(visit);
 if(m.score===null)return null;
 return {visit,score:m.score,status:m.status,applicable:m.applicable,positive:m.positive,findings:m.findings,date:visit.date,responsible:visit.responsible,weightedScore:weighted.weightedScore,pointsEarned:weighted.pointsEarned,criteriaCompliance:weighted.criteriaCompliance,weightedCoveragePct:Math.round(weighted.auditedWeight*100),evaluatedChapters:weighted.evaluatedChapters.length};
}

const CHAPTER_CONFIG:Record<number,{weight:number;maxPoints:number}>={
 1:{weight:0.05,maxPoints:5},
 2:{weight:0.30,maxPoints:30},
 3:{weight:0.05,maxPoints:5},
 4:{weight:0.30,maxPoints:30},
 5:{weight:0.30,maxPoints:30}
};

function chapterStats(visit:Visit|undefined,chapterId:number){
 const chapter=catalog.find(item=>item.id===chapterId);
 const included=!!visit?.chapters.includes(chapterId);
 const applicable=chapter?.items.filter(item=>included&&['SI','NO'].includes(visit?.answers[item.id]?.value||''))||[];
 const positive=applicable.filter(item=>visit?.answers[item.id]?.value==='SI').length;
 const score=applicable.length?Math.round(positive/applicable.length*100):null;
 const cfg=CHAPTER_CONFIG[chapterId]||{weight:0.2,maxPoints:20};
 const pointsEarned=score!==null?Math.round((score/100)*cfg.maxPoints*10)/10:0;
 return {score,findings:applicable.length-positive,applicable:applicable.length,status:metricStatus(score),pointsEarned,weight:cfg.weight,weightPct:Math.round(cfg.weight*100),maxPoints:cfg.maxPoints};
}

export function farmMetricHistory(visits:Visit[],farm:string):FarmMetricAnalysis{
 const key=farmKey(farm);
 const records=visits.filter(v=>v.reviewed&&farmKey(v.farm)===key).map(metricRecord).filter((r):r is MetricRecord=>r!==null).sort((a,b)=>a.date.localeCompare(b.date));
 const first=records[0],latest=records.at(-1),trend=latest?metricTrend(first,latest):'pending';
 const occurrence=new Map<string,number>();
 for(const record of records)for(const finding of findings(record.visit))occurrence.set(finding.id,(occurrence.get(finding.id)||0)+1);
 const problems=latest?findings(latest.visit).map(f=>({id:f.id,text:f.text,recommendation:f.answer.recommendation,chapter:Number(f.id.split('.')[0]),occurrences:occurrence.get(f.id)||1})):[];
 const chapters=catalog.map(chapter=>{
  const firstStats=chapterStats(first?.visit,chapter.id),latestStats=chapterStats(latest?.visit,chapter.id);
  const items=chapter.items.map(item=>{
   const firstAnswer=first?.visit.chapters.includes(chapter.id)?first.visit.answers[item.id]?.value||null:null;
   const latestAnswer=latest?.visit.chapters.includes(chapter.id)?latest.visit.answers[item.id]?.value||null:null;
   const answerScore=(answer:string|null)=>answer==='SI'?100:answer==='NO'?0:null;
   return {id:item.id,text:item.text,firstAnswer,latestAnswer,firstScore:answerScore(firstAnswer),latestScore:answerScore(latestAnswer)};
  });
  return {id:chapter.id,title:chapter.title,...latestStats,firstScore:firstStats.score,firstPointsEarned:firstStats.pointsEarned,items};
 });
 const byYear=new Map<string,MetricRecord[]>();for(const record of records){const year=record.date.slice(0,4);byYear.set(year,[...(byYear.get(year)||[]),record]);}
 const yearly=Array.from(byYear.entries()).map(([year,items])=>{const closing=items.at(-1)!;const average=Math.round(items.reduce((total,item)=>total+item.score,0)/items.length);return {year,average,closing:closing.score,visits:items.length,status:metricStatus(closing.score)};});
 return {farm:latest?.visit.farm||farm,records,first,latest,trend,delta:first&&latest?latest.score-first.score:null,yearly,chapters,problems};
}

export function consolidatedMetricAnalysis(visits:Visit[]):ConsolidatedMetricAnalysis{
 const records=visits.filter(v=>v.reviewed&&(!v.serviceKind||v.serviceKind==='assurance')).map(metricRecord).filter((r):r is MetricRecord=>r!==null).sort((a,b)=>a.date.localeCompare(b.date));
 const applicable=records.reduce((total,r)=>total+r.applicable,0),findings=records.reduce((total,r)=>total+r.findings,0),score=applicable?Math.round((applicable-findings)/applicable*100):null;
 const timelineMap=new Map<string,MetricRecord[]>();for(const record of records){const period=record.date.slice(0,7);timelineMap.set(period,[...(timelineMap.get(period)||[]),record]);}
 const timeline=Array.from(timelineMap.entries()).map(([period,items])=>{const findings=items.reduce((total,item)=>total+item.findings,0),applicable=items.reduce((total,item)=>total+item.applicable,0),score=applicable?Math.round((applicable-findings)/applicable*100):0;return {period,score,findings,reports:items.length,status:metricStatus(score)};});
 const first=timeline[0],last=timeline.at(-1);const trend=last?metricTrend({score:first?.score??null,status:first?.status??'pending',applicable:0,positive:0,findings:0,date:first?.period||'',responsible:''},{score:last.score,status:last.status,applicable:0,positive:0,findings:0,date:last.period,responsible:''}):'pending';
 const chapters=catalog.map(c=>{let applicable=0,findings=0;const farms=new Set<string>();for(const record of records){for(const item of c.items){const answer=record.visit.answers[item.id]?.value;if(answer==='SI'||answer==='NO'){applicable++;farms.add(farmKey(record.visit.farm));if(answer==='NO')findings++;}}}const score=applicable?Math.round((applicable-findings)/applicable*100):null;return {id:c.id,title:c.title,applicable,findings,score,status:metricStatus(score),farms:farms.size};});
 const items=catalog.flatMap(c=>c.items.map(item=>{let applicable=0,findings=0;const farms=new Set<string>();for(const record of records){const answer=record.visit.answers[item.id]?.value;if(answer==='SI'||answer==='NO'){applicable++;farms.add(farmKey(record.visit.farm));if(answer==='NO')findings++;}}return {id:item.id,chapter:c.id,chapterTitle:c.title,text:item.text,applicable,findings,rate:applicable?Math.round(findings/applicable*100):0,farms:farms.size};})).sort((a,b)=>b.findings-a.findings||b.rate-a.rate||a.id.localeCompare(b.id));
 const matrix=records.flatMap(record=>catalog.filter(c=>record.visit.chapters.includes(c.id)).flatMap(c=>c.items.map(item=>{const answer=record.visit.answers[item.id];return answer?.value?{farm:record.visit.farm,date:record.date,responsible:record.responsible,chapter:`${c.id}. ${c.title}`,item:item.id,text:item.text,answer:answer.value==='SI'?'Sí':answer.value==='NO'?'No':'No aplica',observation:answer.observation,recommendation:answer.recommendation}:null;}).filter((row):row is NonNullable<typeof row>=>row!==null)));
 return {records,farms:new Set(records.map(r=>farmKey(r.visit.farm))).size,applicable,findings,score,status:metricStatus(score),timeline,trend,chapters,items,matrix};
}

export function compareFarmBenchmarks(visits:Visit[]):FarmBenchmark{
 const latestByFarm=new Map<string,MetricRecord[]>();
 for(const visit of visits){
  if(!visit.reviewed||(visit.serviceKind&&visit.serviceKind!=='assurance'))continue;
  const record=metricRecord(visit);
  if(!record||!record.visit.farm.trim())continue;
  const key=farmKey(record.visit.farm),current=latestByFarm.get(key)||[];
  if(!current.length||record.date>current[0].date)latestByFarm.set(key,[record]);
  else if(record.date===current[0].date)current.push(record);
 }
 const ambiguousFarms:string[]=[],scoped=new Map<string,{chapterIds:number[];records:Omit<FarmBenchmarkRecord,'rank'|'tied'>[]}>();
 for(const records of latestByFarm.values()){
  const latest=records[0];
  if(records.length!==1){ambiguousFarms.push(latest.visit.farm);continue;}
  const chapterIds=[...latest.visit.chapters].sort((a,b)=>a-b),key=chapterIds.join(',');
  const group=scoped.get(key)||{chapterIds,records:[]};
  group.records.push({farm:latest.visit.farm,date:latest.date,score:latest.score,findings:latest.findings,applicable:latest.applicable,chapterIds});
  scoped.set(key,group);
 }
 const groups:FarmBenchmark['groups']=[],singleScopes:FarmBenchmark['singleScopes']=[];
 for(const group of scoped.values()){
  const ranked=group.records.sort((a,b)=>b.score-a.score||a.farm.localeCompare(b.farm,'es'));
  if(ranked.length===1){singleScopes.push(ranked[0]);continue;}
  const records:FarmBenchmarkRecord[]=ranked.map((record,index)=>{
   const prior=index?ranked[index-1]:undefined;
   return {...record,rank:prior?.score===record.score?recordsRank(ranked,index):index+1,tied:prior?.score===record.score||ranked[index+1]?.score===record.score};
  });
  groups.push({chapterIds:group.chapterIds,records});
 }
 groups.sort((a,b)=>b.records.length-a.records.length||a.chapterIds.join(',').localeCompare(b.chapterIds.join(',')));
 singleScopes.sort((a,b)=>a.farm.localeCompare(b.farm,'es'));
 ambiguousFarms.sort((a,b)=>a.localeCompare(b,'es'));
 return {groups,singleScopes,ambiguousFarms};
}

function recordsRank(records:{score:number}[],index:number){
 let rank=1;
 for(let i=0;i<index;i++)if(records[i].score!==records[index].score)rank=i+2;
 return rank;
}
