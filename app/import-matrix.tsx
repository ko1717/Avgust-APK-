'use client';
import {useState} from 'react';
import {FileUp,ShieldCheck} from 'lucide-react';
import {matrixRowsToVisits,readMatrixFile} from '@/lib/import-matrix';
import type {Visit} from '@/lib/model';

export default function ImportMatrix({onImport}:{onImport:(visits:Visit[])=>Promise<void>}){
 const [name,setName]=useState(''),[visits,setVisits]=useState<Visit[]>([]),[errors,setErrors]=useState<string[]>([]),[rows,setRows]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function choose(file:File|undefined){if(!file)return;setBusy(true);setMessage('');try{const result=matrixRowsToVisits(await readMatrixFile(file));setName(file.name);setRows(result.rows);setVisits(result.visits);setErrors(result.errors);}catch(error){setName(file.name);setVisits([]);setErrors([(error as Error).message]);}finally{setBusy(false);}}
 async function save(){setBusy(true);setMessage('');try{await onImport(visits);setMessage(`${visits.length} aseguramientos históricos importados.`);setVisits([]);}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 return <details className="matrix-import no-print"><summary><FileUp size={18}/> Importar matriz histórica</summary><p>Selecciona la matriz Excel descargada desde AVGUST CARE 360 o un CSV con Finca, Fecha, Capítulo, Ítem y Respuesta. Se revisa antes de guardar.</p><input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={e=>void choose(e.target.files?.[0])}/>{busy&&<p className="muted">Revisando archivo…</p>}{name&&<div className={errors.length?'notice error':'notice success'}><strong>{name}</strong><p>{rows} filas leídas. {visits.length?`${visits.length} aseguramientos listos para importar.`:''}</p>{errors.length?<ul>{errors.slice(0,5).map(error=><li key={error}>{error}</li>)}</ul>:<button disabled={busy||!visits.length} className="primary" onClick={()=>void save()}><ShieldCheck size={17}/>Importar aseguramientos</button>}</div>}{message&&<p className="notice success">{message}</p>}</details>;
}
