import {metrics,type Visit} from './model';

export type MetricKind='numeric'|'textual';
export type MetricChange='increased'|'decreased'|'stable'|'insufficient_data'|'incompatible';
export type MetricDefinition={
 id:string;
 label:string;
 kind:MetricKind;
 unit:string;
 precision:number;
 tolerance:number;
 graphable:boolean;
 source:'indicator'|'measurement';
};
export type MetricReading={
 metricId:string;
 label:string;
 kind:MetricKind;
 unit:string;
 originalValue:string;
 numericValue?:number;
 textValue?:string;
};
export type NumericComparison={
 kind:'numeric';
 delta:number;
 relativeChange:number|null;
 change:MetricChange;
 differenceLabel:string;
};
export type TextComparison={kind:'textual';same:boolean;change:'same'|'changed'};

// These values are display rules only. They do not express an agronomic target
// or a favourable direction: a value is stable only when it is unchanged at the
// stored precision. Future professional rules can revise a definition in one place.
export const metricDefinitions:MetricDefinition[]=[
 {id:'compliance',label:'Indicador de cumplimiento',kind:'numeric',unit:'%',precision:0,tolerance:0,graphable:true,source:'indicator'},
 {id:'ph',label:'pH del agua',kind:'numeric',unit:'pH',precision:2,tolerance:0,graphable:true,source:'measurement'},
 {id:'hardness',label:'Dureza',kind:'numeric',unit:'ppm',precision:0,tolerance:0,graphable:true,source:'measurement'},
 {id:'pressure',label:'Presión',kind:'numeric',unit:'PSI',precision:1,tolerance:0,graphable:true,source:'measurement'},
 {id:'volume',label:'Volumen por cama',kind:'numeric',unit:'L',precision:2,tolerance:0,graphable:true,source:'measurement'},
 {id:'time',label:'Tiempo por cama',kind:'numeric',unit:'s',precision:2,tolerance:0,graphable:true,source:'measurement'},
 {id:'equipment',label:'Equipo de aplicación',kind:'textual',unit:'',precision:0,tolerance:0,graphable:false,source:'measurement'},
];

export const MINIMUM_TREND_POINTS=3;
export const RELATIVE_CHANGE_PRECISION=1;
export const metricChangeLabels:Record<MetricChange,string>={increased:'Aumentó',decreased:'Disminuyó',stable:'Estable',insufficient_data:'Datos insuficientes',incompatible:'Valores no comparables por unidad'};

export function metricDefinition(id:string){return metricDefinitions.find(definition=>definition.id===id);}
export function graphableMetricDefinitions(){return metricDefinitions.filter(definition=>definition.kind==='numeric'&&definition.graphable);}
export function roundMetric(value:number,precision:number){const factor=10**precision;return Math.round((value+Number.EPSILON)*factor)/factor;}
export function formatMetricNumber(value:number,definition:Pick<MetricDefinition,'precision'>){return new Intl.NumberFormat('es-CO',{minimumFractionDigits:0,maximumFractionDigits:definition.precision}).format(roundMetric(value,definition.precision));}
export function formatMetricValue(value:number,definition:Pick<MetricDefinition,'precision'|'unit'>){return `${formatMetricNumber(value,definition)}${definition.unit?` ${definition.unit}`:''}`;}

// A measurement is numeric only when the complete original value is a plain
// decimal number. This accepts the Colombian decimal comma, but deliberately
// rejects notes such as "aprox. diez" and unit conversions such as "2 bar".
export function strictNumber(value:string){
 const source=value.trim();
 if(!/^[+-]?(?:\d+(?:[.,]\d+)?|\d*[.,]\d+)$/.test(source))return null;
 const numeric=Number(source.replace(',','.'));
 return Number.isFinite(numeric)?numeric:null;
}

export function metricReading(visit:Visit,definition:MetricDefinition):MetricReading|null{
 if(definition.source==='indicator'){
  const score=metrics(visit).score;
  return score===null?null:{metricId:definition.id,label:definition.label,kind:definition.kind,unit:definition.unit,originalValue:String(score),numericValue:score};
 }
 const originalValue=visit.measurements[definition.id]?.trim()||'';
 if(!originalValue)return null;
 if(definition.kind==='textual')return {metricId:definition.id,label:definition.label,kind:definition.kind,unit:definition.unit,originalValue,textValue:originalValue};
 const numericValue=strictNumber(originalValue);
 return numericValue===null?null:{metricId:definition.id,label:definition.label,kind:definition.kind,unit:definition.unit,originalValue,numericValue};
}

export function compareNumericValues(previous:number,current:number,previousUnit:string,currentUnit:string,definition:Pick<MetricDefinition,'precision'|'tolerance'|'unit'>):NumericComparison|{kind:'numeric';change:'incompatible';differenceLabel:string}{
 if(previousUnit!==currentUnit||previousUnit!==definition.unit)return {kind:'numeric',change:'incompatible',differenceLabel:'Valores no comparables por unidad'};
 const delta=roundMetric(current-previous,definition.precision);
 const change:MetricChange=Math.abs(delta)<=definition.tolerance?'stable':delta>0?'increased':'decreased';
 const relativeChange=previous===0?null:roundMetric((delta/Math.abs(previous))*100,RELATIVE_CHANGE_PRECISION);
 return {kind:'numeric',delta,relativeChange,change,differenceLabel:definition.unit==='%'?`${delta>0?'+':''}${formatMetricNumber(delta,definition)} puntos porcentuales`:`${delta>0?'+':''}${formatMetricValue(delta,definition)}`};
}

export function compareMetricReadings(previous:MetricReading,current:MetricReading,definition:MetricDefinition){
 if(previous.metricId!==current.metricId||previous.unit!==current.unit)return {kind:definition.kind,change:'incompatible' as const,differenceLabel:'Valores no comparables por unidad'};
 if(definition.kind==='textual')return {kind:'textual' as const,same:previous.textValue===current.textValue,change:previous.textValue===current.textValue?'same' as const:'changed' as const};
 if(previous.numericValue===undefined||current.numericValue===undefined)return {kind:'numeric' as const,change:'incompatible' as const,differenceLabel:'Valores no comparables por unidad'};
 return compareNumericValues(previous.numericValue,current.numericValue,previous.unit,current.unit,definition);
}

export function descriptiveTrend(points:{numericValue:number}[],definition:Pick<MetricDefinition,'precision'|'tolerance'>):MetricChange{
 if(points.length<MINIMUM_TREND_POINTS)return 'insufficient_data';
 const first=points[0],last=points.at(-1)!;
 const delta=roundMetric(last.numericValue-first.numericValue,definition.precision);
 return Math.abs(delta)<=definition.tolerance?'stable':delta>0?'increased':'decreased';
}
