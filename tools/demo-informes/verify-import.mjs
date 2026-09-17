#!/usr/bin/env node
/**
 * Verifica que finca-san-isidro_4-informes.csv se importa vía C360Import.
 */
import puppeteer from '../../tests/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.CARE360_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.C360_ARTIFACTS || '/opt/cursor/artifacts';
const CSV = fs.readFileSync(path.join(__dirname, 'finca-san-isidro_4-informes.csv'), 'utf8');

fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=820,1180'],
  defaultViewport: null,
  protocolTimeout: 120000,
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true });

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
await wait(2000);
await page.evaluate(() => {
  const intro = document.querySelector('.c360-intro');
  if (intro) {
    const skip = intro.querySelector('[data-act="skip"], [data-act="start"], button');
    if (skip) skip.click();
    else intro.remove();
  }
  localStorage.setItem('c360-intro-done', '1');
});
await wait(800);
// Force-hide intro if still visible
await page.evaluate(() => {
  document.querySelectorAll('.c360-intro').forEach((el) => {
    el.style.display = 'none';
    el.remove();
  });
});
await wait(400);
await page.waitForFunction(() => !!(window.C360Import && window.C360Import.rowsToVisits), {
  timeout: 45000,
});

const result = await page.evaluate(async (csvText) => {
  // Minimal CSV parse matching care360-import parseCsv
  function parseCsv(text) {
    var rows = [];
    var i = 0;
    var field = '';
    var row = [];
    var inQuotes = false;
    text = text.replace(/^\uFEFF/, '');
    while (i < text.length) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (ch === ',') {
        row.push(field);
        field = '';
        i += 1;
        continue;
      }
      if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter(function (r) {
      return r.some(function (c) {
        return String(c || '').trim();
      });
    });
  }

  const parsed = window.C360Import.rowsToVisits(parseCsv(csvText));
  if (!parsed.visits.length) {
    return { ok: false, stage: 'parse', parsed };
  }

  // Clear previous San Isidro visits
  const list = await fetch('/api/visits').then((r) => r.json());
  const arr = Array.isArray(list) ? list : list.visits || [];
  for (const v of arr) {
    if (/San Isidro/i.test(v.farm || '') && v.id) {
      await fetch('/api/visits/' + v.id, { method: 'DELETE' }).catch(() => null);
    }
  }

  const saved = await window.C360Import.saveVisits(parsed.visits);
  const scoreOf = (answers) => {
    const vals = Object.values(answers || {}).map((a) => (a && a.value) || a);
    const app = vals.filter((v) => v === 'SI' || v === 'NO').length;
    const find = vals.filter((v) => v === 'NO').length;
    return app ? Math.round(((app - find) / app) * 100) : null;
  };

  return {
    ok: true,
    visitCount: saved.length,
    farms: [...new Set(saved.map((s) => s.farm))],
    dates: saved.map((s) => s.date).sort(),
    scores: saved
      .map((s) => ({ date: s.date, score: scoreOf(s.answers), responsible: s.responsible }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    parseErrors: (parsed.errors || []).slice(0, 6),
  };
}, CSV);

console.log('IMPORT_RESULT', JSON.stringify(result, null, 2));
if (!result.ok || result.visitCount !== 4) {
  await browser.close();
  process.exit(1);
}

// Navigate to Métricas for screenshot
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.module-nav [role="tab"], .module-nav [data-slot="tabs-trigger"]')];
  const m = tabs.find((t) => /Métricas/i.test(t.textContent || ''));
  if (m) m.click();
});
await page.waitForSelector('#c360-metrics-board', { timeout: 25000 });
await wait(1000);
await page.evaluate(() => {
  document.querySelector('#c360-metrics-board [data-range="all"]')?.click();
});
await wait(300);
await page.evaluate(() => {
  const farmBtn = document.querySelector('#c360-metrics-board [data-mode="farm"]');
  if (farmBtn) farmBtn.click();
  const sel = document.querySelector('#c360-metrics-board select[data-field="farm"]');
  if (sel) {
    const hit = [...sel.options].find((o) => /San Isidro/i.test(o.value + ' ' + o.textContent));
    if (hit) {
      sel.value = hit.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
});
await wait(1500);
await page.screenshot({ path: path.join(OUT, 'demo_informes_import_metricas.png'), fullPage: false });

// Also screenshot Fincas import UI hint
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.module-nav [role="tab"], .module-nav [data-slot="tabs-trigger"]')];
  const f = tabs.find((t) => /Fincas/i.test(t.textContent || ''));
  if (f) f.click();
});
await wait(1200);
await page.evaluate(() => {
  const d = document.querySelector('#c360-farms-import');
  if (d) d.open = true;
});
await wait(400);
await page.screenshot({ path: path.join(OUT, 'demo_informes_import_fincas_ui.png'), fullPage: false });

fs.writeFileSync(path.join(OUT, 'demo_informes_import_verify.json'), JSON.stringify(result, null, 2));
console.log('PASS verify-import-csv');
await browser.close();
