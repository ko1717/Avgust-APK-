/**
 * Captura KPIs enriquecidos (claro/oscuro) en viewport tablet.
 * Siembra 4 informes demo y abre Métricas → Todas las fincas.
 */
import puppeteer from '../../tests/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.CARE360_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.C360_ARTIFACTS || '/opt/cursor/artifacts';
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'metrics/visits.json'), 'utf8'));

fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function buildAnswers(map) {
  const out = {};
  for (const [id, value] of Object.entries(map)) {
    out[id] = {
      value,
      observation: value === 'NO' ? `Hallazgo en criterio ${id}.` : '',
      recommendation: value === 'NO' ? `Corregir ${id}.` : '',
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
  conclusion: 'Informe demo CARE 360.',
}));

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

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
await wait(2500);
await page.evaluate(() => {
  document.querySelector('.c360-intro [data-act="skip"], .c360-intro [data-act="start"]')?.click();
});
await wait(800);
await page.waitForFunction(() => !!(window.C360Import && window.C360Import.saveVisits), { timeout: 45000 });

const seeded = await page.evaluate(async (visits) => {
  const list = await fetch('/api/visits').then((r) => r.json()).catch(() => []);
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
console.log('SEEDED', seeded);

await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.module-nav [role="tab"], .module-nav [data-slot="tabs-trigger"]')];
  tabs.find((t) => /Métricas/i.test(t.textContent || ''))?.click();
});
await page.waitForSelector('#c360-metrics-board .c360-mkpi', { timeout: 25000 });
await wait(1000);

await page.evaluate(() => {
  document.querySelector('#c360-metrics-board [data-mode="all"]')?.click();
  document.querySelector('#c360-metrics-board [data-range="all"]')?.click();
});
await wait(800);

const probe = await page.evaluate(() => {
  const board = document.querySelector('#c360-metrics-board');
  const kpis = [...board.querySelectorAll('.c360-mkpi')].map((el) => ({
    label: el.querySelector('.c360-mkpi-label')?.textContent?.trim(),
    value: el.querySelector('.c360-mkpi-value')?.textContent?.trim(),
    foot: el.querySelector('.c360-mkpi-foot')?.innerText?.replace(/\s+/g, ' ').trim() || '',
    featured: el.classList.contains('featured'),
  }));
  return {
    kpis,
    hasMetaLine: !!board.querySelector('.c360-linechart-meta'),
    hasStatus: !!board.querySelector('.c360-mkpi-status'),
    hasVsMeta: /vs meta/i.test(board.innerText),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
});
console.log('PROBE', JSON.stringify(probe, null, 2));

await page.evaluate(() => {
  document.querySelector('#c360-metrics-board .c360-metrics-hero')?.scrollIntoView({ block: 'start' });
});
await wait(300);

const lightPath = path.join(OUT, 'metricas_kpis_enriched_tablet_light.png');
await page.screenshot({ path: lightPath, fullPage: false });

const darkOk = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button, [role="button"]')].find((el) =>
    /Oscuro|Claro/i.test(el.textContent || '')
  );
  if (!btn) {
    document.documentElement.classList.add('dark');
    return 'forced';
  }
  if (/Oscuro/i.test(btn.textContent || '')) btn.click();
  return 'toggled';
});
await wait(700);

const darkProbe = await page.evaluate(() => ({
  dark: document.documentElement.classList.contains('dark'),
  hasStatus: !!document.querySelector('.c360-mkpi-status'),
  hasMetaLine: !!document.querySelector('.c360-linechart-meta'),
}));
console.log('DARK', darkOk, darkProbe);

await page.evaluate(() => {
  document.querySelector('#c360-metrics-board .c360-metrics-hero')?.scrollIntoView({ block: 'start' });
});
await wait(200);
const darkPath = path.join(OUT, 'metricas_kpis_enriched_tablet_dark.png');
await page.screenshot({ path: darkPath, fullPage: false });

const hero = await page.$('#c360-metrics-board .c360-metrics-hero');
if (hero) {
  await hero.screenshot({ path: path.join(OUT, 'metricas_kpis_enriched_hero_dark.png') });
}

fs.writeFileSync(
  path.join(OUT, 'metricas_kpis_enriched_probe.json'),
  JSON.stringify({ seeded, probe, darkOk, darkProbe, url: URL }, null, 2)
);

const pass =
  seeded.ok &&
  probe.hasStatus &&
  probe.hasVsMeta &&
  probe.hasMetaLine &&
  !probe.overflowX &&
  darkProbe.dark;
console.log(pass ? 'PASS capture-kpi-enriched' : 'FAIL capture-kpi-enriched');
await browser.close();
process.exit(pass ? 0 : 1);
