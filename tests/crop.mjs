/*
 * Prueba: tipo de cultivo en datos de visita y encabezado del informe.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const URL = process.env.CARE360_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.CARE360_TEST_OUT || '/opt/cursor/artifacts/crop-test';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, extra) => {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], protocolTimeout: 40000 });
const p = await b.newPage();
await p.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36');
await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

await p.goto(URL, { waitUntil: 'networkidle2' });
await wait(2800);
await p.evaluate(() => document.querySelector('.c360-intro [data-act="skip"]')?.click());
await wait(800);

await p.evaluate((i) => document.querySelectorAll('.module-nav [role=tab]')[i].click(), 4);
await wait(1200);
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Nueva visita/i.test(b.textContent || ''));
  if (btn) btn.click();
});
await wait(1800);

const fieldOk = await p.evaluate(() => {
  const set = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const labels = [...document.querySelectorAll('.form-body label, .fields label, label')];
  const cropLabel = labels.find((l) => /^Tipo de cultivo/i.test((l.childNodes[0] && l.childNodes[0].textContent) || l.textContent || ''));
  const cropInput = cropLabel && cropLabel.querySelector('input');
  if (cropInput) set(cropInput, 'Rosa exportación');
  const farm = labels.find((l) => /Nombre de la finca/i.test(l.textContent || ''));
  if (farm?.querySelector('input')) set(farm.querySelector('input'), 'Finca Cultivo Demo');
  const date = labels.find((l) => /Fecha de visita/i.test(l.textContent || ''));
  if (date?.querySelector('input')) set(date.querySelector('input'), '2026-06-10');
  const tech = labels.find((l) => /Representante de la finca/i.test(l.textContent || ''));
  if (tech?.querySelector('input')) set(tech.querySelector('input'), 'Ana López');
  const resp = labels.find((l) => /Responsable técnico/i.test(l.textContent || ''));
  if (resp?.querySelector('input')) set(resp.querySelector('input'), 'Wilson Castro');
  return {
    hasCrop: !!cropInput,
    cropValue: cropInput?.value || '',
    labelText: cropLabel ? cropLabel.childNodes[0]?.textContent || cropLabel.textContent.slice(0, 40) : '',
  };
});
check('El campo Tipo de cultivo está en Datos de la finca', fieldOk.hasCrop && fieldOk.cropValue === 'Rosa exportación', JSON.stringify(fieldOk));
await p.evaluate(() => {
  const label = [...document.querySelectorAll('label')].find((l) => /^Tipo de cultivo/i.test((l.childNodes[0] && l.childNodes[0].textContent) || ''));
  if (label) label.scrollIntoView({ block: 'center' });
});
await wait(400);
await p.screenshot({ path: path.join(OUT, 'visita_tipo_cultivo_campo.png') });

// Ir al informe
const toReport = await p.evaluate(() => {
  const tab = [...document.querySelectorAll('.steps [role=tab], button')].find((b) => /04 Informe|05 Informe|Informe/i.test(b.textContent || ''));
  if (tab) { tab.click(); return tab.textContent.trim(); }
  return '';
});
await wait(2000);
const header = await p.evaluate(() => {
  const paper = document.querySelector('.report-paper');
  if (!paper) return { ok: false, text: '' };
  const text = paper.innerText;
  const rows = [...paper.querySelectorAll('tr')].map((tr) => tr.innerText.replace(/\t/g, ' | ').replace(/\n/g, ' | '));
  const cropRow = rows.find((r) => /Tipo de cultivo/i.test(r));
  return {
    ok: /Tipo de cultivo/i.test(text) && /Rosa exportación/i.test(text),
    cropRow: cropRow || '',
    subtitle: [...paper.querySelectorAll('p')].map((p) => p.textContent.trim()).slice(0, 4),
    text: text.slice(0, 500),
  };
});
check('El encabezado del informe muestra el tipo de cultivo', header.ok, JSON.stringify({ cropRow: header.cropRow, subtitle: header.subtitle }));
await p.evaluate(() => document.querySelector('.report-paper')?.scrollIntoView({ block: 'start' }));
await wait(400);
await p.screenshot({ path: path.join(OUT, 'informe_encabezado_cultivo.png') });

// Guardar y comprobar persistencia API
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Guardar visita/i.test(b.textContent || ''));
  if (btn) btn.click();
});
await wait(3500);
const saved = await p.evaluate(async () => {
  const visits = await fetch('/api/visits').then((r) => r.json());
  const hit = (visits || []).find((v) => /Cultivo Demo/i.test(v.farm || '')) || visits[0];
  return hit ? { crop: hit.crop, farm: hit.farm, id: hit.id } : null;
});
check('El cultivo queda guardado en la visita', !!(saved && saved.crop === 'Rosa exportación'), JSON.stringify(saved));

fs.writeFileSync(path.join(OUT, 'crop-results.json'), JSON.stringify(results, null, 2));
const passed = results.filter((r) => r.ok).length;
console.log('\n' + passed + '/' + results.length + ' comprobaciones correctas');
await b.close();
process.exit(passed === results.length ? 0 : 1);
