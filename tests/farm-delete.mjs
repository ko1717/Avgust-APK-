/*
 * Prueba de Borrar finca + comprobación de overflow en tablet.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';

const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const URL = process.env.CARE360_URL || 'http://127.0.0.1:8080/index.html';
const OUT =
  process.env.CARE360_TEST_OUT ||
  fs.mkdtempSync(path.join(os.tmpdir(), 'care360-farm-delete-'));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  protocolTimeout: 60000,
});
const p = await b.newPage();
await p.setUserAgent(UA);
await p.setViewport({ width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
p.on('dialog', async (dialog) => {
  await dialog.accept();
});

await p.goto(URL, { waitUntil: 'networkidle2' });
await wait(2800);
await p.evaluate(() => {
  const skip = document.querySelector('.c360-intro [data-act="skip"]');
  if (skip) skip.click();
});
await wait(800);

const runtimeOk = await p.evaluate(async () => {
  const del = await fetch('/api/farms/00000000-0000-4000-8000-000000000000', { method: 'DELETE' });
  const body = await del.json().catch(() => ({}));
  return { deleteStatus: del.status, deleteError: body.error || '' };
});
check(
  'DELETE /api/farms responde desde el runtime',
  runtimeOk.deleteStatus === 404,
  JSON.stringify(runtimeOk)
);

// Ir a Fincas y registrar
await p.evaluate((i) => document.querySelectorAll('.module-nav [role=tab]')[i].click(), 1);
await wait(1400);
await p.evaluate(() => {
  const details = [...document.querySelectorAll('details')].find((d) =>
    /Registrar una finca/i.test(d.querySelector('summary')?.textContent || '')
  );
  if (details && !details.open) details.open = true;
});
await wait(400);
await p.evaluate(() => {
  const set = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const details = [...document.querySelectorAll('details')].find((d) =>
    /Registrar una finca/i.test(d.querySelector('summary')?.textContent || '')
  );
  if (!details) return;
  const labels = [...details.querySelectorAll('label')];
  const by = (re) => labels.find((l) => re.test(l.textContent || ''));
  const name = by(/^Nombre/i)?.querySelector('input');
  if (name) set(name, 'Finca Borrar Demo 1431');
  const dept = details.querySelector('.c360-geo-dept');
  const muni = details.querySelector('.c360-geo-muni');
  const manager = details.querySelector('.c360-farm-manager');
  if (dept) {
    dept.value = 'Cundinamarca';
    dept.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (muni) {
    muni.disabled = false;
    muni.innerHTML = '<option value="Chía">Chía</option>';
    muni.value = 'Chía';
    muni.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (manager) set(manager, 'Ana Pérez');
  [...details.querySelectorAll('input, textarea')].forEach((el) => {
    if (el.classList.contains('c360-farm-manager')) return;
    if (el.type === 'email' && !el.value) set(el, 'test@example.com');
    else if (el.type === 'tel' || /tel/i.test(el.name || '')) set(el, '3001234567');
    else if ((el.type === 'text' || el.tagName === 'TEXTAREA') && !el.value) set(el, 'Contacto Demo');
  });
});
await wait(300);
const savedFarm = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) =>
    /Guardar finca|Registrar finca|Crear finca|Guardar/i.test(b.textContent || '')
  );
  if (!btn) return false;
  btn.click();
  return true;
});
await wait(2800);
check('Se puede registrar una finca para borrar', savedFarm);

const before = await p.evaluate(async () => {
  const team = await fetch('/api/team').then((r) => r.json());
  const farm = (team.farms || []).find((f) => /Borrar Demo 1431/i.test(f.name));
  return { count: (team.farms || []).length, farmId: farm?.id || '', farmName: farm?.name || '' };
});
check('La finca de prueba existe en /api/team', !!before.farmId, JSON.stringify(before));

// Seleccionar finca en el selector
await p.evaluate(async (farmName) => {
  const trigger =
    [...document.querySelectorAll('label')].find((l) => /Finca de trabajo/i.test(l.textContent || '')) ||
    document.body;
  const btn =
    trigger.querySelector('button[role="combobox"]') ||
    trigger.parentElement?.querySelector('button[role="combobox"]') ||
    [...document.querySelectorAll('button[role="combobox"]')].find((b) =>
      /Selecciona una finca|Finca|trabajo/i.test(b.textContent || '')
    );
  if (btn) btn.click();
  await new Promise((r) => setTimeout(r, 400));
  const opt = [...document.querySelectorAll('[role="option"], [data-slot="select-item"]')].find((el) =>
    new RegExp(farmName, 'i').test(el.textContent || '')
  );
  if (opt) opt.click();
}, before.farmName || 'Finca Borrar Demo 1431');
await wait(1800);

// Si el selector no abrió, forzar barra con una sola finca detalle
await p.evaluate(() => {
  // esperar a que enhanceFarmDelete monte la barra
});
await wait(1200);

let barVisible = await p.evaluate(() => !!document.querySelector('#c360-farm-actions .c360-farm-delete-btn'));
if (!barVisible && before.farmId) {
  // Fallback API delete still validates runtime; UI may need farm selected
  await p.evaluate(async (farmId) => {
    // Open any visible farm detail by clicking Actualizar equipo then re-check
    const refresh = [...document.querySelectorAll('button')].find((b) => /Actualizar equipo/i.test(b.textContent || ''));
    if (refresh) refresh.click();
  }, before.farmId);
  await wait(2000);
  // Try select again with native approach
  await p.evaluate((farmName) => {
    const options = [...document.querySelectorAll('[role="option"], li, button, div')];
    const hit = options.find((el) => el.textContent?.trim() === farmName);
    if (hit) hit.click();
  }, before.farmName);
  await wait(1500);
  barVisible = await p.evaluate(() => !!document.querySelector('#c360-farm-actions .c360-farm-delete-btn'));
}

check('Aparece el botón Borrar finca con finca seleccionada', barVisible);

await p.screenshot({ path: path.join(OUT, 'finca_borrar_boton.png'), fullPage: true });

const toolsOk = await p.evaluate(() => ({
  importPanel: !!document.querySelector('#c360-farms-import'),
  tools: !!document.querySelector('#c360-farms-tools'),
  overflowX: document.documentElement.scrollWidth <= window.innerWidth + 1,
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
}));
check('Panel Importar finca visible en Fincas', toolsOk.importPanel, JSON.stringify(toolsOk));
check('Sin overflow horizontal en tablet 768', toolsOk.overflowX, JSON.stringify(toolsOk));

if (barVisible) {
  await p.click('#c360-farm-actions .c360-farm-delete-btn');
  try {
    await p.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 });
  } catch (_) {
    /* may refresh without full navigation */
  }
  await wait(2500);
} else if (before.farmId) {
  // Direct API path if UI select failed — still prove cascade delete
  await p.evaluate(async (id) => {
    await fetch('/api/farms/' + id, { method: 'DELETE' });
  }, before.farmId);
  await wait(800);
}

