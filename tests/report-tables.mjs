/*
 * Tablas de mediciones debajo del subcapítulo (4.6, 5.1, 5.3, 5.6).
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const URL = process.env.CARE360_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.CARE360_TEST_OUT || '/opt/cursor/artifacts/report-tables-test';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, extra) => {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tableBetween = (text, startRe, tableRe, endRe) => {
  const start = text.search(startRe);
  const table = text.search(tableRe);
  const end = text.search(endRe);
  return start >= 0 && table > start && (end < 0 || table < end);
};

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
    if (el.type === 'date') set(el, '2026-05-20');
    else if (el.type === 'text' && !el.value) set(el, 'Finca Los Rosales');
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

const selectChapter = async (re) => {
  await p.evaluate(() => {
    const combo = document.querySelector('.form-body button[role="combobox"], .form-body [data-slot="select-trigger"]');
    if (combo) combo.click();
  });
  await wait(400);
  await p.evaluate((src) => {
    const rx = new RegExp(src, 'i');
    const opt = [...document.querySelectorAll('[role="option"]')].find((el) => rx.test(el.textContent || ''));
    if (opt) opt.click();
  }, re.source);
  await wait(800);
};

const fillByLabel = async (pairs) => {
  await p.evaluate((rows) => {
    const set = (el, v) => {
      const proto = HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    rows.forEach(([src, v]) => {
      const rx = new RegExp(src, 'i');
      [...document.querySelectorAll('label')]
        .filter((el) => rx.test(el.textContent || '') && el.querySelector('input'))
        .forEach((label) => set(label.querySelector('input'), v));
    });
  }, pairs);
};

await selectChapter(/Preparación de mezclas/);
await fillByLabel([
  ['pH del agua', '6.1'],
  ['Dureza', '45'],
  ['^Conductividad$', '0.35'],
  ['pH mezcla final', '6.0'],
  ['Conductividad mezcla final', '0.4'],
]);
await selectChapter(/Aplicación de PPC/);
await fillByLabel([
  ['Presión de la bomba|Presión \\(PSI\\)', '80'],
  ['Presión del implemento', '60'],
  ['^Equipo de aplicación', 'Lanza'],
  ['Implementos de aplicación', 'Estacionaria'],
  ['Volumen por cama', '12'],
  ['Tiempo por cama', '25'],
]);
await p.evaluate(() => {
  const labels = [...document.querySelectorAll('.answer-options label')];
  labels.filter((l) => /sí cumple|^sí$/i.test(l.textContent.trim())).slice(0, 20).forEach((l) => l.click());
});
await wait(600);

await p.evaluate(() => [...document.querySelectorAll('.steps [role=tab]')].find((t) => /Informe/i.test(t.textContent || ''))?.click());
await wait(1800);

const report = await p.evaluate(() => {
  const paper = document.querySelector('.report-paper');
  if (!paper) return { text: '', order: {} };
  const text = paper.innerText;
  const headings = [...paper.querySelectorAll('h2, h3, .c360-report-inline-measures h3, .c360-report-chapter-measures h3')].map((el) =>
    (el.textContent || '').replace(/\s+/g, ' ').trim()
  );
  const agua = paper.querySelector('.c360-report-inline-measures, .c360-report-chapter-measures[data-group="agua"]');
  const q46 = [...paper.querySelectorAll('h3')].find((h) => /^4\.6\s*·/.test((h.textContent || '').trim()));
  const q47 = [...paper.querySelectorAll('h3')].find((h) => /^4\.7\s*·/.test((h.textContent || '').trim()));
  const notes = [...paper.querySelectorAll('h3')].find((h) => /Observaciones del capítulo/i.test(h.textContent || ''));
  const aguaAfter46 = q46 && agua ? !!(q46.compareDocumentPosition(agua) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
  const aguaBefore47 = q47 && agua ? !!(agua.compareDocumentPosition(q47) & Node.DOCUMENT_POSITION_FOLLOWING) : !q47;
  const aguaBeforeNotes = notes && agua ? !!(agua.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING) : true;
  return { text, headings, aguaAfter46, aguaBefore47, aguaBeforeNotes };
});

check('La vista previa del informe se genera', /Informe técnico de visita/i.test(report.text), report.text.slice(0, 80).replace(/\n/g, ' '));
check(
  'HTML: calidad del agua debajo de 4.6 y antes de 4.7',
  tableBetween(report.text, /4\.6\s*·/, /Calidad del agua/, /4\.7\s*·|Observaciones del capítulo/) && report.aguaAfter46 && report.aguaBefore47,
  JSON.stringify({ aguaAfter46: report.aguaAfter46, aguaBefore47: report.aguaBefore47, aguaBeforeNotes: report.aguaBeforeNotes })
);
check('HTML: mezcla final junto a 4.6', tableBetween(report.text, /4\.6\s*·/, /Mezcla final/, /4\.7\s*·|Observaciones del capítulo/));
check('HTML: presión debajo de 5.1', tableBetween(report.text, /5\.1\s*·/, /5\.1 Presión|Presión de la bomba/, /5\.2\s*·|Observaciones del capítulo/));
check('HTML: equipo debajo de 5.3', tableBetween(report.text, /5\.3\s*·/, /Equipo de aplicación/, /5\.4\s*·|Observaciones del capítulo/));
check('HTML: volumen/tiempo debajo de 5.6', tableBetween(report.text, /5\.6\s*·/, /Volumen y tiempo por cama|Volumen por cama/, /5\.7\s*·|Observaciones del capítulo/));
check('HTML: las tablas no quedan tras observaciones del cap. 4', report.aguaBeforeNotes, JSON.stringify(report.headings.filter((h) => /4\.|Calidad|Mezcla|Observaciones|Presión|Equipo|Volumen/i.test(h)).slice(0, 20)));

await p.evaluate(() => {
  const el = [...document.querySelectorAll('.report-paper h3')].find((h) => /4\.6\s*·|Calidad del agua/i.test(h.textContent || ''));
  el?.scrollIntoView({ block: 'start' });
});
await wait(400);
await p.screenshot({ path: path.join(OUT, 'informe_cap4_tablas.png') });
await p.evaluate(() => {
  const el = [...document.querySelectorAll('.report-paper h3')].find((h) => /5\.1\s*·|5\.1 Presión/i.test(h.textContent || ''));
  el?.scrollIntoView({ block: 'start' });
});
await wait(400);
await p.screenshot({ path: path.join(OUT, 'informe_cap5_tablas.png') });

const clickedWord = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button,a')].find((el) => /Descargar Word/i.test(el.textContent || ''));
  if (!btn) return false;
  btn.click();
  return true;
});
await wait(clickedWord ? 6000 : 200);
let wordText = '';
if (clickedWord) {
  for (const name of fs.readdirSync(OUT)) {
    const file = path.join(OUT, name);
    try {
      const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (!/Conductividad/.test(xml) && !/Calidad del agua/.test(xml)) continue;
      wordText = xml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
      break;
    } catch {
      /* no es un Word */
    }
  }
}
check('Se descarga el Word del informe', !!wordText, downloads.join(', '));
check('Word: calidad del agua debajo de 4.6', tableBetween(wordText, /4\.6\s*·/, /Calidad del agua/, /4\.7\s*·|Observaciones del capítulo/));
check('Word: mezcla final junto a 4.6', tableBetween(wordText, /4\.6\s*·/, /Mezcla final/, /4\.7\s*·|Observaciones del capítulo/));
check('Word: presión debajo de 5.1', tableBetween(wordText, /5\.1\s*·/, /5\.1 Presión|Presión de la bomba/, /5\.2\s*·|Observaciones del capítulo/));
check('Word: equipo debajo de 5.3', tableBetween(wordText, /5\.3\s*·/, /Equipo de aplicación/, /5\.4\s*·|Observaciones del capítulo/));
check('Word: volumen/tiempo debajo de 5.6', tableBetween(wordText, /5\.6\s*·/, /Volumen y tiempo por cama|Volumen por cama/, /5\.7\s*·|Observaciones del capítulo/));

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, headings: report.headings, wordSlice: wordText.slice(0, 800) }, null, 2));
try {
  fs.copyFileSync(path.join(OUT, 'informe_cap4_tablas.png'), '/opt/cursor/artifacts/informe_cap4_tablas.png');
  fs.copyFileSync(path.join(OUT, 'informe_cap5_tablas.png'), '/opt/cursor/artifacts/informe_cap5_tablas.png');
} catch {
  /* artifacts opcionales */
}

const passed = results.filter((r) => r.ok).length;
console.log('\n' + passed + '/' + results.length + ' comprobaciones correctas');
await b.close();
process.exit(passed === results.length ? 0 : 1);
