/**
 * Verify 1.5.18: app Evolución line chart, Capítulos chart+table,
 * and informe HTML Evolución as SVG line (not badge blobs).
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

// San Isidro visits + one Tucan visit (matches Kevin's report screenshot scenario)
const sanIsidro = DATA.visits.map((v) => ({
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

const tucanAnswers = buildAnswers({
  '1.1': 'NO',
  '1.2': 'SI',
  '2.1': 'NO',
  '2.2': 'NO',
  '3.1': 'NO',
  '4.1': 'SI',
  '4.2': 'SI',
  '5.1': 'NO',
  '5.2': 'NO',
  '5.3': 'NO',
});

const tucan = {
  farm: 'Comercializadora Tucan',
  date: '2026-09-10',
  responsible: '',
  technician: '',
  zone: 'Cundinamarca',
  city: 'Bogotá',
  crop: 'Rosa',
  chapters: [1, 2, 3, 4, 5],
  answers: tucanAnswers,
  reviewed: true,
  serviceKind: 'assurance',
  conclusion: 'Informe demo Tucán.',
};

const payloads = [...sanIsidro, tucan];

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
  for (const v of arr) {
    if (v.id) await fetch('/api/visits/' + v.id, { method: 'DELETE' }).catch(() => null);
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
  document.documentElement.classList.remove('dark');
});
await wait(1000);

// --- 1) App Evolución line chart ---
await page.evaluate(() => {
  document.querySelector('#c360-metrics-board .c360-metrics-hero-chart')?.scrollIntoView({ block: 'center' });
});
await wait(400);

const evoProbe = await page.evaluate(() => {
  const chart = document.querySelector('#c360-metrics-board .c360-metrics-hero-chart .c360-linechart');
  return {
    hasLinechart: !!chart,
    hasPath: !!chart?.querySelector('.c360-linechart-path'),
    hasMeta: !!chart?.querySelector('.c360-linechart-meta'),
    vals: [...(chart?.querySelectorAll('.c360-linechart-val') || [])].map((el) => el.textContent.trim()),
    chips: [...(chart?.querySelectorAll('.c360-linechart-chip') || [])].map((el) =>
      el.textContent.replace(/\s+/g, ' ').trim()
    ),
  };
});
console.log('APP_EVO', JSON.stringify(evoProbe, null, 2));

const hero = await page.$('#c360-metrics-board .c360-metrics-hero-chart');
if (hero) {
  await hero.screenshot({ path: path.join(OUT, 'app_evolucion_line_chart.png') });
}
await page.screenshot({ path: path.join(OUT, 'app_metricas_evolucion.png'), fullPage: false });

// --- 2) App Capítulos chart + table ---
await page.evaluate(() => {
  document.querySelector('#c360-metrics-board .c360-metrics-capsub-block')?.scrollIntoView({ block: 'center' });
});
await wait(400);

const capProbe = await page.evaluate(() => {
  const block = document.querySelector('#c360-metrics-board .c360-metrics-capsub-block');
  return {
    hasGroupbars: !!block?.querySelector('.c360-groupbars-capsub'),
    hasTable: !!block?.querySelector('.c360-capsub-table'),
    rows: block?.querySelectorAll('.c360-capsub-table tbody tr').length || 0,
  };
});
console.log('APP_CAP', JSON.stringify(capProbe, null, 2));

const capBlock = await page.$('#c360-metrics-board .c360-metrics-capsub-block');
if (capBlock) {
  await capBlock.screenshot({ path: path.join(OUT, 'app_capitulos_chart_table.png') });
}

// --- 3) Exported informe HTML ---
const reportHtml = await page.evaluate(() => {
  // Force re-render snapshot
  const btn = document.querySelector('#c360-metrics-board [data-act="export-print"]');
  if (!btn) return { error: 'no export button' };
  // Access buildExportReportHtml via clicking is hard; regenerate by evaluating metrics internals.
  // Fall back: call export path if exposed, else scrape from open window after click.
  return null;
});

// Directly build report HTML inside page by invoking the same path as export
const html = await page.evaluate(() => {
  return new Promise((resolve) => {
    // Hook Blob save / open — intercept build by temporarily overriding print
    const originalOpen = window.open;
    let captured = '';
    window.open = function (url, name, feats) {
      const w = originalOpen.call(window, url, name, feats);
      const origWrite = w.document.write.bind(w.document);
      w.document.write = function (content) {
        captured = String(content || '');
        return origWrite(content);
      };
      // Also poll for body content
      setTimeout(() => {
        try {
          if (!captured && w.document && w.document.documentElement) {
            captured = '<!doctype html>' + w.document.documentElement.outerHTML;
          }
          w.close();
        } catch (e) {}
        window.open = originalOpen;
        resolve(captured);
      }, 800);
      return w;
    };

    // Also try to get HTML from metrics module if available via click+blob
    const btn = document.querySelector('#c360-metrics-board [data-act="export-print"]');
    if (!btn) {
      window.open = originalOpen;
      resolve('');
      return;
    }
    btn.click();
    setTimeout(() => {
      if (!captured) {
        window.open = originalOpen;
        resolve('');
      }
    }, 2500);
  });
});

let report = html || '';
if (!report || report.length < 500) {
  // Fallback: reconstruct by calling internal function if we can expose it
  report = await page.evaluate(() => {
    // Re-trigger metrics render and access via data attribute dump
    // Last resort: generate minimal check from DOM state after clicking and reading blob URL
    const board = document.querySelector('#c360-metrics-board');
    if (!board) return '';
    // Synthesize by reading timeline from visible chips + scores is incomplete.
    // Call the export through FileBridge-less path: monkeypatch Blob and URL.createObjectURL
    return '';
  });
}

// Better approach: inject a hook into care360-metrics by evaluating a download of buildExportReportHtml
// through the already-loaded module — expose via temporary global from the button handler.
const report2 = await page.evaluate(async () => {
  return await new Promise((resolve) => {
    let done = false;
    const finish = (html) => {
      if (done) return;
      done = true;
      resolve(html || '');
    };

    const OrigBlob = window.Blob;
    window.Blob = function (parts, opts) {
      const b = new OrigBlob(parts, opts);
      try {
        const text = (parts || []).map((p) => (typeof p === 'string' ? p : '')).join('');
        if (opts && opts.type && /html/i.test(opts.type) && text.length > 200) {
          finish(text);
        }
      } catch (e) {}
      return b;
    };
    window.Blob.prototype = OrigBlob.prototype;

    // Also patch printHtmlDocument iframe path by capturing doc.write
    const btn = document.querySelector('#c360-metrics-board [data-act="export-print"]');
    if (!btn) {
      window.Blob = OrigBlob;
      finish('');
      return;
    }
    btn.click();
    setTimeout(() => {
      window.Blob = OrigBlob;
      finish('');
    }, 3000);
  });
});

report = report2 || report;
console.log('REPORT_LEN', report.length);

if (report.length > 500) {
  const reportPath = path.join(OUT, 'informe_metricas_1518.html');
  fs.writeFileSync(reportPath, report, 'utf8');

  const hasLinechart = /class=['"]linechart['"]/.test(report) && /<svg[\s\S]*stroke-dasharray/.test(report);
  const hasGroupbarsEvo = /Evolución \/ visitas[\s\S]*?groupbars-bar/.test(report);
  const farmRows = [...report.matchAll(/<td>([^<]*(?:San Isidro|Tucan)[^<]*)<\/td>/gi)].map((m) => m[1]);
  // Check finca column values near timeline — look for San Isidro appearing in Evolución table
  const evoSection = report.split('Evolución / visitas')[1] || '';
  const hasSanIsidroInEvo = /San Isidro/i.test(evoSection);
  const hasTucanInEvo = /Tucan/i.test(evoSection);
  const hasCapTable = /Capítulos y subcapítulos[\s\S]*?<table/.test(report);
  const hasCapBars = /Capítulos y subcapítulos[\s\S]*?groupbars/.test(report);

  console.log(
    'REPORT_PROBE',
    JSON.stringify(
      {
        hasLinechart,
        hasGroupbarsEvo,
        hasSanIsidroInEvo,
        hasTucanInEvo,
        hasCapTable,
        hasCapBars,
        farmRowsSample: farmRows.slice(0, 8),
      },
      null,
      2
    )
  );

  const reportPage = await browser.newPage();
  await reportPage.setViewport({ width: 920, height: 1400, deviceScaleFactor: 2 });
  await reportPage.setContent(report, { waitUntil: 'networkidle0' });
  await wait(500);

  // Screenshot Evolución section
  const evoBlock = await reportPage.evaluateHandle(() => {
    const blocks = [...document.querySelectorAll('.block')];
    return blocks.find((b) => /Evolución/i.test(b.querySelector('h2')?.textContent || '')) || null;
  });
  const evoEl = evoBlock.asElement();
  if (evoEl) {
    await evoEl.screenshot({ path: path.join(OUT, 'informe_evolucion_line_chart.png') });
  }

  const capReportBlock = await reportPage.evaluateHandle(() => {
    const blocks = [...document.querySelectorAll('.block')];
    return blocks.find((b) => /Capítulos/i.test(b.querySelector('h2')?.textContent || '')) || null;
  });
  const capEl = capReportBlock.asElement();
  if (capEl) {
    await capEl.screenshot({ path: path.join(OUT, 'informe_capitulos_chart_table.png') });
  }

  await reportPage.screenshot({ path: path.join(OUT, 'informe_full_top.png'), fullPage: false });
  await reportPage.close();
} else {
  console.error('FAILED to capture report HTML');
  process.exitCode = 1;
}

const ok =
  evoProbe.hasLinechart &&
  evoProbe.hasPath &&
  evoProbe.hasMeta &&
  capProbe.hasGroupbars &&
  capProbe.hasTable &&
  report.length > 500;

console.log('OK', ok);
await browser.close();
if (!ok) process.exit(1);
