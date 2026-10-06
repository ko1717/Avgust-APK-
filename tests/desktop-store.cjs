const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Store}=require('../desktop/store.cjs');
async function main(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'care-store-'));
 let store;
 try{
  store=new Store(directory);
  const contacts=[{name:'Contacto',role:'Administración',phone:'3000000000',email:'contacto@finca.test',receiveReports:true}];
  const farm=store.changeTeam({op:'create',name:'Finca Prueba',zone:'Sabana',contacts});
  const person=store.changeTeam({op:'addLocal',farmId:farm.id,name:'Ingeniera'});
  const request=store.saveRequest({id:'',revision:0,farmId:farm.id,kind:'training',reason:'Capacitación',date:'2026-09-08',rtc:'',assignee:person.id,status:'scheduled'});
  const visit=store.saveVisit({id:'',revision:0,farmId:farm.id,requestId:request.id,serviceKind:'training',farm:'Finca Prueba',date:'2026-09-08',city:'',zone:'',technician:'Contacto',responsible:'Ingeniera',rtc:'',chapters:[],answers:{},notes:{},recommendations:{},measurements:{},delivery:'',followup:'',conclusion:'Actividad realizada',photos:[],reviewed:true});
  assert.equal(visit.farm,'Finca Prueba');
  const reportDraft=store.changeReport({op:'create',visitId:visit.id});assert.equal(reportDraft.status,'draft');
  const submitted=store.changeReport({op:'submit',id:reportDraft.id,revision:reportDraft.revision});assert.equal(submitted.status,'in_review');assert.equal(store.report(reportDraft.id).snapshot.content.conclusion,'Actividad realizada');
  const changed=store.saveVisit({...visit,conclusion:'Actividad corregida'});assert.throws(()=>store.changeReport({op:'approve',id:submitted.id,revision:submitted.revision}),/cambió después del envío/);
  const returned=store.changeReport({op:'return',id:submitted.id,revision:submitted.revision});const resent=store.changeReport({op:'submit',id:returned.id,revision:returned.revision});const approved=store.changeReport({op:'approve',id:resent.id,revision:resent.revision});const published=store.changeReport({op:'publish',id:approved.id,revision:approved.revision});assert.equal(published.status,'published');assert.equal(store.report(published.id).snapshot.content.conclusion,'Actividad corregida');
   const v2=store.changeReport({op:'new_version',visitId:changed.id});assert.equal(v2.versionNumber,2);assert.equal(store.reports(visit.id).versions.length,2);
   store.deleteReport(v2.id);assert.equal(store.reports(visit.id).versions.length,1);
   const metricA=store.saveVisit({id:'',revision:0,farmId:farm.id,serviceKind:'assurance',farm:'Finca Prueba',date:'2026-09-10',city:'',zone:'',technician:'Contacto',responsible:'Ingeniera',rtc:'',chapters:[3],answers:{'3.1':{value:'SI',observation:'',recommendation:''},'3.2':{value:'SI',observation:'',recommendation:''},'3.3':{value:'NO',observation:'Sin cierre',recommendation:'Asegurar el cierre'},'3.4':{value:'NA',observation:'',recommendation:''}},notes:{},recommendations:{},measurements:{ph:'6.40',pressure:'30',volume:'0',equipment:'Jacto XP'},delivery:'',followup:'',conclusion:'',photos:[],actions:{},reviewed:true});
   const metricB=store.saveVisit({id:'',revision:0,farmId:farm.id,serviceKind:'assurance',farm:'Finca Prueba',date:'2026-10-10',city:'',zone:'',technician:'Contacto',responsible:'Ingeniera',rtc:'',chapters:[3],answers:{'3.1':{value:'SI',observation:'',recommendation:''},'3.2':{value:'SI',observation:'',recommendation:''},'3.3':{value:'SI',observation:'',recommendation:''},'3.4':{value:'NA',observation:'',recommendation:''}},notes:{},recommendations:{},measurements:{ph:'6.10',pressure:'32',volume:'2',equipment:'Jacto XP'},delivery:'',followup:'',conclusion:'',photos:[],actions:{},reviewed:true});
   const metricPage=store.metricHistory(farm.id,'ph',{limit:1});assert.equal(metricPage.points.length,1);assert.ok(metricPage.nextCursor);const priorMetricPage=store.metricHistory(farm.id,'ph',{limit:1,cursor:metricPage.nextCursor});assert.equal(priorMetricPage.points[0].originalValue,'6.40');
   const metricComparison=store.compareMetrics(farm.id,{visitAId:metricA.id,visitBId:metricB.id});assert.equal(metricComparison.comparisons.find(item=>item.metric.id==='ph').comparison.delta,-0.3);assert.equal(metricComparison.comparisons.find(item=>item.metric.id==='compliance').comparison.differenceLabel,'+33 puntos porcentuales');assert.equal(metricComparison.comparisons.find(item=>item.metric.id==='volume').comparison.relativeChange,null);assert.equal(metricComparison.comparisons.find(item=>item.metric.id==='equipment').comparison.change,'same');
   const backup=path.join(directory,'respaldo.care360');
  await store.snapshot(backup);store.inspect(backup);
  store.saveDraft({...visit,conclusion:'Borrador local'});
  await store.restore(backup);
   assert.equal(store.visits().length,3);
  assert.equal(store.draft(),null);
  assert.equal(store.team().farms[0].members.length,2);
  assert.equal(store.team().farms[0].contacts[0].email,'contacto@finca.test');
  assert.equal(store.reports(visit.id).versions.length,1);
  store.deleteVisit(store.visits().find(item=>item.date==='2026-10-10').id);assert.equal(store.visits().length,2);
  store.deleteFarm(farm.id);assert.equal(store.team().farms.length,0);assert.equal(store.visits().length,0);
   console.log('PASS: datos locales, historial y comparación de métricas, versiones de informe, respaldo y restauración');
 }finally{store?.close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
