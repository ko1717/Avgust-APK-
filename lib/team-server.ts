import {db,body} from './server';
import {canEdit,type FarmContact,type Role} from './team';
export async function access(user:string,farm:string,mode:'read'|'edit'|'manage'='read'){
 const m=await db().prepare('SELECT role FROM farm_members WHERE farm_id = ? AND user_id = ?').bind(farm,user).first<{role:Role}>();
 if(!m||mode==='edit'&&!canEdit(m.role)||mode==='manage'&&m.role!=='manager')throw new Error('403:No tienes permiso para esta finca.');
 return m.role;
}
export async function jsonBody(req:Request){try{const x=JSON.parse(new TextDecoder().decode(await body(req,500000)));if(!x||typeof x!=='object'||Array.isArray(x))throw new Error();return x as Record<string,unknown>;}catch(e){if(e instanceof Error&&e.message.startsWith('413:'))throw e;throw new Error('400:Datos inválidos.');}}
export function field(x:Record<string,unknown>,key:string,max=300){const v=x[key];if(typeof v!=='string'||v.length>max)throw new Error(`400:Campo inválido: ${key}.`);return v.trim();}
export function contacts(x:Record<string,unknown>):FarmContact[]{const raw=x.contacts;if(!Array.isArray(raw)||!raw.length||raw.length>12)throw new Error('400:Contactos inválidos.');return raw.map(entry=>{if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('400:Contacto inválido.');const value=entry as Record<string,unknown>;const name=field(value,'name'),role=field(value,'role'),phone=field(value,'phone'),email=field(value,'email');if(!name||!role||!phone||!email||!/^\S+@\S+\.\S+$/.test(email)||typeof value.receiveReports!=='boolean')throw new Error('400:Completa nombre, cargo, teléfono y correo de cada contacto.');return {id:typeof value.id==='string'&&/^[a-f0-9-]{36}$/.test(value.id)?value.id:crypto.randomUUID(),name,role,phone,email,receiveReports:value.receiveReports};});}
