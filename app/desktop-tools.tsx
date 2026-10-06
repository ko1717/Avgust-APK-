'use client';

import {useState} from 'react';

type Result={message?:string;error?:string;cancelled?:boolean};

declare global {interface Window {careDesktop?:{backup:()=>Promise<Result>;restore:()=>Promise<Result>;openData:()=>Promise<Result>};careBack?:()=>boolean}}

export default function DesktopTools({dirty}:{dirty:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(action:'backup'|'restore'|'openData'){setBusy(true);setMessage('');try{const result=await window.careDesktop?.[action]();if(!result)throw new Error('Abre esta función desde la aplicación instalada.');setMessage(result.error||result.message||'');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="desktop-tools"><div><h2>Datos de este equipo</h2><p>Sin conexión · Sin cuentas · Fotografías incluidas en el respaldo</p></div><div className="actions"><button className="secondary" disabled={busy} onClick={()=>void run('backup')}>Crear respaldo completo</button><button className="secondary" disabled={busy||dirty} title={dirty?'Guarda la visita antes de restaurar':undefined} onClick={()=>void run('restore')}>Restaurar respaldo</button><button className="secondary" disabled={busy} onClick={()=>void run('openData')}>Carpeta de datos</button></div>{message&&<output aria-live="polite">{message}</output>}{dirty&&<p className="muted">Guarda la visita en edición antes de restaurar un respaldo.</p>}</section>;}
