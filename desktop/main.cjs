const {app,BrowserWindow,ipcMain,dialog,shell,Menu}=require('electron');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {Store}=require('./store.cjs');
const preview=process.argv.includes('--preview');
app.setName(preview?'AVGUST CARE 360 · Vista previa':'AVGUST CARE 360');
app.setPath('userData',path.join(app.getPath('appData'),preview?'AVGUST CARE 360 - Vista previa':'AVGUST CARE 360'));
const smokeArg=process.argv.find(x=>x.startsWith('--smoke-test='));
const smokePath=smokeArg?.slice('--smoke-test='.length);
const trace=()=>{};
if(smokePath)app.disableHardwareAcceleration();
if(smokePath)app.setPath('userData',path.join(path.dirname(smokePath),'smoke-data'));
let win,store,localServer,localUrl='';
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'";
const headers={'Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json'}});
async function serve(req){try{trace({request:req.url,method:req.method});
 const url=new URL(req.url);if(url.hostname!=='127.0.0.1')return json({error:'Origen inválido.'},403);
 const route=url.pathname;
 if(route.startsWith('/api/')){
  if(req.method==='GET'){
   if(route==='/api/team')return json(store.team());if(route==='/api/requests')return json(store.requests());if(route==='/api/visits')return json(store.visits());if(route==='/api/draft')return json(store.draft());if(route==='/api/reports')return json(store.reports(url.searchParams.get('visitId')||''));if(route.startsWith('/api/reports/'))return json(store.report(route.slice('/api/reports/'.length)));
   const metricMatch=/^\/api\/farms\/([a-f0-9-]{36})\/metrics$/.exec(route);if(metricMatch)return json(store.metricHistory(metricMatch[1],url.searchParams.get('metric')||'',Object.fromEntries(url.searchParams)));
   if(route.startsWith('/api/photos/')){const p=store.photo(route.slice('/api/photos/'.length));return new Response(p.data,{headers:{...headers,'Content-Type':p.mime}});}
  }
  if(req.method==='DELETE'){
   if(route==='/api/draft')return json(store.clearDraft());
   const farmDel=/^\/api\/farms\/([a-f0-9-]{36})$/.exec(route);if(farmDel)return json(store.deleteFarm(farmDel[1]));
   const visitDel=/^\/api\/visits\/([a-f0-9-]{36})$/.exec(route);if(visitDel)return json(store.deleteVisit(visitDel[1]));
   const reportDel=/^\/api\/reports\/([a-f0-9-]{36})$/.exec(route);if(reportDel)return json(store.deleteReport(reportDel[1]));
   const requestDel=/^\/api\/requests\/([a-f0-9-]{36})$/.exec(route);if(requestDel)return json(store.deleteRequest(requestDel[1]));
  }
  if(req.method==='POST'){
   const bytes=Buffer.from(await req.arrayBuffer());if(bytes.length>(route==='/api/photos'?8*1024*1024:500000))return json({error:'El archivo supera el tamaño permitido.'},413);
   if(route==='/api/photos')return json(store.savePhoto(bytes,url.searchParams.get('farmId')));
   let x;try{x=JSON.parse(bytes.toString('utf8'));if(!x||typeof x!=='object'||Array.isArray(x))throw new Error();}catch{return json({error:'Datos inválidos.'},400);}
   const compareMatch=/^\/api\/farms\/([a-f0-9-]{36})\/metrics\/compare$/.exec(route);if(compareMatch)return json(store.compareMetrics(compareMatch[1],x));
   if(route==='/api/team')return json(store.changeTeam(x));if(route==='/api/requests')return json(store.saveRequest(x));if(route==='/api/visits')return json(store.saveVisit(x));if(route==='/api/draft')return json(store.saveDraft(x));if(route==='/api/reports')return json(store.changeReport(x));
  }
  return json({error:'Operación no disponible.'},404);
 }
 if(req.method!=='GET')return json({error:'Método no permitido.'},405);
 const root=path.join(__dirname,'ui');const filename=path.resolve(root,'.'+decodeURIComponent(route==='/'?'/index.html':route));trace({root,filename,inside:filename.startsWith(root+path.sep),exists:fs.existsSync(filename)});if(!filename.startsWith(root+path.sep))return json({error:'Ruta inválida.'},403);
 if(!fs.existsSync(filename)||!fs.statSync(filename).isFile())return json({error:'Archivo no encontrado.'},404);
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'};
 trace({staticFile:filename,contentType:types[path.extname(filename)]||'application/octet-stream'});return new Response(fs.readFileSync(filename),{headers:{...headers,'Content-Type':types[path.extname(filename)]||'application/octet-stream'}});
 }catch(e){trace({handlerError:e.message,stack:e.stack});const match=/^(400|403|404|409|413|422):(.+)$/.exec(e.message);if(!match)console.error(e);return json({error:match?match[2]:'No se pudo completar la operación local. Conserva tus cambios e inténtalo de nuevo.'},match?Number(match[1]):500);}}
