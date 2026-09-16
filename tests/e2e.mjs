/*
 * Prueba de extremo a extremo del contenido web de AVGUST CARE 360.
 *
 * Levanta la vista previa (tools/dev-preview.sh o el contenido del APK) y
 * recorre la presentación, los siete módulos, el ciclo completo de una visita,
 * la persistencia de los datos, el respaldo y la descarga del informe Word.
 *
 *   npm install
 *   ../tools/dev-preview.sh &          # sirve en http://localhost:8080
 *   npm test
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const URL = process.env.CARE360_URL || 'http://localhost:8080/index.html';
const OUT = process.env.CARE360_TEST_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'care360-e2e-'));
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
}

const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], protocolTimeout: 40000 });
const p = await b.newPage();
await p.setUserAgent(UA);
await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('[console] ' + m.text().slice(0, 150)); });

const downloads = [];
const client = await p.createCDPSession();
await client.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: OUT, eventsEnabled: true });
client.on('Browser.downloadWillBegin', e => downloads.push(e.suggestedFilename));

const wait = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (txt) => p.evaluate(t => {
  const e = [...document.querySelectorAll('button,a,label,[role=tab]')].find(x => x.textContent.trim().toLowerCase().includes(t.toLowerCase()));
  if (e) { e.scrollIntoView({ block: 'center' }); e.click(); return true; }
  return false;
}, txt);

await p.goto(URL, { waitUntil: 'networkidle2' });
await wait(3200);

// 1. intro
check('La presentación aparece al abrir por primera vez', await p.evaluate(() => !!document.querySelector('.c360-intro[data-open="1"]')));
const slideTitles = [];
for (let i = 0; i < 7; i++) {
  slideTitles.push(await p.evaluate(() => document.querySelector('.c360-slide h2')?.textContent));
  if (i < 6) { await p.click('.c360-intro [data-act="next"]'); await wait(420); }
}
check('La presentación tiene 7 secciones', slideTitles.filter(Boolean).length === 7, slideTitles.join(' | '));
const creditText = await p.evaluate(() => document.querySelector('.c360-intro-body').innerText);
check('Aparece Kevin Villamizar como desarrollador', /Kevin Villamizar/.test(creditText));
check('Aparece la ayuda de Wilson Castro', /creado con la ayuda de Wilson Castro/i.test(creditText));
check('La versión mostrada es la del APK', /1\.4\.2|preview|de desarrollo/.test(creditText), creditText.match(/versión[^\n]*/)?.[0]);

// swipe back
await p.evaluate(() => {
  const body = document.querySelector('.c360-intro-body');
  const t = (type, x) => body.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: body, clientX: x, clientY: 300 })], changedTouches: [new Touch({ identifier: 1, target: body, clientX: x, clientY: 300 })] }));
  t('touchstart', 100); t('touchend', 300);
});
await wait(420);
check('Se puede volver atrás deslizando', await p.evaluate(() => /vive en tu equipo/i.test(document.querySelector('.c360-slide h2')?.textContent || '')), await p.evaluate(() => document.querySelector('.c360-slide h2')?.textContent));

await p.click('.c360-intro [data-act="skip"]');
await wait(800);
check('La presentación se cierra', await p.evaluate(() => !document.querySelector('.c360-intro[data-open="1"]')));

// 2. help button reopens
await p.click('.c360-help-btn');
await wait(600);
check('El botón Guía vuelve a abrir la presentación', await p.evaluate(() => !!document.querySelector('.c360-intro[data-open="1"]')));
await p.keyboard.press('Escape');
await wait(600);
check('Escape cierra la presentación', await p.evaluate(() => !document.querySelector('.c360-intro[data-open="1"]')));

// 3. all modules render
const modules = await p.evaluate(() => [...document.querySelectorAll('.module-nav [role=tab]')].map(t => t.innerText.trim().replace(/\n/g, ' ')));
let allOk = true;
const moduleTexts = [];
for (let i = 0; i < modules.length; i++) {
  await p.evaluate(i => document.querySelectorAll('.module-nav [role=tab]')[i].click(), i);
  await wait(1300);
  const txt = await p.evaluate(() => document.querySelector('.workspace')?.innerText || '');
  moduleTexts.push(modules[i] + ': ' + txt.slice(0, 60).replace(/\n/g, ' '));
  if (txt.trim().length < 40) allOk = false;
}
check('Los 7 módulos muestran contenido', allOk, moduleTexts.join(' || ').slice(0, 300));