const after = await p.evaluate(async (farmId) => {
  async function json(url) {
    const res = await fetch(url);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { __html: true, status: res.status, sample: text.slice(0, 80) };
    }
  }
  const team = await json('/api/team');
  if (team.__html) return { still: true, error: 'team not json', team };
  const visits = await json('/api/visits');
  const still = (team.farms || []).some((f) => f.id === farmId);
  return {
    still,
    farmCount: (team.farms || []).length,
    visitCount: Array.isArray(visits) ? visits.length : -1,
  };
}, before.farmId);

check('La finca ya no está en /api/team tras borrar', !after.still, JSON.stringify(after));
await p.screenshot({ path: path.join(OUT, 'finca_borrada.png'), fullPage: true });

// Métricas overflow check
const metricsTab = await p.evaluate(() => {
  const tabs = [...document.querySelectorAll('.module-nav [role=tab]')];
  const hit = tabs.find((t) => /Métricas/i.test(t.textContent || ''));
  if (hit) {
    hit.click();
    return true;
  }
  return false;
});
await wait(2000);
const metricsOverflow = await p.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth <= window.innerWidth + 1,
  hasBoard: !!document.querySelector('.c360-metrics-board, .metrics-panel, [class*="metrics"]'),
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
}));
check('Métricas sin overflow horizontal (tablet)', metricsOverflow.overflowX, JSON.stringify(metricsOverflow));
await p.screenshot({ path: path.join(OUT, 'metricas_tablet_768_post.png'), fullPage: true });

fs.writeFileSync(path.join(OUT, 'farm-delete-results.json'), JSON.stringify({ results, before, after, toolsOk, metricsOverflow }, null, 2));
console.log('OUT=' + OUT);
const failed = results.filter((r) => !r.ok);
await b.close();
process.exit(failed.length ? 1 : 0);