async function startLocalServer(){localServer=http.createServer((request,response)=>{const chunks=[];request.on('data',chunk=>chunks.push(chunk));request.on('end',async()=>{try{if(request.method!=='GET'&&request.method!=='HEAD'&&request.headers.origin!==localUrl){response.writeHead(403);response.end();return;}const body=chunks.length?Buffer.concat(chunks):undefined;const incoming=new Request(localUrl+request.url,{method:request.method,headers:request.headers,body:body&&request.method!=='GET'&&request.method!=='HEAD'?body:undefined});const outgoing=await serve(incoming);const data=Buffer.from(await outgoing.arrayBuffer());response.writeHead(outgoing.status,Object.fromEntries(outgoing.headers));response.end(data);trace({sent:request.url,status:outgoing.status,bytes:data.length});}catch(error){trace({serverError:error.message,stack:error.stack});console.error(error);response.writeHead(500);response.end();}});});await new Promise((resolve,reject)=>{localServer.once('error',reject);localServer.listen(0,'127.0.0.1',()=>{localServer.off('error',reject);resolve();});});localUrl='http://127.0.0.1:'+localServer.address().port;}
function trusted(event){if(event.sender!==win?.webContents||!event.senderFrame?.url.startsWith(localUrl+'/'))throw new Error('Solicitud no autorizada.');}
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 app.whenReady().then(async()=>{
  store=new Store(app.getPath('userData'));
  await startLocalServer();
  win=new BrowserWindow({width:1360,height:900,minWidth:800,minHeight:600,show:false,title:'AVGUST CARE 360',backgroundColor:'#f5f5f6',icon:path.join(__dirname,'icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:!app.isPackaged}});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Archivo',submenu:[{label:'Salir',role:'quit'}]},{label:'Editar',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'Ver',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}]));
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url.startsWith('mailto:')){event.preventDefault();void shell.openExternal(url);return;}if(!url.startsWith(localUrl+'/'))event.preventDefault();});
  win.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
  win.webContents.session.setPermissionCheckHandler(()=>false);
  win.webContents.on('will-prevent-unload',event=>{const choice=dialog.showMessageBoxSync(win,{type:'question',buttons:['Continuar trabajando','Salir sin guardar'],defaultId:0,cancelId:0,title:'Visita en edición',message:'Hay cambios sin guardar. ¿Quieres salir?',detail:'La copia automática permite recuperar el último borrador guardado localmente.'});if(choice===1)event.preventDefault();});
  win.webContents.session.on('will-download',(_event,item)=>{const filename=path.basename(item.getFilename()).replace(/[<>:"/\\|?*]/g,'_');item.setSaveDialogOptions({title:'Guardar informe',defaultPath:path.join(app.getPath('documents'),filename)});});
  ipcMain.handle('care:backup',async event=>{trusted(event);const choice=await dialog.showSaveDialog(win,{title:'Crear respaldo completo',defaultPath:'AVGUST-CARE-'+new Date().toISOString().slice(0,10)+'.care360',filters:[{name:'Respaldo AVGUST CARE',extensions:['care360']}]});if(choice.canceled)return {cancelled:true};try{await store.snapshot(choice.filePath);return {message:'Respaldo completo guardado, incluidas las fotografías.'};}catch(e){return {error:e.message};}});
  ipcMain.handle('care:restore',async event=>{trusted(event);const choice=await dialog.showOpenDialog(win,{title:'Restaurar respaldo',properties:['openFile'],filters:[{name:'Respaldo AVGUST CARE',extensions:['care360']}]});if(choice.canceled)return {cancelled:true};try{store.inspect(choice.filePaths[0]);const confirm=await dialog.showMessageBox(win,{type:'warning',buttons:['Cancelar','Restaurar'],defaultId:0,cancelId:0,message:'El respaldo reemplazará los datos de esta aplicación.',detail:'Antes se conservará una copia completa de los datos actuales en la carpeta de datos.'});if(confirm.response!==1)return {cancelled:true};await store.restore(choice.filePaths[0]);setTimeout(()=>win.webContents.reload(),100);return {message:'Respaldo restaurado.'};}catch(e){return {error:'No se restauró el archivo: '+e.message};}});
  ipcMain.handle('care:open-data',async event=>{trusted(event);await shell.openPath(app.getPath('userData'));return {message:'Carpeta de datos abierta.'};});
  win.once('ready-to-show',()=>{if(!smokePath)win.show();});
  await win.loadURL(localUrl+'/');
  if(smokePath){try{const result=await win.webContents.executeJavaScript(`(async()=>{await new Promise(r=>setTimeout(r,1200));const root=document.getElementById('root');const home=root.innerText;const tabs=Array.from(document.querySelectorAll('.module-nav [role=tab]')).map(x=>x.textContent);const team=await fetch('/api/team').then(r=>r.json());const logo=document.querySelector('.brand img');const required=['Inicio','Fincas y equipo','Consulta de finca','Solicitudes','Visitas e informes','Métricas','Seguimiento'];const missing=required.filter(label=>!tabs.some(tab=>tab.includes(label)));const problems=[];if(!home.includes('Inicio'))problems.push('la portada no muestra Inicio');if(missing.length)problems.push('faltan funciones en la navegación: '+missing.join(', '));if(!logo.complete||!logo.naturalWidth)problems.push('el logotipo no se cargó');if(document.querySelector('a[href*="signin"]'))problems.push('aparece un enlace de inicio de sesión');if(problems.length)throw new Error(problems.join(' | '));return {title:document.title,tabs,localUser:team.userId,logoWidth:logo.naturalWidth,bridge:typeof window.careDesktop.backup,origin:location.origin};})()`);fs.writeFileSync(smokePath,JSON.stringify({ok:true,result,electron:process.versions.electron,node:process.versions.node},null,2));app.exit(0);}catch(e){fs.writeFileSync(smokePath,JSON.stringify({ok:false,error:e.message}));app.exit(1);}}
 }).catch(e=>{if(smokePath)fs.writeFileSync(smokePath,JSON.stringify({ok:false,error:e.message}));else dialog.showErrorBox('AVGUST CARE 360',e.message);app.exit(1);});
 app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>{try{localServer?.close();store?.close();}catch{}});
}
