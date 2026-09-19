/**
 * Captura Métricas Capítulos en viewport teléfono (~390px) para 1.5.20.
 */
import puppeteer from '../../../tests/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const PORT = Number(process.env.DEMO_PORT || 8766);
const OUT = process.env.C360_ARTIFACTS || '/opt/cursor/artifacts';
const OUT2 = '/home/ubuntu/.cursor/projects/workspace/artifacts';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OUT2, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function contentType(file) {
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  return 'text/html; charset=utf-8';
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  let file;
  if (urlPath.startsWith('/enhance/')) {
    file = path.join(ROOT, 'enhance/src', urlPath.slice('/enhance/'.length));
  } else {
    file = path.join(__dirname, urlPath.replace(/^\//, ''));
  }
  if (!file.startsWith(ROOT) && !file.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found: ' + urlPath);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(file) });
    res.end(data);
  });
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const URL = `http://127.0.0.1:${PORT}/index.html`;
console.log('Serving', URL);

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=390,844'],
  defaultViewport: null,
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.addStyleTag({ url: `http://127.0.0.1:${PORT}/enhance/care360-pro.css` });
await wait(1500);
await page.waitForSelector('#c360-metrics-board', { timeout: 20000 });

await page.evaluate(() => {
  document.querySelector('#c360-metrics-board [data-mode="farm"]')?.click();
});
await wait(400);
await page.evaluate(() => {
  const sel = document.querySelector('#c360-metrics-board select[data-field="farm"]');
  if (sel) {
    const opt = [...sel.options].find((o) => /San Isidro/i.test(o.value + ' ' + o.textContent));
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
});
await wait(1000);

// Force farm mode if still all
await page.evaluate(() => {
  const farmBtn = document.querySelector('#c360-metrics-board [data-mode="farm"]');
  if (farmBtn && !farmBtn.classList.contains('active')) farmBtn.click();
});
await wait(800);

// Inject Guardado pill like production — on metrics it must stay hidden when tone=ok
await page.evaluate(() => {
  document.body.classList.add('c360-on-metrics');
  let pill = document.querySelector('.c360-pro-save');
  if (!pill) {
    pill = document.createElement('div');
    pill.className = 'c360-pro-save';
    document.body.appendChild(pill);
  }
  // Simulate production mirrorSaveStatus: hide ok toast on metrics
  pill.removeAttribute('data-visible');
  pill.setAttribute('data-tone', 'ok');
  pill.textContent = '✓ Guardado · 22:26';
});

const probe = await page.evaluate(() => {
  const block = document.querySelector('.c360-metrics-capsub-block');
  const notes = [...(block?.querySelectorAll('.c360-groupbars-note, .c360-metrics-card-head p') || [])].map(
    (n) => (n.textContent || '').trim()
  );
  const labels = [...(block?.querySelectorAll('.c360-groupbars-xlabel') || [])].map((n) =>
    (n.textContent || '').replace(/\s+/g, ' ').trim()
  );
  const alerts = document.querySelector('.c360-metrics-alerts-bar');
  const pill = document.querySelector('.c360-pro-save');
  const table = document.querySelector('.c360-capsub-table-wrap');
  let overlap = false;
  const pillVisible = !!(pill && pill.getAttribute('data-visible') === '1');
  if (pillVisible && table) {
    const pr = pill.getBoundingClientRect();
    const tr = table.getBoundingClientRect();
    overlap = !(pr.bottom < tr.top || pr.top > tr.bottom || pr.right < tr.left || pr.left > tr.right);
  }
  return {
    subtitle: notes[0] || '',
    noteCount: (block?.querySelectorAll('.c360-groupbars-note') || []).length,
    labels,
    alertsCollapsed: alerts?.classList.contains('is-collapsed') || false,
    alertsOpen: alerts?.classList.contains('is-open') || false,
    guardadoVisible: pillVisible,
    guardadoTop: pillVisible && pill ? pill.getBoundingClientRect().top : null,
    overlapTable: overlap,
    boardTextSample: (document.querySelector('#c360-metrics-board')?.innerText || '').slice(0, 280),
  };
});
console.log('PROBE', JSON.stringify(probe, null, 2));

await page.evaluate(() => {
  document.querySelector('.c360-metrics-capsub-block')?.scrollIntoView({ block: 'start' });
});
await wait(350);

const names = [
  'metricas_phone_390_capitulos_clean_1520.png',
  'metricas_phone_390_capitulos_con_guardado_1520.png',
];

const shot1 = path.join(OUT, names[0]);
await page.screenshot({ path: shot1, fullPage: false });
fs.copyFileSync(shot1, path.join(OUT2, names[0]));

// Crop Capítulos block alone
const block = await page.$('.c360-metrics-capsub-block');
if (block) {
  const crop = path.join(OUT, 'metricas_phone_390_capitulos_block_1520.png');
  await block.screenshot({ path: crop });
  fs.copyFileSync(crop, path.join(OUT2, 'metricas_phone_390_capitulos_block_1520.png'));
}

// Full viewport with Guardado visible near top of metrics
await page.evaluate(() => {
  document.querySelector('#c360-metrics-board')?.scrollIntoView({ block: 'start' });
  window.scrollTo(0, 0);
});
await wait(200);
const shot2 = path.join(OUT, names[1]);
await page.screenshot({ path: shot2, fullPage: false });
fs.copyFileSync(shot2, path.join(OUT2, names[1]));

// Qué atender collapsed near Capítulos
await page.evaluate(() => {
  document.querySelector('.c360-metrics-alerts-bar')?.scrollIntoView({ block: 'start' });
});
await wait(200);
const shot3 = path.join(OUT, 'metricas_phone_390_que_atender_collapsed_1520.png');
await page.screenshot({ path: shot3, fullPage: false });
fs.copyFileSync(shot3, path.join(OUT2, 'metricas_phone_390_que_atender_collapsed_1520.png'));

await browser.close();
server.close();
console.log('OK phone screenshots →', OUT);
