/*
 * Informe: mediciones junto al ítem, sin observaciones de capítulo.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const URL = process.env.CARE360_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.CARE360_TEST_OUT || '/opt/cursor/artifacts/report-word-test';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, extra) => {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], protocolTimeout: 40000 });
const p = await b.newPage();
await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const downloads = [];
const client = await p.createCDPSession();
await client.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: OUT, eventsEnabled: true });
client.on('Browser.downloadWillBegin', (e) => downloads.push(e.suggestedFilename));

await p.goto(URL, { waitUntil: 'networkidle2' });
await wait(2800);
await p.evaluate(() => document.querySelector('.c360-intro [data-act="skip"]')?.click());
await wait(800);

await p.evaluate(() => {
  const tabs = [...document.querySelectorAll('.module-nav [role=tab], .module-nav button, nav [role=tab]')];
  const visitas = tabs.find((t) => /Visitas/i.test(t.textContent || '')) || tabs[4];
  visitas?.click();
});
await wait(1000);
await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Nueva visita/i.test(b.textContent || ''))?.click());
await wait(1600);

await p.evaluate(() => {
  const set = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  [...document.querySelectorAll('.editor input')].forEach((el) => {
    if (el.type === 'date') set(el, '2026-09-19');
    else if ((el.type === 'text' || !el.type) && !el.value) set(el, 'Finca Los Rosales');
  });
  const choices = [...document.querySelectorAll('.chapter-choice')];
  choices.forEach((el) => {
    const text = el.textContent || '';
    const want = /Preparación de mezclas|Aplicación de PPC/i.test(text);
    const checked = el.classList.contains('chosen') || el.querySelector('[data-state="checked"], [aria-checked="true"]');
    if (want && !checked) el.click();
    if (!want && checked) el.click();
  });
});
await wait(500);

await p.evaluate(() => [...document.querySelectorAll('.steps [role=tab]')].find((t) => /Evaluación/i.test(t.textContent || ''))?.click());
await wait(1500);

const pickChapter = async (re) => {
  await p.evaluate(async (src) => {
    const trigger = [...document.querySelectorAll('button[role=combobox], [data-slot=select-trigger]')].find((b) =>
      /Capítulo|Preparación|Aplicación|Almacén|Medición|Transporte/i.test(b.textContent || '')
    );
    if (!trigger) return;
    if (!new RegExp(src, 'i').test(trigger.textContent || '')) {
      trigger.click();
      await new Promise((r) => setTimeout(r, 400));
      const opt = [...document.querySelectorAll('[role=option], [data-slot=select-item]')].find((el) =>
        new RegExp(src, 'i').test(el.textContent || '')
      );
      if (opt) opt.click();
    }
  }, re.source);
  await wait(1000);
};

await pickChapter(/Preparación de mezclas/);

const eval4 = await p.evaluate(() => {
  const set = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const byLabel = (re, v) => {
    [...document.querySelectorAll('label')]
      .filter((el) => re.test(el.textContent || '') && el.querySelector('input, textarea'))
      .forEach((label) => set(label.querySelector('input, textarea'), v));
  };
  byLabel(/pH del agua/i, '5.8');
  byLabel(/^Dureza/i, '<50');
  byLabel(/^Conductividad$/i, '0.25 mS/cm');
  byLabel(/pH mezcla final/i, '5.8');
  byLabel(/Conductividad mezcla final/i, '0.25 mS/cm');
  const notes = document.querySelector('.fields.chapter-notes textarea');
  if (notes) set(notes, 'Esta observación de capítulo no debe salir en el informe.');
  const q46 = [...document.querySelectorAll('.question')].find((q) => q.querySelector('.question-code')?.textContent.trim() === '4.6');
  const yes = q46 && [...q46.querySelectorAll('label')].find((l) => /sí cumple|^sí$/i.test(l.textContent.trim()));
  yes?.click();
  return {
    notesHidden: !notes || getComputedStyle(notes.closest('.fields.chapter-notes')).display === 'none' || notes.closest('.fields.chapter-notes').hidden,
    text46: (q46 && q46.textContent) || '',
  };
});
check('El recuadro de observaciones de capítulo está oculto', !!eval4.notesHidden);
check('El criterio 4.6 tiene ortografía corregida', /parámetros/.test(eval4.text46) && !/parametros/.test(eval4.text46) && !/\*\*/.test(eval4.text46), eval4.text46.slice(0, 180));

