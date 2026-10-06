import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function db(){return env.DB;}
export function files(){return env.FILES;}
export async function identity(req:Request,write=false){
 const u=await getChatGPTUser();if(!u)throw new Error('401:Inicia sesión para acceder a tus informes.');
 if(write){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Error('403:Origen no permitido.');}
 return u.userId;
}
export function failure(e:unknown){const msg=e instanceof Error?e.message:'Error';const match=/^(400|401|403|404|409|413|422):(.+)$/.exec(msg); if(!match)console.error('Operation failed',msg);return Response.json({error:match?match[2]:'No se pudo completar la operación. Intenta nuevamente.'},{status:match?Number(match[1]):500});}
export async function body(req:Request,max:number){const reader=req.body?.getReader();if(!reader)throw new Error('400:Faltan los datos.');let size=0;const parts:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('413:El archivo o formulario supera el tamaño permitido.');}parts.push(value);}const data=new Uint8Array(size);let offset=0;for(const p of parts){data.set(p,offset);offset+=p.length;}return data;}
