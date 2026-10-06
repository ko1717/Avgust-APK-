'use client';
import {useRef,useState} from 'react';
import {Download,Upload} from 'lucide-react';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

type Result={farmsCreated:number;visitsImported:number;requestsImported:number;reportsImported:number;photosImported:number;skipped:number;message:string};
const MAX_BYTES=16*1024*1024;

export default function AccountBackup({dirty}:{dirty:boolean}){
 const input=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState<'download'|'import'|null>(null),[message,setMessage]=useState(''),[reloadReady,setReloadReady]=useState(false);
 async function downloadBackup(){
  setBusy('download');setMessage('');setReloadReady(false);
  try{
   const response=await fetch('/api/backup',{cache:'no-store'});
   if(!response.ok){const data=await response.json() as {error?:string};throw new Error(data.error||'No se pudo crear el respaldo.');}
   const bundle=await response.json() as Parameters<typeof import('@/lib/account-backup-file').createCare360Backup>[0];
   const {createCare360Backup}=await import('@/lib/account-backup-file');
   const bytes=await createCare360Backup(bundle,()=>sqlWasmUrl);
   const blobBytes=new Uint8Array(bytes.byteLength);blobBytes.set(bytes);
   const blob=new Blob([blobBytes.buffer],{type:'application/octet-stream'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=`AVGUST-CARE-${new Date().toISOString().slice(0,10)}.care360`;
   link.click();window.setTimeout(()=>URL.revokeObjectURL(url),2000);setMessage('Respaldo .care360 descargado, incluidas las fotografías. Guárdalo en un lugar seguro.');
  }catch(error){setMessage(error instanceof Error?error.message:'No se pudo crear el respaldo.');}
  finally{setBusy(null);}
 }
 async function restore(file?:File){
  if(!file)return;
  setBusy('import');setMessage('');setReloadReady(false);
  try{
   if(file.size>MAX_BYTES)throw new Error('El respaldo supera el límite de 16 MB.');
   const fileBytes=new Uint8Array(await file.arrayBuffer());
   let bundle:unknown,unassignedRequests=0;
   if(new TextDecoder().decode(fileBytes.subarray(0,16))==='SQLite format 3\u0000'){
    const identityResponse=await fetch('/api/team',{cache:'no-store'}),identityData=await identityResponse.json() as {userId?:string;error?:string};
    if(!identityResponse.ok||!identityData.userId)throw new Error(identityData.error||'No se pudo verificar la cuenta.');
    const {readCare360Backup}=await import('@/lib/account-backup-file');
    const imported=await readCare360Backup(fileBytes,identityData.userId,()=>sqlWasmUrl);
    bundle=imported.bundle;unassignedRequests=imported.unassignedRequests;
   }else{
    try{bundle=JSON.parse(new TextDecoder().decode(fileBytes));}catch{throw new Error('El archivo no es un respaldo .care360 o JSON compatible.');}
   }
   if(!bundle||typeof bundle!=='object'||Array.isArray(bundle))throw new Error('El archivo no es un respaldo AVGUST CARE 360.');
   const counts=bundle as Record<string,unknown>;
   const count=(key:string)=>Array.isArray(counts[key])?counts[key].length:0;
   const warning=unassignedRequests?` ${unassignedRequests} solicitudes con asignaciones locales se importarán sin responsable; tendrás que asignar miembros de la cuenta.`:'';
   if(!window.confirm(`Se combinarán ${count('farms')} fincas, ${count('visits')} visitas, ${count('reports')} informes y ${count('photos')} fotografías. Los registros existentes no se reemplazarán.${warning} ¿Continuar?`))return;
   const content=JSON.stringify(bundle);
   if(new TextEncoder().encode(content).byteLength>MAX_BYTES)throw new Error('El contenido del respaldo supera 16 MB al prepararlo para el servidor.');
   const response=await fetch('/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:content});
   const result=await response.json() as Result|{error?:string};
   if(!response.ok)throw new Error('error'in result&&result.error?result.error:'No se pudo importar el respaldo.');
   const summary=result as Result;
   setMessage(`Fusión completada: ${summary.farmsCreated} fincas, ${summary.visitsImported} visitas, ${summary.requestsImported} solicitudes, ${summary.reportsImported} informes y ${summary.photosImported} fotos restauradas; ${summary.skipped} registros omitidos por conflictos o permisos.${unassignedRequests?` ${unassignedRequests} solicitudes quedaron sin asignar y deben revisarse.`:''}`);
   setReloadReady(true);
  }catch(error){setMessage(error instanceof Error?error.message:'No se pudo importar el respaldo.');}
  finally{setBusy(null);if(input.current)input.current.value='';}
 }
 return <section className="account-backup" aria-labelledby="account-backup-title">
  <div><div className="eyebrow">DATOS DE LA CUENTA</div><h2 id="account-backup-title">Respaldo y restauración</h2><p>Descarga e importa el respaldo en formato AVGUST CARE 360 `.care360`, con fincas, contactos, visitas, solicitudes, informes y fotografías.</p><p>La restauración combina registros faltantes; nunca elimina ni reemplaza los que ya existen. Por privacidad, no se exportan miembros ni sus asignaciones: revisa y reasigna las solicitudes después de importar. No incluye invitaciones ni auditoría. Límite: 16 MB por archivo y 8 MB por fotografía.</p></div>
  <div className="actions"><button className="secondary" disabled={Boolean(busy)||dirty} onClick={downloadBackup}><Download size={17}/>{busy==='download'?'Creando respaldo…':'Exportar respaldo .care360'}</button><button className="primary" disabled={Boolean(busy)||dirty} onClick={()=>input.current?.click()}><Upload size={17}/>{busy==='import'?'Importando…':'Importar y combinar'}</button><input ref={input} hidden type="file" accept=".care360,.json,application/octet-stream,application/json" onChange={event=>void restore(event.target.files?.[0])}/></div>
  {dirty&&<output className="muted">Guarda o cierra primero la visita en edición para respaldar los datos persistidos.</output>}
  {message&&<output className="backup-message">{message}{reloadReady&&<button className="secondary" onClick={()=>window.location.reload()}>Actualizar datos</button>}</output>}
 </section>;
}
