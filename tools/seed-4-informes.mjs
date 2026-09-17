#!/usr/bin/env node
/**
 * Siembra 4 informes revisados en Finca San Isidro (vía C360Import.saveVisits)
 * y captura capturas del tablero de Métricas en viewport tablet (~820px).
 *
 * Uso:
 *   CARE360_URL=http://127.0.0.1:8080/index.html node tools/seed-4-informes.mjs
 *
 * Demo estática (sin IndexedDB): tools/metrics-demo-4-informes/
 */
import puppeteer from '../tests/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.CARE360_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.C360_ARTIFACTS || '/opt/cursor/artifacts';
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'metrics-demo-4-informes/visits.json'), 'utf8'));

fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function buildAnswers(map) {
  const out = {};
  for (const [id, value] of Object.entries(map)) {
    out[id] = {
      value,
      observation:
        value === 'NO'
          ? `Hallazgo en criterio ${id}: incumplimiento observado en campo durante la visita.`
          : '',
      recommendation:
        value === 'NO'
          ? `Corregir el incumplimiento de ${id}. Verificar evidencia, EPP y registro antes de la siguiente visita de acompañamiento.`
          : '',
    };
  }
  return out;
}

function scoreOf(map) {
  const vals = Object.values(map);
  const app = vals.filter((v) => v === 'SI' || v === 'NO').length;
  const find = vals.filter((v) => v === 'NO').length;
  return app ? Math.round(((app - find) / app) * 100) : null;
}

const payloads = DATA.visits.map((v) => ({
  farm: DATA.farm,
  date: v.date,
  responsible: v.responsible,
  technician: v.technician || v.responsible,
  zone: DATA.zone,
  city: DATA.city,
  crop: DATA.crop,
  chapters: [1, 2, 3, 4, 5],
  answers: buildAnswers(v.answers),
  reviewed: true,
  serviceKind: 'assurance',
  conclusion:
    'Informe demo CARE 360 para visualizar Evolución, capítulos y hallazgos en Métricas.',
}));

const expected = payloads.map((p) => ({
  date: p.date,
  responsible: p.responsible,
  score: scoreOf(DATA.visits.find((v) => v.date === p.date).answers),
  findings: Object.values(DATA.visits.find((v) => v.date === p.date).answers).filter((x) => x === 'NO')
    .length,
}));

