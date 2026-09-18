/**
 * Captura adicional de Evolución + capítulos desde la demo estática
 * (mock /api/visits) en viewport tablet.
 */
import puppeteer from '../../tests/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import fs from 'fs';

const URL = process.env.DEMO_URL || 'http://127.0.0.1:8765/index.html';
const OUT = process.env.C360_ARTIFACTS || '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=820,1180'],
  defaultViewport: null,
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await wait(2000);

await page.waitForSelector('#c360-metrics-board', { timeout: 20000 });
await wait(800);

// Abrir finca San Isidro
await page.evaluate(() => {
  const farmBtn = document.querySelector('#c360-metrics-board [data-mode="farm"]');
  if (farmBtn) farmBtn.click();
});
await wait(500);
await page.evaluate(() => {
  const sel = document.querySelector('#c360-metrics-board select[data-field="farm"]');
  if (sel) {
    const opt = [...sel.options].find((o) => /San Isidro/i.test(o.value + ' ' + o.textContent));
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } else {
    const card = [...document.querySelectorAll('[data-open-farm]')].find((el) =>
      /San Isidro/i.test(el.getAttribute('data-open-farm') || el.textContent || '')
    );
    if (card) card.click();
  }
});
await wait(1200);

const info = await page.evaluate(() => {
  const board = document.querySelector('#c360-metrics-board');
  const hits = board?.querySelectorAll('.c360-linechart [data-focus-score], .c360-linechart circle[data-focus-date]');
  return {
    head: board?.querySelector('.c360-metrics-head-main')?.innerText?.replace(/\s+/g, ' ').trim(),
    hits: hits?.length || 0,
    evolucion: /Evolución/i.test(board?.innerText || ''),
  };
});
console.log('DEMO', JSON.stringify(info));

await page.evaluate(() => document.querySelector('.c360-linechart')?.scrollIntoView({ block: 'center' }));
await wait(200);
const line = await page.$('.c360-linechart');
if (line) await line.screenshot({ path: OUT + '/metricas_4_informes_evolucion_chart.png' });

await page.evaluate(() => {
  const el = [...document.querySelectorAll('.c360-metrics-card, .c360-metrics-panel')].find((n) =>
    /Capítulos/i.test(n.innerText || '')
  );
  el?.scrollIntoView({ block: 'start' });
});
await wait(300);
await page.screenshot({ path: OUT + '/metricas_4_informes_capitulos.png', fullPage: false });

const chaptersBlock = await page.evaluateHandle(() => {
  return (
    [...document.querySelectorAll('.c360-metrics-card, section, article')].find((n) =>
      /Capítulos · última visita/i.test(n.innerText || '')
    ) || document.querySelector('.c360-metrics-charts')
  );
});
if (chaptersBlock.asElement()) {
  await chaptersBlock.asElement().screenshot({ path: OUT + '/metricas_4_informes_finca_capitulos.png' });
}

await browser.close();
console.log('OK demo screenshots');
