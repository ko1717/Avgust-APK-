/*
 * Capítulos MIPE unificados: las 5 barras + catálogo de subcapítulos
 * en Todas las fincas y Por finca, con una sola leyenda.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.CARE360_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.CARE360_TEST_OUT || '/opt/cursor/artifacts/metrics-chapter-detail';
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '../tools/demo/metrics/visits.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, extra) => {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function buildAnswers(map) {
  const out = {};
  for (const [id, value] of Object.entries(map)) {
    out[id] = {
      value,
      observation: value === 'NO' ? `Hallazgo en ${id}` : '',
      recommendation: value === 'NO' ? `Corregir ${id}` : '',
    };
  }
  return out;
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
  conclusion: 'Demo métricas detalle por capítulo',
}));

const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], protocolTimeout: 60000 });
const p = await b.newPage();
await p.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await p.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
await wait(2500);
await p.evaluate(() => document.querySelector('.c360-intro [data-act="skip"]')?.click());
await wait(800);
await p.waitForFunction(() => !!(window.C360Import && window.C360Import.saveVisits), { timeout: 45000 });

const seeded = await p.evaluate(async (visits) => {
  const list = await fetch('/api/visits').then((r) => r.json());
  const arr = Array.isArray(list) ? list : list.visits || [];
  const farmNorm = (visits[0].farm || '').toLocaleLowerCase('es');
  for (const v of arr) {
    if (String(v.farm || '').toLocaleLowerCase('es') === farmNorm && v.id) {
      await fetch('/api/visits/' + v.id, { method: 'DELETE' }).catch(() => null);
    }
  }
  const saved = await window.C360Import.saveVisits(visits);
  return { ok: true, n: saved.length };
}, payloads);
check('Se siembran informes demo', !!seeded.ok && seeded.n >= 4, JSON.stringify(seeded));

await p.evaluate(() => {
  const tabs = [...document.querySelectorAll('.module-nav [role="tab"], .module-nav [data-slot="tabs-trigger"]')];
  tabs.find((t) => /Métricas/i.test(t.textContent || ''))?.click();
});
await p.waitForSelector('#c360-metrics-board', { timeout: 25000 });
await wait(1200);
await p.evaluate(() => document.querySelector('#c360-metrics-board [data-range="all"]')?.click());
await wait(400);
await p.evaluate(() => document.querySelector('#c360-metrics-board [data-mode="all"]')?.click());
await wait(600);

const allView = await p.evaluate(() => {
  const board = document.querySelector('#c360-metrics-board');
  const detail = document.querySelector('#c360-chapter-detail');
  const charts = document.querySelector('.c360-metrics-charts');
  const rows = [...document.querySelectorAll('.c360-chdetail-row')].map((el) => el.getAttribute('data-chapter'));
  const legend = detail?.querySelector('.c360-metrics-legend')?.innerText || '';
  const titles = [...document.querySelectorAll('#c360-metrics-board h3, #c360-metrics-board .c360-card-head h3')].map(
    (el) => (el.textContent || '').trim()
  );
  return {
    hasDetail: !!detail,
    insideCharts: !!(charts && detail && charts.contains(detail)),
    chapters: rows,
    title: detail?.querySelector('h3')?.textContent || '',
    unifiedBars: document.querySelectorAll('#c360-chapter-detail .c360-chdetail-bar').length,
    extraFindingsChart: titles.some((t) => /Hallazgos por capítulo/i.test(t)),
    extraScoreChart: titles.some((t) => /Indicador por capítulo/i.test(t)),
    legendHasHealthy: /Saludable/i.test(legend),
    legendHasCritical: /Crítico/i.test(legend),
    legendHasPending: /Sin medición/i.test(legend),
    legendHasMeta: /Meta 80%/i.test(legend),
    hiddenSubs: [...document.querySelectorAll('.c360-chdetail-subs')].every((el) => el.hidden),
    noChartBtn: !document.querySelector('[data-chart-chapter]'),
  };
});
check(
  'Todas: los 5 capítulos MIPE aparecen en un solo bloque',
  allView.hasDetail &&
    allView.insideCharts &&
    allView.chapters.join(',') === '1,2,3,4,5' &&
    allView.unifiedBars === 5,
  JSON.stringify(allView)
);
check(
  'Todas: una sola leyenda (estado + meta) y no hay gráfica duplicada',
  allView.legendHasHealthy &&
    allView.legendHasCritical &&
    allView.legendHasPending &&
    allView.legendHasMeta &&
    !allView.extraFindingsChart &&
    !allView.extraScoreChart &&
    allView.noChartBtn,
  JSON.stringify(allView)
);
check('Todas: los subcapítulos arrancan cerrados', allView.hiddenSubs);

await p.evaluate(() => {
  document.querySelector('.c360-chdetail-row[data-chapter="4"] [data-toggle-chapter]')?.click();
});
await wait(400);
const expanded = await p.evaluate(() => {
  const row = document.querySelector('.c360-chdetail-row[data-chapter="4"]');
  const text = row?.innerText || '';
  const ids = [...row.querySelectorAll('.c360-chdetail-subbar strong')].map((el) => el.textContent.trim());
  return {
    open: row?.classList.contains('is-open'),
    has41: /4\.1/.test(text) && /Equipos de dosificación/i.test(text),
    has46: /4\.6/.test(text) && /Calidad del agua/i.test(text),
    has410: /4\.10/.test(text) && /Mezcla final/i.test(text),
    pending46: /4\.6[\s\S]*Sin evaluar/i.test(text),
    count: row?.querySelectorAll('.c360-chdetail-subbar').length || 0,
    ids: ids.slice(0, 12),
  };
});
check(
  'Todas: al tocar cap. 4 se ve el catálogo 4.1–4.10',
  expanded.open && expanded.has41 && expanded.has46 && expanded.has410 && expanded.count === 10,
  JSON.stringify(expanded)
);
check('Todas: 4.6 no medido queda en gris / Sin evaluar', expanded.pending46, JSON.stringify(expanded));

await p.evaluate(() => document.querySelector('#c360-chapter-detail')?.scrollIntoView({ block: 'start' }));
await wait(300);
await p.screenshot({ path: path.join(OUT, 'metricas_todas_detalle_cap4.png') });

await p.evaluate(() => document.querySelector('#c360-metrics-board [data-mode="farm"]')?.click());
await wait(800);
await p.evaluate((farmName) => {
  const sel = document.querySelector('#c360-metrics-board select[data-field="farm"]');
  if (sel) {
    const hit = [...sel.options].find(
      (o) => /San Isidro/i.test(o.value + ' ' + o.textContent) || (o.value || '').includes(farmName)
    );
    if (hit) {
      sel.value = hit.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  return true;
}, DATA.farm);
await wait(900);

const farmDetail = await p.evaluate(() => {
  const detail = document.querySelector('#c360-chapter-detail');
  const charts = document.querySelector('.c360-metrics-charts');
  const chapters = [...document.querySelectorAll('.c360-chdetail-row')].map((el) => el.getAttribute('data-chapter'));
  document.querySelector('.c360-chdetail-row[data-chapter="5"] [data-toggle-chapter]')?.click();
  const row = document.querySelector('.c360-chdetail-row[data-chapter="5"]');
  const text = row?.innerText || '';
  return {
    hasDetail: !!detail,
    insideCharts: !!(charts && detail && charts.contains(detail)),
    chapters,
    open5: row?.classList.contains('is-open'),
    has51: /5\.1/.test(text) && /Presión/i.test(text),
    has511: /5\.11/.test(text) && /Registro de aplicación/i.test(text),
    hasResult: /Sí cumple|No cumple/i.test(text),
    count: row?.querySelectorAll('.c360-chdetail-subbar').length || 0,
    tableText: text.replace(/\s+/g, ' ').slice(0, 280),
  };
});
check(
  'Por finca: los 5 capítulos quedan en el mismo bloque de barras',
  farmDetail.hasDetail && farmDetail.insideCharts && farmDetail.chapters.join(',') === '1,2,3,4,5'
);
check(
  'Por finca: cap. 5 muestra 5.1–5.11 y el resultado',
  farmDetail.open5 && farmDetail.has51 && farmDetail.has511 && farmDetail.hasResult && farmDetail.count === 11,
  farmDetail.tableText
);

await p.evaluate(() => document.querySelector('#c360-chapter-detail')?.scrollIntoView({ block: 'start' }));
await wait(300);
await p.screenshot({ path: path.join(OUT, 'metricas_finca_detalle_cap5.png') });

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
try {
  fs.copyFileSync(path.join(OUT, 'metricas_todas_detalle_cap4.png'), '/opt/cursor/artifacts/metricas_todas_detalle_cap4.png');
  fs.copyFileSync(path.join(OUT, 'metricas_finca_detalle_cap5.png'), '/opt/cursor/artifacts/metricas_finca_detalle_cap5.png');
} catch {
  /* artifacts opcionales */
}

const passed = results.filter((r) => r.ok).length;
console.log('\n' + passed + '/' + results.length + ' comprobaciones correctas');
await b.close();
process.exit(passed === results.length ? 0 : 1);