console.log('Esperado:', JSON.stringify(expected, null, 2));

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=820,1180'],
  defaultViewport: null,
  protocolTimeout: 120000,
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.setUserAgent(
  'Mozilla/5.0 (Linux; Android 13; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
await wait(2500);

await page.evaluate(() => {
  const skip = document.querySelector('.c360-intro [data-act="skip"], .c360-intro [data-act="start"]');
  if (skip) skip.click();
});
await wait(800);

await page.waitForFunction(() => !!(window.C360Import && window.C360Import.saveVisits), {
  timeout: 45000,
});

const seeded = await page.evaluate(async (visits) => {
  try {
    // Borrar visitas previas de la misma finca para re-siembra limpia
    const list = await fetch('/api/visits').then((r) => r.json());
    const arr = Array.isArray(list) ? list : list.visits || [];
    const farmNorm = (visits[0].farm || '').toLocaleLowerCase('es');
    for (const v of arr) {
      if (String(v.farm || '').toLocaleLowerCase('es') === farmNorm && v.id) {
        await fetch('/api/visits/' + v.id, { method: 'DELETE' }).catch(() => null);
      }
    }
    const saved = await window.C360Import.saveVisits(visits);
    return {
      ok: true,
      n: saved.length,
      farms: [...new Set(saved.map((s) => s.farm))],
      dates: saved.map((s) => s.date).sort(),
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}, payloads);

console.log('SEEDED', JSON.stringify(seeded, null, 2));
if (!seeded.ok) {
  await browser.close();
  process.exit(1);
}

await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.module-nav [role="tab"], .module-nav [data-slot="tabs-trigger"]')];
  const m = tabs.find((t) => /Métricas/i.test(t.textContent || ''));
  if (m) m.click();
});
await page.waitForSelector('#c360-metrics-board', { timeout: 25000 });
await wait(1200);

// Periodo: Todo
await page.evaluate(() => {
  const all = document.querySelector('#c360-metrics-board [data-range="all"]');
  if (all) all.click();
});
await wait(400);

// Vista finca → San Isidro
await page.evaluate((farmName) => {
  const farmBtn = document.querySelector('#c360-metrics-board [data-mode="farm"]');
  if (farmBtn) farmBtn.click();
  const sel = document.querySelector('#c360-metrics-board select[data-field="farm"]');
  if (sel) {
    const opt = [...sel.options].find((o) => (o.value || o.textContent || '').includes(farmName.replace(/^Finca\s+/i, '')) || (o.value || '').includes(farmName));
    const hit =
      opt ||
      [...sel.options].find((o) => /San Isidro/i.test(o.value + ' ' + o.textContent));
    if (hit) {
      sel.value = hit.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } else {
    const card = [...document.querySelectorAll('[data-open-farm]')].find((el) =>
      /San Isidro/i.test(el.getAttribute('data-open-farm') || el.textContent || '')
    );
    if (card) card.click();
  }
}, DATA.farm);
await wait(1500);

const summary = await page.evaluate(() => {
  const board = document.querySelector('#c360-metrics-board');
  if (!board) return { ok: false };
  const points = [...board.querySelectorAll('.c360-linechart [data-focus-date], .c360-linechart circle.c360-line-hit, .c360-linechart [data-focus-score]')];
  const labels = [...board.querySelectorAll('.c360-linechart text, .c360-metrics-card-head h3')].map((el) =>
    (el.textContent || '').trim()
  );
  const head = board.querySelector('.c360-metrics-head-main')?.innerText || '';
  const chapters = [...board.querySelectorAll('.c360-hbar-row, .c360-hbar')].length;
  const hallazgos = /Qué atender|hallazgo|No cumple/i.test(board.innerText);
  return {
    ok: true,
    head: head.replace(/\s+/g, ' ').trim().slice(0, 240),
    lineHits: points.length,
    chapters,
    hallazgos,
    hasEvolucion: /Evolución/i.test(board.innerText),
    labelsSample: labels.filter(Boolean).slice(0, 12),
  };
});
console.log('SUMMARY', JSON.stringify(summary, null, 2));

await page.evaluate(() => {
  document.querySelector('.c360-linechart, .c360-metrics-charts')?.scrollIntoView({ block: 'start' });
});
await wait(300);
await page.screenshot({ path: path.join(OUT, 'metricas_4_informes_evolucion.png'), fullPage: false });

const charts = await page.$('.c360-metrics-charts');
if (charts) {
  await charts.screenshot({ path: path.join(OUT, 'metricas_4_informes_charts.png') });
}

await page.evaluate(() => {
  const board = document.querySelector('#c360-metrics-board');
  board?.scrollIntoView({ block: 'start' });
});
await wait(200);
await page.screenshot({ path: path.join(OUT, 'metricas_4_informes_finca.png'), fullPage: true });

const visitasList = await page.evaluate(async (farm) => {
  const list = await fetch('/api/visits').then((r) => r.json());
  const arr = Array.isArray(list) ? list : list.visits || [];
  return arr
    .filter((v) => /San Isidro/i.test(v.farm || ''))
    .map((v) => ({
      id: v.id,
      farm: v.farm,
      date: v.date,
      reviewed: v.reviewed,
      responsible: v.responsible || v.technician,
      nos: Object.keys(v.answers || {}).filter((k) => String(v.answers[k]?.value || v.answers[k]).toUpperCase() === 'NO'),
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}, DATA.farm);
console.log('VISITS_IN_DB', JSON.stringify(visitasList, null, 2));

fs.writeFileSync(
  path.join(OUT, 'metricas_4_informes_summary.json'),
  JSON.stringify({ expected, seeded, summary, visitasList, url: URL }, null, 2)
);

const pass = seeded.ok && seeded.n === 4 && summary.ok && summary.hasEvolucion && visitasList.length === 4;
console.log(pass ? 'PASS seed-4-informes' : 'FAIL seed-4-informes');
await browser.close();
process.exit(pass ? 0 : 1);
