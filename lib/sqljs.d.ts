declare module 'sql.js' {
 export type SqlValue=string|number|null|Uint8Array;
 export class Statement{
  bind(values?:SqlValue[]):boolean;
  step():boolean;
  getAsObject():Record<string,SqlValue>;
  free():boolean;
 }
 export class Database{
  constructor(data?:ArrayLike<number>|Buffer);
  run(sql:string,params?:SqlValue[]):Database;
  exec(sql:string):unknown[];
  prepare(sql:string):Statement;
  export():Uint8Array;
  close():void;
  getRowsModified():number;
 }
 export type SqlJsStatic={Database:typeof Database};
 export default function initSqlJs(config?:{locateFile?:(file:string)=>string;wasmBinary?:ArrayBuffer}):Promise<SqlJsStatic>;
}