await p.evaluate(() => document.querySelectorAll('.module-nav [role=tab]')[2].click());
await wait(900);
const kb = await p.evaluate(() => {
  const input = document.querySelector('.query-search input, .farm-query input[type="search"], .farm-query input:not([type])');
  if (!input) return { found: false };
  input.scrollIntoView({ block: 'center' });
  input.focus();
  return new Promise((resolve) => {
    setTimeout(() => {
      const rect = input.getBoundingClientRect();
      const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--c360-keyboard-h')) || 0;
      const cover = Math.max(h, window.innerHeight * 0.4);
      resolve({
        found: true,
        hasClass: document.documentElement.classList.contains('c360-keyboard'),
        queryTyping: document.documentElement.classList.contains('c360-query-typing'),
        keyboardH: h,
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        inner: window.innerHeight,
        aboveBand: rect.bottom <= window.innerHeight - cover + 12,
      });
    }, 700);
  });
});
check('Consulta: el buscador queda por encima del teclado', !!(kb.found && kb.hasClass && kb.queryTyping && kb.aboveBand), JSON.stringify(kb));
await p.evaluate(() => document.activeElement && document.activeElement.blur());
await wait(300);

// 4. full visit
await p.evaluate(() => document.querySelectorAll('.module-nav [role=tab]')[4].click());
await wait(1200);
check('Se abre el editor de visita', await clickText('Nueva visita'));
await wait(1500);
await p.evaluate(() => {
  const set = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const inputs = [...document.querySelectorAll('.editor input')];
  inputs.forEach(el => {
    if (el.type === 'date') set(el, '2026-05-20');
    else if (el.type === 'text' && !el.value) set(el, 'Finca Los Rosales');
  });
});
await wait(900);
check('El indicador avisa de cambios sin guardar', await p.evaluate(() => /sin guardar/i.test(document.querySelector('.saved-status')?.textContent || '')));

await clickText('02 Mediciones');
await wait(900);
await p.evaluate(() => {
  const set = (el, v) => {
    const proto = HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const byLabel = (re, v) => {
    const label = [...document.querySelectorAll('label')].find((el) => re.test(el.textContent || '') && el.querySelector('input'));
    if (label) set(label.querySelector('input'), v);
  };
  byLabel(/pH del agua/i, '6.1');
  byLabel(/Dureza/i, '45');
  byLabel(/Conductividad/i, '0.35');
  byLabel(/Presión/i, '80');
  byLabel(/Bomba \/ implemento|implemento/i, 'Bomba 3 pistones');
  byLabel(/Volumen por cama/i, '12');
  byLabel(/Tiempo por cama/i, '25');
});
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('.c360-equip-pick')].find((el) => el.textContent.trim() === 'Lanza');
  if (btn) btn.click();
});
await wait(400);
check('Las mediciones se agrupan por capítulo MIPE', await p.evaluate(() => {
  const badges = [...document.querySelectorAll('.c360-measure-badge')].map((el) => el.textContent.trim());
  const visiblePh = [...document.querySelectorAll('label')].some((el) => /pH del agua/i.test(el.textContent || '') && el.getClientRects().length > 0);
  const conductivity = [...document.querySelectorAll('label')].some((el) => /Conductividad/i.test(el.textContent || '') && el.getClientRects().length > 0);
  return visiblePh && conductivity && badges.includes('Cap. 4 · 4.6') && badges.includes('Cap. 5 · 5.1') && badges.includes('Cap. 5 · 5.6');
}));
check('El equipo de aplicación ofrece lanza o aguilón', await p.evaluate(() => {
  return [...document.querySelectorAll('.c360-equip-pick')].map((el) => el.textContent.trim()).join(' ') === 'Lanza Aguilón';
}));

// answer a criterion in step 03
await clickText('03 Evaluación');
await wait(1200);
check('La evaluación ya no mezcla las mediciones', await p.evaluate(() => {
  const heading = [...document.querySelectorAll('.form-body h3')].find((el) => /Mediciones de campo/i.test(el.textContent));
  return !heading || heading.getClientRects().length === 0;
}));
const answered = await p.evaluate(() => {
  const labels = [...document.querySelectorAll('.answer-options label')];
  const yes = labels.filter(l => /^Sí$/i.test(l.textContent.trim()));
  yes.slice(0, 20).forEach(l => l.click());
  return yes.length;
});
check('Se pueden responder los criterios de evaluación', answered > 0, answered + ' opciones "Sí"');
await wait(900);

