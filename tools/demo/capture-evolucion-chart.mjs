/**
 * Captura Evolución mejorada (claro/oscuro + crop) con 4 informes San Isidro.
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
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=420,920'],
  defaultViewport: null,
  protocolTimeout: 120000,
});
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 920, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.setUserAgent(
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
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
await page.waitForSelector('#c360-metrics-board .c360-linechart', { timeout: 25000 });
await wait(800);

await page.evaluate(() => {
  document.querySelector('#c360-metrics-board [data-mode="all"]')?.click();
  document.querySelector('#c360-metrics-board [data-range="all"]')?.click();
});
await wait(900);

async function probeChart() {
  return page.evaluate(() => {
    const chart = document.querySelector('#c360-metrics-board .c360-metrics-hero-chart');
    const chips = [...(chart?.querySelectorAll('.c360-linechart-chip') || [])].map((el) =>
      el.textContent.replace(/\s+/g, ' ').trim()
    );
    const vals = [...(chart?.querySelectorAll('.c360-linechart-val') || [])].map((el) => el.textContent.trim());
    const hits = chart?.querySelectorAll('.c360-linechart-hit').length || 0;
    let clip = null;
    const metaChip = chart?.querySelector('.c360-linechart-chip.target');
    if (metaChip) {
      const mr = metaChip.getBoundingClientRect();
      const card = chart.getBoundingClientRect();
      clip = {
        text: metaChip.textContent.replace(/\s+/g, ' ').trim(),
        labelLeft: Math.round(mr.left * 10) / 10,
        cardLeft: Math.round(card.left * 10) / 10,
        clippedLeft: mr.left < card.left - 0.5,
        fullVisible: mr.left >= card.left - 0.5 && mr.right <= card.right + 0.5 && mr.top >= card.top - 0.5,
        inPlotMetaLabel: !!chart.querySelector('.c360-linechart-meta-label'),
      };
    }
    return {
      dark: document.documentElement.classList.contains('dark'),
      chips,
      vals,
      hits,
      hasZones: !!chart?.querySelector('.c360-linechart-zone'),
      hasMetaChip: chips.some((c) => /Meta 80%/i.test(c)),
      hasDeltaChip: chips.some((c) => /vs visita anterior/i.test(c)),
      clip,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

await page.evaluate(() => {
  document.querySelector('#c360-metrics-board .c360-metrics-hero-chart')?.scrollIntoView({ block: 'center' });
});
await wait(400);

// Ensure light mode first
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button, [role="button"]')].find((el) =>
    /Oscuro|Claro/i.test(el.textContent || '')
  );
  if (document.documentElement.classList.contains('dark')) {
    if (btn && /Claro/i.test(btn.textContent || '')) btn.click();
    else document.documentElement.classList.remove('dark');
  }
});
await wait(500);

const lightProbe = await probeChart();
console.log('LIGHT', JSON.stringify(lightProbe, null, 2));

const lightPath = path.join(OUT, 'evolucion_chart_final_light.png');
await page.screenshot({ path: lightPath, fullPage: false });

const heroLight = await page.$('#c360-metrics-board .c360-metrics-hero-chart');
if (heroLight) {
  await heroLight.screenshot({ path: path.join(OUT, 'evolucion_chart_final_crop_light.png') });
}

// Dark mode
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button, [role="button"]')].find((el) =>
    /Oscuro|Claro/i.test(el.textContent || '')
  );
  if (btn && /Oscuro/i.test(btn.textContent || '')) btn.click();
  else document.documentElement.classList.add('dark');
});
await wait(700);

await page.evaluate(() => {
  document.querySelector('#c360-metrics-board .c360-metrics-hero-chart')?.scrollIntoView({ block: 'center' });
});
await wait(300);

const darkProbe = await probeChart();
console.log('DARK', JSON.stringify(darkProbe, null, 2));

const darkPath = path.join(OUT, 'evolucion_chart_final_dark.png');
await page.screenshot({ path: darkPath, fullPage: false });

const heroDark = await page.$('#c360-metrics-board .c360-metrics-hero-chart');
if (heroDark) {
  await heroDark.screenshot({ path: path.join(OUT, 'evolucion_chart_final_crop_dark.png') });
}

fs.writeFileSync(
  path.join(OUT, 'evolucion_chart_final_probe.json'),
  JSON.stringify({ light: lightProbe, dark: darkProbe }, null, 2)
);

const ok =
  lightProbe.hasMetaChip &&
  lightProbe.hasDeltaChip &&
  lightProbe.hits >= 4 &&
  lightProbe.clip &&
  !lightProbe.clip.clippedLeft &&
  lightProbe.clip.fullVisible &&
  !lightProbe.clip.inPlotMetaLabel &&
  darkProbe.hits >= 4 &&
  darkProbe.clip &&
  !darkProbe.clip.clippedLeft &&
  !darkProbe.clip.inPlotMetaLabel;

await browser.close();
if (!ok) {
  console.error('FAIL probe checks');
  process.exit(1);
}
console.log('OK evolucion screenshots');
