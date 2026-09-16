/*
 * Prueba del borrado de visitas y solicitudes en CARE 360.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const URL = process.env.CARE360_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.CARE360_TEST_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'care360-delete-'));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], protocolTimeout: 40000 });
const p = await b.newPage();
await p.setUserAgent(UA);
await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
  const probe = await fetch('/api/visits');
  const del = await fetch('/api/visits/00000000-0000-4000-8000-000000000000', { method: 'DELETE' });
  const body = await del.json().catch(() => ({}));
  return {
    visitsStatus: probe.status,
    deleteStatus: del.status,
    deleteError: body.error || '',
  };
});
check('DELETE /api/visits responde desde el runtime', runtimeOk.deleteStatus === 404, JSON.stringify(runtimeOk));

// Crear finca mínima
await p.evaluate((i) => document.querySelectorAll('.module-nav [role=tab]')[i].click(), 1);
await wait(1200);
await p.evaluate(() => {
  const details = [...document.querySelectorAll('details')].find((d) => /Registrar una finca/i.test(d.querySelector('summary')?.textContent || ''));
  if (details && !details.open) details.open = true;
});
await wait(500);
await p.evaluate(() => {
  const set = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const details = [...document.querySelectorAll('details')].find((d) => /Registrar una finca/i.test(d.querySelector('summary')?.textContent || ''));
  if (!details) return;
  const labels = [...details.querySelectorAll('label')];
  const by = (re) => labels.find((l) => re.test(l.textContent || ''));
  const name = by(/^Nombre/i)?.querySelector('input');
  if (name) set(name, 'Finca Borrar Test');
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
  if (manager) set(manager, 'Carlos Ruiz');
  [...details.querySelectorAll('input, textarea')].forEach((el) => {
    if (el.classList.contains('c360-farm-manager')) return;
    if (el.type === 'email' && !el.value) set(el, 'test@example.com');
    else if (el.type === 'tel' || /tel/i.test(el.name || '')) set(el, '3001234567');
    else if ((el.type === 'text' || el.tagName === 'TEXTAREA') && !el.value) set(el, 'Contacto Test');
  });
});
await wait(400);
const savedFarm = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Guardar finca|Registrar finca|Crear finca|Guardar/i.test(b.textContent || ''));
  if (!btn) return false;
  btn.click();
  return true;
});
await wait(2500);
check('Se puede registrar una finca para la prueba', savedFarm);

// Crear visita rápida
await p.evaluate((i) => document.querySelectorAll('.module-nav [role=tab]')[i].click(), 4);
await wait(1200);
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Nueva visita/i.test(b.textContent || ''));
  if (btn) btn.click();
});
await wait(1500);
await p.evaluate(() => {
  const set = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  [...document.querySelectorAll('.editor input')].forEach((el) => {
    if (el.type === 'date') set(el, '2026-05-21');
    else if (el.type === 'text' && !el.value) set(el, 'Finca Borrar Test');
  });
});
await wait(600);
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Guardar visita/i.test(b.textContent || ''));
  if (btn) btn.click();
});
await wait(3500);

await p.evaluate((i) => document.querySelectorAll('.module-nav [role=tab]')[i].click(), 4);
await wait(1500);
await p.evaluate(() => {
  const tab = [...document.querySelectorAll('button, [role=tab]')].find((b) => /ver visitas guardadas|visitas guardadas/i.test((b.textContent || '').trim()));
  if (tab) tab.click();
});
await wait(1200);

let beforeDelete = null;
for (let i = 0; i < 10; i++) {
  beforeDelete = await p.evaluate(async () => {
    const visits = await fetch('/api/visits').then((r) => r.json());
    const rows = [...document.querySelectorAll('.visit-row')].filter((row) =>
      [...row.querySelectorAll('button')].some((b) => /^Abrir$/i.test(b.textContent.trim()))
    );
    const row = rows[0] || null;
    const btn = row && row.querySelector('.c360-delete-btn');
    return {
      visitCount: Array.isArray(visits) ? visits.length : -1,
      hasRow: !!row,
      hasDelete: !!btn,
      rowText: row ? row.innerText.slice(0, 120) : '',
    };
  });
  if (beforeDelete.hasDelete) break;
  await wait(500);
}
check('La lista de visitas muestra el botón Borrar', beforeDelete.hasRow && beforeDelete.hasDelete, JSON.stringify(beforeDelete));
await p.screenshot({ path: path.join(OUT, 'visita_boton_borrar.png') });

const deleted = await p.evaluate(async () => {
  const before = await fetch('/api/visits').then((r) => r.json());
  const btn = document.querySelector('.visit-row .c360-delete-btn');
  if (!btn) return { ok: false, reason: 'sin botón', before: before.length };
  btn.click();
  return { ok: true, before: before.length };
});
await Promise.race([
  p.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }),
  wait(2500),
]).catch(() => {});
await wait(1500);
const afterVisits = await p.evaluate(() => fetch('/api/visits').then((r) => r.json()));
check(
  'Al confirmar, la visita se elimina del runtime',
  deleted.ok && afterVisits.length < deleted.before,
  JSON.stringify({ ...deleted, after: afterVisits.length })
);
await p.screenshot({ path: path.join(OUT, 'visita_borrada.png') });

const requestFlow = await p.evaluate(async () => {
  const team = await fetch('/api/team').then((r) => r.json());
  const farm = (team.farms || []).find((f) => /Borrar Test/i.test(f.name)) || (team.farms || [])[0];
  if (!farm) return { ok: false, reason: 'sin finca' };
  const created = await fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmId: farm.id,
      revision: 0,
      kind: 'assurance',
      reason: 'Solicitud para borrar en prueba',
      date: '2026-05-22',
      rtc: 'local',
      assignee: 'local',
      status: 'requested',
    }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  return { ok: created.status < 300, created, farmId: farm.id, farmName: farm.name };
});
check('Se crea una solicitud de prueba por API', requestFlow.ok, JSON.stringify(requestFlow.created));

await p.evaluate((i) => document.querySelectorAll('.module-nav [role=tab]')[i].click(), 3);
await wait(1200);
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Actualizar equipo/i.test(b.textContent || ''));
  if (btn) btn.click();
});
await wait(1500);
await p.evaluate(() => {
  const trigger = [...document.querySelectorAll('button[role=combobox], [data-slot=select-trigger], button')].find((b) =>
    /Selecciona una finca|Finca Borrar/i.test(b.textContent || '')
  );
  if (trigger) trigger.click();
});
await wait(700);
await p.evaluate((farmName) => {
  const opt = [...document.querySelectorAll('[role=option], [data-slot=select-item]')].find((el) =>
    new RegExp(farmName, 'i').test(el.textContent || '')
  );
  if (opt) opt.click();
}, requestFlow.farmName || 'Finca Borrar Test');
await wait(1500);

let reqUi = null;
for (let i = 0; i < 12; i++) {
  reqUi = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.visit-row')].filter((row) =>
      [...row.querySelectorAll('button')].some((b) => /solicitud/i.test(b.textContent || ''))
    );
    const row = rows.find((r) => /Solicitud para borrar|Aseguramiento/i.test(r.innerText || '')) || rows[0] || null;
    const btn = row && row.querySelector('.c360-delete-btn');
    return {
      rows: rows.length,
      hasDelete: !!btn,
      text: row ? row.innerText.slice(0, 180) : '',
      options: [...document.querySelectorAll('[role=option], [data-slot=select-item]')].map((el) => el.textContent.trim()).slice(0, 8),
    };
  });
  if (reqUi.hasDelete) break;
  await wait(500);
}
check('La solicitud muestra botón Borrar cuando está en lista', reqUi.hasDelete, JSON.stringify(reqUi));

if (reqUi.hasDelete) {
  await p.screenshot({ path: path.join(OUT, 'solicitud_boton_borrar.png') });
  const beforeReq = await p.evaluate(() => fetch('/api/requests').then((r) => r.json()));
  const nav = p.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => null);
  await p.click('.visit-row .c360-delete-btn');
  await nav;
  await wait(2000);
  const afterReq = await p.evaluate(() => fetch('/api/requests').then((r) => r.json())).catch(async () => {
    await wait(1500);
    return p.evaluate(() => fetch('/api/requests').then((r) => r.json()));
  });
  check(
    'Al confirmar, la solicitud se elimina',
    afterReq.length < beforeReq.length,
    JSON.stringify({ before: beforeReq.length, after: afterReq.length })
  );
} else {
  const apiDel = await p.evaluate(async () => {
    const list = await fetch('/api/requests').then((r) => r.json());
    const hit = list.find((x) => /Solicitud para borrar/i.test(x.reason || ''));
    if (!hit) return { ok: false };
    const res = await fetch('/api/requests/' + hit.id, { method: 'DELETE' });
    const after = await fetch('/api/requests').then((r) => r.json());
    return { ok: res.ok, after: after.length };
  });
  check('DELETE /api/requests elimina la solicitud (fallback API)', apiDel.ok, JSON.stringify(apiDel));
}

await p.screenshot({ path: path.join(OUT, 'delete_final.png') });
fs.writeFileSync(path.join(OUT, 'delete-results.json'), JSON.stringify(results, null, 2));
const passed = results.filter((r) => r.ok).length;
console.log('\n' + passed + '/' + results.length + ' comprobaciones correctas');
console.log('Capturas en ' + OUT);
await b.close();
process.exit(passed === results.length ? 0 : 1);
