import {nativeFiles,saveThroughBridge} from './native';
import {openDeviceStore,replaceDeviceStore,sqlEngine,type DeviceStore} from './device-store';
import {MAX_PHOTO_BYTES} from './model';

type NativeStore={
 storeLength:()=>number;
 storeSlice:(offset:number,length:number)=>string;
 storeStart:()=>boolean;
 storeAppend:(chunk:string)=>boolean;
 storeCommit:()=>boolean;
};

const CHUNK=180*1024;
const IDB_NAME='avgust-care360';
const IDB_STORE='local';

function nativeStore():NativeStore|null{
 const bridge=(globalThis as unknown as {AvgustFileBridge?:NativeStore}).AvgustFileBridge;
 return bridge&&typeof bridge.storeLength==='function'?bridge:null;
}

function base64(bytes:Uint8Array){
 let binary='';
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(binary);
}

function fromBase64(value:string){
 const binary=atob(value);
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}

function concat(parts:Uint8Array[]){
 const total=parts.reduce((n,part)=>n+part.length,0);
 const out=new Uint8Array(total);
 let offset=0;
 for(const part of parts){out.set(part,offset);offset+=part.length;}
 return out;
}

function openIdb(){
 return new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(IDB_NAME,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(IDB_STORE);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}

async function idbLoad(){
 if(typeof indexedDB==='undefined')return undefined;
 const db=await openIdb();
 try{
  const value=await new Promise<ArrayBuffer|Uint8Array|undefined>((resolve,reject)=>{
   const request=db.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).get('sqlite');
   request.onsuccess=()=>resolve(request.result as ArrayBuffer|Uint8Array|undefined);
   request.onerror=()=>reject(request.error);
  });
  if(!value)return undefined;
  return value instanceof Uint8Array?value:new Uint8Array(value);
 }finally{db.close();}
}

async function idbSave(bytes:Uint8Array){
 if(typeof indexedDB==='undefined')return;
 const db=await openIdb();
 try{
  await new Promise<void>((resolve,reject)=>{
   const request=db.transaction(IDB_STORE,'readwrite').objectStore(IDB_STORE).put(bytes, 'sqlite');
   request.onsuccess=()=>resolve();
   request.onerror=()=>reject(request.error);
  });
 }finally{db.close();}
}

function readNative(bridge:NativeStore){
 const length=bridge.storeLength();
 if(!length)return undefined;
 const parts:Uint8Array[]=[];
 for(let offset=0;offset<length;offset+=CHUNK)parts.push(fromBase64(bridge.storeSlice(offset,Math.min(CHUNK,length-offset))));
 return concat(parts);
}

function writeNative(bridge:NativeStore,bytes:Uint8Array){
 if(!bridge.storeStart())throw new Error('No se pudo guardar la base local.');
 for(let offset=0;offset<bytes.length;offset+=CHUNK){
  if(!bridge.storeAppend(base64(bytes.subarray(offset,offset+CHUNK))))throw new Error('No se pudo escribir la base local.');
 }
 if(!bridge.storeCommit())throw new Error('No se pudo confirmar la base local.');
}

