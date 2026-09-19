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
fs.mkdirSync(OUT, { recursive: true });
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

await clickText('02 Evaluación');
await wait(1200);
const selectChapter = async (re) => {
  await p.evaluate((src) => {
    const combo = document.querySelector('.form-body button[role="combobox"], .form-body [data-slot="select-trigger"]');
    if (combo) combo.click();
  }, re.source);
  await wait(400);
  const picked = await p.evaluate((src) => {
    const rx = new RegExp(src, 'i');
    const opt = [...document.querySelectorAll('[role="option"]')].find((el) => rx.test(el.textContent || ''));
    if (opt) { opt.click(); return opt.textContent.trim(); }
    return '';
  }, re.source);
  await wait(700);
  return picked;
};
await selectChapter(/Preparación de mezclas|4\./);
await wait(800);
await p.evaluate(() => {
  const set = (el, v) => {
    const proto = HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const byLabel = (re, v) => {
    const labels = [...document.querySelectorAll('label')].filter((el) => re.test(el.textContent || '') && el.querySelector('input'));
    labels.forEach((label) => set(label.querySelector('input'), v));
  };
  byLabel(/pH del agua/i, '6.1');
  byLabel(/Dureza/i, '45');
  byLabel(/Conductividad/i, '0.35');
  byLabel(/pH mezcla final/i, '6.0');
});
check('Las mediciones de agua quedan en el capítulo 4', await p.evaluate(() => {
  const badges = [...document.querySelectorAll('.c360-measure-badge')].map((el) => el.textContent.trim());
  const visiblePh = [...document.querySelectorAll('label')].some((el) => /pH del agua/i.test(el.textContent || '') && el.getClientRects().length > 0);
  const conductivity = [...document.querySelectorAll('label')].some((el) => /Conductividad/i.test(el.textContent || '') && el.getClientRects().length > 0);
  return visiblePh && conductivity && badges.some((b) => /4\.6/.test(b));
}));
await selectChapter(/Aplicación de PPC|5\./);
await wait(800);
await p.evaluate(() => {
  const set = (el, v) => {
    const proto = HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const byLabel = (re, v) => {
    const labels = [...document.querySelectorAll('label')].filter((el) => re.test(el.textContent || '') && el.querySelector('input'));
    labels.forEach((label) => set(label.querySelector('input'), v));
  };
  byLabel(/Presión/i, '80');
  byLabel(/^Equipo de aplicación/i, 'Lanza');
  byLabel(/^Implementos de aplicación/i, 'Estacionaria');
  byLabel(/Volumen por cama/i, '12');
  byLabel(/Tiempo por cama/i, '25');
});
check('Equipo e implementos se escriben a mano', await p.evaluate(() => {
  const noChips = !document.querySelector('.c360-equip-pick');
  const equipo = [...document.querySelectorAll('label')].find((el) => /^Equipo de aplicación/i.test((el.firstChild && el.firstChild.textContent) || '') && el.querySelector('input'));
  const impl = [...document.querySelectorAll('label')].find((el) => /Implementos de aplicación/i.test(el.textContent || '') && el.querySelector('input'));
  const badges = [...document.querySelectorAll('.c360-measure-badge')].map((el) => el.textContent.trim());
  return noChips && !!equipo && !!impl && getComputedStyle(equipo.querySelector('input')).opacity !== '0' && badges.some((b) => /5\./.test(b));
}));

check('La evaluación ya no mezcla el bloque suelto de mediciones', await p.evaluate(() => {
  const heading = [...document.querySelectorAll('.form-body h3')].find((el) => /Mediciones de campo/i.test(el.textContent));
  if (!heading) return true;
  const rect = heading.getClientRects()[0];
  const style = getComputedStyle(heading);
  return !rect || rect.height <= 2 || style.position === 'absolute' || style.display === 'none';
}));
const answered = await p.evaluate(() => {
  const labels = [...document.querySelectorAll('.answer-options label')];
  const yes = labels.filter(l => /sí cumple|^sí$/i.test(l.textContent.trim()));
  yes.slice(0, 20).forEach(l => l.click());
  return yes.length;
});
check('Se pueden responder los criterios de evaluación', answered > 0, answered + ' opciones "Sí cumple"');
await wait(900);

// report preview
await clickText('04 Informe');
await wait(1800);
const report = await p.evaluate(() => document.querySelector('.report-paper')?.innerText || '');
check('La vista previa del informe se genera', /Informe técnico de visita/i.test(report), report.slice(0, 80).replace(/\n/g, ' '));
check('El informe agrupa las mediciones por capítulo MIPE',
  /4\.6/.test(report) && /Calidad del agua/.test(report) && /Conductividad/.test(report) && /0\.35/.test(report)
  && /Lanza/.test(report) && /Estacionaria/.test(report) && /12/.test(report),
  report.replace(/\n/g, ' ').slice(0, 280)
);
await p.evaluate(() => {
  const heading = [...document.querySelectorAll('.report-paper h2')].find((el) => /Mediciones de campo/i.test(el.textContent || ''));
  if (heading) heading.scrollIntoView({ block: 'start' });
});
await wait(400);
await p.screenshot({ path: path.join(OUT, 'informe_mediciones.png') });

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
let wordText = '';
for (const name of fs.readdirSync(OUT)) {
  const file = path.join(OUT, name);
  try {
    const { execFileSync } = await import('child_process');
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (!/Conductividad/.test(xml) && !/Calidad del agua/.test(xml)) continue;
    wordText = xml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    break;
  } catch {
    /* no es un Word */
  }
}
check('El Word lleva las mediciones por capítulo MIPE',
  /4\.6/.test(wordText) && /Conductividad/.test(wordText) && /0\.35/.test(wordText)
  && /Equipo de aplicación/.test(wordText)
  && /Implementos de aplicación/.test(wordText) && /Estacionaria/.test(wordText)
  && /Lanza/.test(wordText),
  wordText.slice(Math.max(0, wordText.indexOf('Calidad del agua')), Math.max(0, wordText.indexOf('Calidad del agua')) + 420)
);
const idx46 = wordText.indexOf('4.6 ·');
const idxAgua = wordText.indexOf('4.6 Calidad del agua');
const idx47 = wordText.indexOf('4.7 ·');
const idx51 = wordText.indexOf('5.1 ·');
const idxPresion = wordText.indexOf('5.1 Presión');
const idx52 = wordText.indexOf('5.2 ·');
check(
  'En el Word la calidad de agua queda después de 4.6 y antes de 4.7',
  idx46 >= 0 && idxAgua > idx46 && (idx47 < 0 || idx47 > idxAgua),
  JSON.stringify({ idx46, idxAgua, idx47 })
);
check(
  'En el Word la presión queda después de 5.1 y antes de 5.2',
  idx51 >= 0 && idxPresion > idx51 && (idx52 < 0 || idx52 > idxPresion),
  JSON.stringify({ idx51, idxPresion, idx52 })
);
check('El Word no incluye observaciones del capítulo', !/Observaciones del capítulo/.test(wordText));
check('El Word corrige la ortografía de calidad de agua', /parámetros adecuados/.test(wordText) && !/parametros/.test(wordText));

check('Sin errores de JavaScript', errors.length === 0, errors.slice(0, 5).join(' | '));

await p.screenshot({ path: path.join(OUT, 'e2e-final.png') });
fs.writeFileSync(path.join(OUT, 'e2e-results.json'), JSON.stringify(results, null, 1));

const passed = results.filter(r => r.ok).length;
console.log('\n' + passed + '/' + results.length + ' comprobaciones correctas');
console.log('Resultados y capturas en ' + OUT);
await b.close();
process.exit(passed === results.length ? 0 : 1);
