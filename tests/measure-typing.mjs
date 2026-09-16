import puppeteer from 'puppeteer';
import fs from 'fs';
const OUT='/opt/cursor/artifacts/measure-typing-test';
fs.mkdirSync(OUT,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
const p=await b.newPage();
await p.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto('http://127.0.0.1:8080/index.html',{waitUntil:'networkidle2'});
await wait(2500);
await p.evaluate(()=>document.querySelector('.c360-intro [data-act="skip"]')?.click());
await wait(700);
await p.evaluate(i=>document.querySelectorAll('.module-nav [role=tab]')[i].click(),4);
await wait(900);
await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/Nueva visita/i.test(b.textContent||''))?.click());
await wait(1400);
await p.evaluate(()=>{
  [...document.querySelectorAll('.chapter-choice')].forEach(el=>{
    const text=el.textContent||'';
    const want=/Preparación de mezclas|Aplicación de PPC/i.test(text);
    const checked=el.classList.contains('chosen')||el.querySelector('[data-state="checked"],[aria-checked="true"]');
    if(want&&!checked) el.click();
    if(!want&&checked) el.click();
  });
});
await wait(400);
await p.evaluate(()=>[...document.querySelectorAll('.steps [role=tab]')].find(t=>/Evaluación/i.test(t.textContent||''))?.click());
await wait(1200);
await p.evaluate(async()=>{
  const trigger=[...document.querySelectorAll('button[role=combobox],[data-slot=select-trigger]')].find(b=>/Capítulo|Preparación|Aplicación|Almacén/i.test(b.textContent||''));
  if(!trigger) return;
  if(!/Preparación de mezclas/i.test(trigger.textContent||'')){
    trigger.click();
    await new Promise(r=>setTimeout(r,400));
    const opt=[...document.querySelectorAll('[role=option],[data-slot=select-item]')].find(el=>/Preparación de mezclas/i.test(el.textContent||''));
    if(opt) opt.click();
  }
});
await wait(1000);

async function typeInProxy(group, labelRe, value){
  const handle = await p.evaluateHandle((group, labelRe, value)=>{
    const box=document.querySelector(`.c360-chapter-measure[data-group="${group}"]`);
    if(!box) return null;
    const re=new RegExp(labelRe,'i');
    const label=[...box.querySelectorAll('label')].find(l=>re.test(l.textContent||''));
    const input=label?.querySelector('input.c360-measure-proxy');
    if(!input) return null;
    input.focus();
    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    return input;
  }, group, labelRe, value);
  const el = handle.asElement();
  if(!el) return {ok:false, reason:'no input'};
  await el.click({clickCount:3});
  await p.keyboard.type(value, {delay: 40});
  await wait(300);
  return p.evaluate((group, labelRe)=>{
    const box=document.querySelector(`.c360-chapter-measure[data-group="${group}"]`);
    const re=new RegExp(labelRe,'i');
    const proxy=[...box.querySelectorAll('label')].find(l=>re.test(l.textContent||''))?.querySelector('input');
    const sourceHeading=[...document.querySelectorAll('h3')].find(h=>/Mediciones de campo/i.test(h.textContent||''));
    let sourceFields=sourceHeading?.nextElementSibling;
    if(sourceFields?.classList.contains('c360-measure-lead')) sourceFields=sourceFields.nextElementSibling;
    const source=[...sourceFields?.querySelectorAll('label')||[]].find(l=>re.test((l.childNodes[0]?.textContent||l.textContent||'')))?.querySelector('input');
    return {
      ok: !!proxy && proxy.value.length>0 && !!source && source.value===proxy.value,
      proxy: proxy?.value||'',
      source: source?.value||'',
      active: document.activeElement===proxy
    };
  }, group, labelRe);
}

const ph = await typeInProxy('agua','pH del agua','6.25');
console.log('PASS/FAIL agua', ph);
const mix = await typeInProxy('mezcla','pH mezcla final','5.90');
console.log('PASS/FAIL mezcla', mix);
await p.evaluate(()=>document.querySelector('.c360-chapter-measure[data-group="mezcla"]')?.scrollIntoView({block:'center'}));
await wait(200);
await p.screenshot({path:OUT+'/mezcla_final_editable.png'});
await p.evaluate(()=>document.querySelector('.c360-chapter-measure[data-group="agua"]')?.scrollIntoView({block:'center'}));
await wait(200);
await p.screenshot({path:OUT+'/calidad_agua_editable.png'});
fs.copyFileSync(OUT+'/mezcla_final_editable.png','/opt/cursor/artifacts/mezcla_final_editable.png');
fs.copyFileSync(OUT+'/calidad_agua_editable.png','/opt/cursor/artifacts/calidad_agua_editable.png');
const ok = ph.ok && mix.ok;
console.log(ok?'ALL PASS':'FAILED', {ph, mix});
await b.close();
process.exit(ok?0:1);
