export type Role='manager'|'editor'|'viewer';
export const roleLabels={manager:'Coordinación',editor:'Trabajo de campo',viewer:'Consulta'};
export type Member={user_id:string;name:string;role:Role};
export type FarmContact={id:string;name:string;role:string;phone:string;email:string;receiveReports:boolean};
export type Farm={id:string;owner:string;name:string;zone:string;contact:string;role:Role;members:Member[];contacts:FarmContact[]};
export const serviceLabels={assurance:'Aseguramiento',training:'Capacitación',calibration:'Aforo de equipos',followup:'Seguimiento'};
export type Service={id:string;farmId:string;revision:number;kind:keyof typeof serviceLabels;reason:string;date:string;rtc:string;assignee:string;status:'requested'|'scheduled'|'done'|'cancelled'};
export function canEdit(role:string){return role==='manager'||role==='editor';}
export function validDate(value:string){return !value||/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
