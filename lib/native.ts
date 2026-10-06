export type NativeFiles={begin:(name:string,mime:string)=>string;append:(token:string,chunk:string)=>boolean;finish:(token:string)=>boolean;abort:(token:string)=>void};
const CHUNK=180*1024;
export function nativeFiles():NativeFiles|null{const bridge=(globalThis as unknown as {AvgustFileBridge?:NativeFiles}).AvgustFileBridge;return bridge&&typeof bridge.begin==='function'?bridge:null;}
export function nativeApp(){return nativeFiles()!==null;}
function base64(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
export async function saveThroughBridge(bridge:NativeFiles,blob:Blob,name:string){
 const bytes=new Uint8Array(await blob.arrayBuffer());
 const token=bridge.begin(name,blob.type);
 if(!token)throw new Error('El teléfono no pudo preparar el archivo. Libera espacio de almacenamiento e inténtalo de nuevo.');
 for(let i=0;i<bytes.length;i+=CHUNK)if(!bridge.append(token,base64(bytes.subarray(i,i+CHUNK)))){bridge.abort(token);throw new Error('No se pudo escribir el archivo en el teléfono.');}
 if(!bridge.finish(token))throw new Error('No se pudo abrir el menú para guardar o compartir el archivo.');
}