async function waitNative(ms=2500){
 const start=Date.now();
 while(Date.now()-start<ms){
  const bridge=nativeStore();
  if(bridge)return bridge;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 return nativeStore();
}

function json(value:unknown,status=200){
 return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
}

function fail(error:unknown){
 const message=error instanceof Error?error.message:'No se pudo completar la operación local. Conserva tus cambios e inténtalo de nuevo.';
 const match=/^(400|403|404|409|413|422):(.+)$/.exec(message);
 return json({error:match?match[2]:message},match?Number(match[1]):500);
}

async function dispatch(store:DeviceStore,request:Request){
 const url=new URL(request.url,location.origin);
 const route=url.pathname;
 const method=request.method;
 try{
  if(method==='GET'){
   if(route==='/api/team')return json(store.team());
   if(route==='/api/requests')return json(store.requests());
   if(route==='/api/visits')return json(store.visits());
   if(route==='/api/draft')return json(store.draft());
   if(route==='/api/reports')return json(store.reports(url.searchParams.get('visitId')||''));
   if(route.startsWith('/api/reports/'))return json(store.report(route.slice('/api/reports/'.length)));
   const metricMatch=/^\/api\/farms\/([a-f0-9-]{36})\/metrics$/.exec(route);
   if(metricMatch)return json(store.metricHistory(metricMatch[1],url.searchParams.get('metric')||'',Object.fromEntries(url.searchParams)));
   if(route.startsWith('/api/visits/'))return json(store.visit(route.slice('/api/visits/'.length)));
   if(route.startsWith('/api/photos/')){
    const photo=store.photo(route.slice('/api/photos/'.length));
    const bytes=photo.data instanceof Uint8Array?new Uint8Array(photo.data):new Uint8Array(photo.data as ArrayBuffer);
    return new Response(new Blob([bytes],{type:photo.mime}),{headers:{'Content-Type':photo.mime}});
   }
  }
  if(method==='DELETE'){
   if(route==='/api/draft')return json(store.clearDraft());
   const farmDel=/^\/api\/farms\/([a-f0-9-]{36})$/.exec(route);if(farmDel)return json(store.deleteFarm(farmDel[1]));
   const visitDel=/^\/api\/visits\/([a-f0-9-]{36})$/.exec(route);if(visitDel)return json(store.deleteVisit(visitDel[1]));
   const reportDel=/^\/api\/reports\/([a-f0-9-]{36})$/.exec(route);if(reportDel)return json(store.deleteReport(reportDel[1]));
   const requestDel=/^\/api\/requests\/([a-f0-9-]{36})$/.exec(route);if(requestDel)return json(store.deleteRequest(requestDel[1]));
  }
  if(method==='POST'){
   const bytes=new Uint8Array(await request.arrayBuffer());
   if(bytes.length>(route==='/api/photos'?MAX_PHOTO_BYTES:500000))return json({error:'El archivo supera el tamaño permitido.'},413);
   if(route==='/api/photos')return json(store.savePhoto(bytes,url.searchParams.get('farmId')));
   let body:Record<string,unknown>;
   try{body=JSON.parse(new TextDecoder().decode(bytes)) as Record<string,unknown>;if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{return json({error:'Datos inválidos.'},400);}
   const compareMatch=/^\/api\/farms\/([a-f0-9-]{36})\/metrics\/compare$/.exec(route);
   if(compareMatch)return json(store.compareMetrics(compareMatch[1],body));
   if(route==='/api/team')return json(store.changeTeam(body));
   if(route==='/api/requests')return json(store.saveRequest(body));
   if(route==='/api/visits')return json(store.saveVisit(body));
   if(route==='/api/draft')return json(store.saveDraft(body));
   if(route==='/api/reports')return json(store.changeReport(body));
  }
  return json({error:'Operación no disponible.'},404);
 }catch(error){return fail(error);}
}

function patchFetch(runtime:{store:DeviceStore}){
 const original=window.fetch.bind(window);
 window.fetch=async(input,init)=>{
  const request=input instanceof Request?input:new Request(String(input),init);
  const url=new URL(request.url,location.origin);
  if(url.pathname.startsWith('/api/'))return dispatch(runtime.store,request);
  return original(input,init);
 };
}

function rewritePhotos(runtime:{store:DeviceStore}){
 const cache=new Map<string,string>();
 const urlFor=(id:string)=>{
  const cached=cache.get(id);
  if(cached)return cached;
  const photo=runtime.store.photo(id);
  const bytes=photo.data instanceof Uint8Array?new Uint8Array(photo.data):new Uint8Array(photo.data);
  const href=URL.createObjectURL(new Blob([bytes],{type:photo.mime}));
  cache.set(id,href);
  return href;
 };
 const scan=(root:ParentNode)=>{
  root.querySelectorAll('img[src^="/api/photos/"]').forEach(image=>{
   const id=image.getAttribute('src')!.slice('/api/photos/'.length).split('?')[0];
   try{image.setAttribute('src',urlFor(id));}catch{/* the missing photo stays hidden */}
  });
 };
 new MutationObserver(mutations=>{
  for(const mutation of mutations){
   if(mutation.type==='attributes'&&mutation.target instanceof HTMLImageElement)scan(document);
   mutation.addedNodes.forEach(node=>{if(node instanceof Element||node instanceof DocumentFragment)scan(node as ParentNode);});
  }
 }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
 scan(document);
}

function pickBackupFile(){
 return new Promise<Uint8Array|null>(resolve=>{
  const input=document.createElement('input');
  input.type='file';
  input.accept='.care360,application/octet-stream';
  input.onchange=async()=>{
   const file=input.files?.[0];
   if(!file){resolve(null);return;}
   resolve(new Uint8Array(await file.arrayBuffer()));
  };
  input.click();
 });
}

export async function startDeviceRuntime(){
 const bridge=await waitNative();
 const persisted=bridge?readNative(bridge):await idbLoad();
 const locateFile=(file:string)=>`${location.origin}/${file}`;
 const persist=async()=>{
  const bytes=runtime.store.exportBytes();
  if(bridge)writeNative(bridge,bytes);
  await idbSave(bytes);
 };
 const runtime={store:await openDeviceStore(persisted,()=>{void persist();},locateFile)};
 patchFetch(runtime);
 rewritePhotos(runtime);
 window.careDesktop={
  backup:async()=>{
   try{
    const files=nativeFiles();
    const blob=new Blob([new Uint8Array(runtime.store.exportBytes())],{type:'application/octet-stream'});
    const name='AVGUST-CARE-'+new Date().toISOString().slice(0,10)+'.care360';
    if(files)await saveThroughBridge(files,blob,name);
    else{
     const url=URL.createObjectURL(blob);
     const a=document.createElement('a');a.href=url;a.download=name;a.click();
     setTimeout(()=>URL.revokeObjectURL(url),2000);
    }
    return {message:'Respaldo completo guardado, incluidas las fotografías.'};
   }catch(error){return {error:error instanceof Error?error.message:'No se pudo crear el respaldo.'};}
  },
  restore:async()=>{
   try{
    const bytes=await pickBackupFile();
    if(!bytes)return {cancelled:true};
    const SQL=await sqlEngine(locateFile);
    runtime.store=replaceDeviceStore(runtime.store,bytes,SQL,()=>{void persist();});
    await persist();
    setTimeout(()=>location.reload(),100);
    return {message:'Respaldo restaurado.'};
   }catch(error){return {error:error instanceof Error?error.message:'No se restauró el archivo.'};}
  },
  openData:async()=>({message:'Los datos están dentro de esta aplicación. Usa Crear respaldo completo para copiarlos.'})
 };
}