// report preview
await clickText('05 Informe');
await wait(1800);
const report = await p.evaluate(() => document.querySelector('.report-paper')?.innerText || '');
check('La vista previa del informe se genera', /Informe técnico de visita/i.test(report), report.slice(0, 80).replace(/\n/g, ' '));
check('El informe agrupa las mediciones por capítulo MIPE',
  /Cap\. 4 · 4\.6/.test(report) && /Calidad del agua/.test(report) && /Conductividad/.test(report) && /0\.35/.test(report)
  && /Cap\. 5 · 5\.1/.test(report) && /80/.test(report)
  && /Anexo/.test(report) && /Bomba 3 pistones/.test(report)
  && /Cap\. 5 · 5\.6/.test(report) && /12/.test(report)
  && /Lanza/.test(report),
  report.match(/Mediciones de campo[\s\S]{0,700}/)?.[0]?.replace(/\n/g, ' | ')
);

// save
check('Se guarda la visita', await clickText('Guardar visita'));
await wait(3500);
await p.evaluate(() => document.querySelectorAll('.module-nav [role=tab]')[0].click());
await wait(1500);
const homeText = await p.evaluate(() => document.querySelector('.workspace')?.innerText || '');
check('La visita queda registrada', /1\nVisitas registradas/.test(homeText), homeText.split('\n').slice(0, 16).join(' ').slice(0, 120));

// 5. persistence after reload
await p.reload({ waitUntil: 'networkidle2' });
await wait(3500);
check('La presentación no se repite tras cerrarla', await p.evaluate(() => !document.querySelector('.c360-intro[data-open="1"]')));
const afterReload = await p.evaluate(() => document.querySelector('.workspace')?.innerText || '');
check('Los datos siguen guardados tras reiniciar', /Visitas registradas/.test(afterReload) && !/^0\nVisitas registradas/.test(afterReload.trim()), afterReload.split('\n').slice(0, 14).join(' ').slice(0, 140));

// 6. theme
await p.evaluate(() => document.querySelector('.theme-toggle').click());
await wait(700);
check('El modo oscuro se activa', await p.evaluate(() => document.documentElement.classList.contains('dark')));
await p.reload({ waitUntil: 'networkidle2' });
await wait(3000);
check('El modo oscuro se conserva', await p.evaluate(() => document.documentElement.classList.contains('dark')));
await p.evaluate(() => document.querySelector('.theme-toggle').click());
await wait(600);

// 7. backup download
await p.evaluate(() => document.querySelectorAll('.module-nav [role=tab]')[0].click());
await wait(1000);
await clickText('Crear respaldo completo');
await wait(4000);
check('El respaldo completo se genera', downloads.length > 0, downloads.join(', ') || 'sin descargas');

// 8. word download from saved visit
await p.evaluate(() => document.querySelectorAll('.module-nav [role=tab]')[4].click());
await wait(1500);
const opened = await p.evaluate(() => {
  const row = document.querySelector('.visit-row');
  if (!row) return false;
  const target = row.querySelector('button, a') || row;
  target.click();
  return true;
});
await wait(2500);
if (opened) {
  await p.evaluate(() => { const t = [...document.querySelectorAll('.steps [role=tab]')]; if (t[3]) t[3].click(); });
  await wait(2000);
  await clickText('Descargar Word');
  await wait(6000);
}
check('Se descarga el informe en Word', downloads.some(d => /\.docx$/i.test(d)), downloads.join(', '));
const docxFiles = fs.readdirSync(OUT).filter((name) => /\.docx$/i.test(name));
let wordText = '';
if (docxFiles.length) {
  try {
    const { execSync } = await import('child_process');
    wordText = execSync(`unzip -p ${JSON.stringify(path.join(OUT, docxFiles[0]))} word/document.xml`, { encoding: 'utf8' })
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ');
  } catch (err) {
    wordText = String(err);
  }
}
check('El Word lleva las mediciones por capítulo MIPE',
  /Cap\. 4 · 4\.6/.test(wordText) && /Conductividad/.test(wordText) && /0\.35/.test(wordText)
  && /Cap\. 5 · 5\.1/.test(wordText) && /Anexo/.test(wordText) && /Cap\. 5 · 5\.6/.test(wordText)
  && /Lanza/.test(wordText),
  wordText.slice(Math.max(0, wordText.indexOf('Mediciones de campo')), Math.max(0, wordText.indexOf('Mediciones de campo')) + 420)
);

check('Sin errores de JavaScript', errors.length === 0, errors.slice(0, 5).join(' | '));

await p.screenshot({ path: path.join(OUT, 'e2e-final.png') });
fs.writeFileSync(path.join(OUT, 'e2e-results.json'), JSON.stringify(results, null, 1));

const passed = results.filter(r => r.ok).length;
console.log('\n' + passed + '/' + results.length + ' comprobaciones correctas');
console.log('Resultados y capturas en ' + OUT);
await b.close();
process.exit(passed === results.length ? 0 : 1);