await pickChapter(/Aplicación de PPC/);
await p.evaluate(() => {
  const set = (el, v) => {
    const proto = HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const byLabel = (re, v) => {
    [...document.querySelectorAll('label')]
      .filter((el) => re.test(el.textContent || '') && el.querySelector('input'))
      .forEach((label) => set(label.querySelector('input'), v));
  };
  byLabel(/Presión de la bomba|Presión \(PSI\)/i, '145');
  byLabel(/implemento/i, '60');
  byLabel(/^Equipo de aplicación/i, 'Bomba móvil');
  byLabel(/Implementos de aplicación/i, 'Aguilón 8 salidas');
  byLabel(/Volumen por cama/i, '10');
  byLabel(/Tiempo por cama/i, '60');
  [...document.querySelectorAll('.answer-options label')]
    .filter((l) => /sí cumple|^sí$/i.test(l.textContent.trim()))
    .slice(0, 12)
    .forEach((l) => l.click());
});
await wait(800);

await p.evaluate(() => [...document.querySelectorAll('.steps [role=tab]')].find((t) => /Informe/i.test(t.textContent || ''))?.click());
await wait(2000);

const report = await p.evaluate(() => document.querySelector('.report-paper')?.innerText || '');
check('La vista previa no muestra observaciones del capítulo', !/Observaciones del capítulo/.test(report));
check('La vista previa no arrastra el texto de observaciones de capítulo', !/no debe salir en el informe/.test(report));
check('La vista previa muestra calidad de agua', /Calidad del agua/.test(report) && /5\.8/.test(report));
check('La vista previa corrige parámetros', /parámetros/.test(report) && !/parametros/.test(report));

const orderHtml = await p.evaluate(() => {
  const paper = document.querySelector('.report-paper');
  if (!paper) return {};
  const nodes = [...paper.querySelectorAll('h2, h3, .c360-report-chapter-measures')];
  const texts = nodes.map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim());
  const idx = (re) => texts.findIndex((t) => re.test(t));
  return {
    texts: texts.filter((t) => /4\.6|4\.7|5\.1|5\.2|Calidad|Mezcla|Presión|Observaciones/.test(t)),
    i46: idx(/^4\.6\s*·/),
    iAgua: idx(/Calidad del agua/),
    i47: idx(/^4\.7\s*·/),
    i51: idx(/^5\.1\s*·/),
    iPresion: idx(/Presión/),
    i52: idx(/^5\.2\s*·/),
  };
});
check(
  'En la vista previa el agua queda después de 4.6 y antes de 4.7',
  orderHtml.i46 >= 0 && orderHtml.iAgua > orderHtml.i46 && (orderHtml.i47 < 0 || orderHtml.i47 > orderHtml.iAgua),
  JSON.stringify(orderHtml)
);

await p.evaluate(() => {
  const agua = [...document.querySelectorAll('.report-paper h3, .c360-report-chapter-measures')].find((el) =>
    /Calidad del agua|4\.6/.test(el.textContent || '')
  );
  agua?.scrollIntoView({ block: 'center' });
});
await wait(400);
await p.screenshot({ path: path.join(OUT, 'informe_cap4_calidad_agua.png'), fullPage: false });

const clickedWord = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button, a')].find((el) => /Descargar Word/i.test(el.textContent || ''));
  if (!btn) return false;
  btn.click();
  return true;
});
check('Se encontró el botón Descargar Word', clickedWord);
await wait(7000);

let wordText = '';
for (const name of fs.readdirSync(OUT)) {
  const file = path.join(OUT, name);
  try {
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (!/Calidad del agua|Conductividad/.test(xml)) continue;
    wordText = xml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    fs.copyFileSync(file, path.join(OUT, 'informe-prueba.docx'));
    break;
  } catch {
    /* no es un Word */
  }
}
check('Se descargó el Word', wordText.length > 80, downloads.join(', '));
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
check('El Word no incluye observaciones del capítulo', !/Observaciones del capítulo/.test(wordText) && !/no debe salir en el informe/.test(wordText));
check(
  'El Word usa parámetros e implementos con ortografía correcta',
  /parámetros/.test(wordText) && /implementos de aspersión/i.test(wordText) && !/parametros/.test(wordText) && !/implemetos/.test(wordText)
);

fs.writeFileSync(path.join(OUT, 'word-excerpt.txt'), wordText.slice(Math.max(0, idx46), idx47 > 0 ? idx47 + 80 : idx46 + 800));
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
try {
  fs.copyFileSync(path.join(OUT, 'informe_cap4_calidad_agua.png'), '/opt/cursor/artifacts/informe_cap4_calidad_agua.png');
} catch {
  /* artifacts dir may vary */
}

const passed = results.filter((r) => r.ok).length;
console.log('\n' + passed + '/' + results.length + ' comprobaciones correctas');
await b.close();
process.exit(passed === results.length ? 0 : 1);
