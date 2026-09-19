/*
 * Detalle por capítulo: tabla de subcapítulos + gráfica por capítulo
 * en Todas las fincas y Por finca.
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
  const afterCharts = !!(
    document.querySelector('.c360-metrics-charts') &&
    detail &&
    document.querySelector('.c360-metrics-charts').compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING
  );
  const rows = [...document.querySelectorAll('.c360-chdetail-row')].map((el) => el.getAttribute('data-chapter'));
  return {
    hasDetail: !!detail,
    afterCharts,
    chapters: rows,
    title: detail?.querySelector('h3')?.textContent || '',
    barsStillThere: !!document.querySelector('.c360-metrics-charts .c360-hbar-chart'),
    hiddenSubs: [...document.querySelectorAll('.c360-chdetail-subs')].every((el) => el.hidden),
  };
});
check('Todas: el detalle queda después de las barras de capítulo', allView.hasDetail && allView.afterCharts, JSON.stringify(allView));
check('Todas: hay filas de capítulo y las barras originales siguen', allView.chapters.length >= 3 && allView.barsStillThere, JSON.stringify(allView.chapters));
check('Todas: los subcapítulos arrancan cerrados', allView.hiddenSubs);

await p.evaluate(() => {
  const row = document.querySelector('.c360-chdetail-row[data-chapter="4"] [data-toggle-chapter]');
  row?.click();
});
await wait(400);
const expanded = await p.evaluate(() => {
  const row = document.querySelector('.c360-chdetail-row[data-chapter="4"]');
  const tableText = row?.querySelector('.c360-chdetail-table')?.innerText || '';
  const chartHidden = row?.querySelector('.c360-chdetail-chart')?.hidden;
  return {
    open: row?.classList.contains('is-open'),
    has46: /4\.6/.test(tableText) && /Calidad del agua/i.test(tableText),
    has410: /4\.10|Mezcla final/i.test(tableText) || /4\.1/.test(tableText),
    chartHidden,
    tableText: tableText.replace(/\s+/g, ' ').slice(0, 220),
  };
});
check('Todas: al tocar cap. 4 se ven subcapítulos (4.6 calidad del agua)', expanded.open && expanded.has46, JSON.stringify(expanded));
check('Todas: la gráfica del capítulo no se abre sola', !!expanded.chartHidden);

await p.evaluate(() => document.querySelector('.c360-chdetail-row[data-chapter="4"] [data-chart-chapter]')?.click());
await wait(400);
const chartOpen = await p.evaluate(() => {
  const row = document.querySelector('.c360-chdetail-row[data-chapter="4"]');
  const chart = row?.querySelector('.c360-chdetail-chart');
  const pressed = row?.querySelector('[data-chart-chapter]')?.getAttribute('aria-pressed');
  const labels = [...(chart?.querySelectorAll('.c360-hbar-head strong') || [])].map((el) => el.textContent.trim());
  return {
    visible: chart && !chart.hidden,
    pressed,
    has46bar: labels.some((t) => /4\.6/.test(t)),
    onlyThis: [...document.querySelectorAll('.c360-chdetail-chart')].filter((el) => !el.hidden).length === 1,
    labels: labels.slice(0, 8),
  };
});
check('Todas: el botón Gráfica muestra barras solo del cap. 4', chartOpen.visible && chartOpen.has46bar && chartOpen.onlyThis, JSON.stringify(chartOpen));

await p.evaluate(() => {
  document.querySelector('#c360-chapter-detail')?.scrollIntoView({ block: 'start' });
});
await wait(300);
await p.screenshot({ path: path.join(OUT, 'metricas_todas_detalle_cap4.png') });

await p.evaluate(() => document.querySelector('#c360-metrics-board [data-mode="farm"]')?.click());
await wait(800);
const farmView = await p.evaluate((farmName) => {
  const sel = document.querySelector('#c360-metrics-board select[data-field="farm"]');
  if (sel) {
    const hit = [...sel.options].find((o) => /San Isidro/i.test(o.value + ' ' + o.textContent) || (o.value || '').includes(farmName));
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
  const afterCharts = !!(
    document.querySelector('.c360-metrics-charts') &&
    detail &&
    document.querySelector('.c360-metrics-charts').compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING
  );
  document.querySelector('.c360-chdetail-row[data-chapter="5"] [data-toggle-chapter]')?.click();
  const row = document.querySelector('.c360-chdetail-row[data-chapter="5"]');
  const tableText = row?.querySelector('.c360-chdetail-table')?.innerText || '';
  return {
    hasDetail: !!detail,
    afterCharts,
    open5: row?.classList.contains('is-open'),
    has51: /5\.1/.test(tableText) && /Presión/i.test(tableText),
    hasResult: /Sí cumple|No cumple/i.test(tableText),
    tableText: tableText.replace(/\s+/g, ' ').slice(0, 240),
  };
});
check('Por finca: el mismo bloque queda después de las barras', farmDetail.hasDetail && farmDetail.afterCharts);
check('Por finca: cap. 5 muestra 5.1 presión y el resultado', farmDetail.open5 && farmDetail.has51 && farmDetail.hasResult, farmDetail.tableText);

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
