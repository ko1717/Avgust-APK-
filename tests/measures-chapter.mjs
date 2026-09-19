/*
 * Mediciones dentro del capítulo de evaluación + mezcla final.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const URL = process.env.CARE360_URL || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.CARE360_TEST_OUT || '/opt/cursor/artifacts/measures-chapter-test';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, extra) => {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], protocolTimeout: 40000 });
const p = await b.newPage();
await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(URL, { waitUntil: 'networkidle2' });
await wait(2800);
await p.evaluate(() => document.querySelector('.c360-intro [data-act="skip"]')?.click());
await wait(800);

await p.evaluate(() => {
  const tabs = [...document.querySelectorAll('.module-nav [role=tab], .module-nav button, nav [role=tab]')];
  const visitas = tabs.find((t) => /Visitas/i.test(t.textContent || '')) || tabs[4];
  visitas?.click();
});
await wait(1000);
await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Nueva visita/i.test(b.textContent || ''))?.click());
await wait(1600);

// Ensure chapters 4 and 5 selected in Datos
await p.evaluate(() => {
  const choices = [...document.querySelectorAll('.chapter-choice')];
  choices.forEach((el) => {
    const text = el.textContent || '';
    const want = /Preparación de mezclas|Aplicación de PPC/i.test(text);
    const checked = el.classList.contains('chosen') || el.querySelector('[data-state="checked"], [aria-checked="true"]');
    if (want && !checked) el.click();
    if (!want && checked) el.click();
  });
});
await wait(500);

const steps = await p.evaluate(() => [...document.querySelectorAll('.steps [role=tab], .steps button')].map((t) => t.textContent.trim()));
check('Ya no existe el paso 02 Mediciones aparte', !steps.some((t) => /Mediciones/i.test(t)) && steps.some((t) => /Evaluación/i.test(t)), steps.join(' | '));

await p.evaluate(() => [...document.querySelectorAll('.steps [role=tab]')].find((t) => /Evaluación/i.test(t.textContent || ''))?.click());
await wait(1500);

// Select chapter 4 if needed
await p.evaluate(async () => {
  const trigger = [...document.querySelectorAll('button[role=combobox], [data-slot=select-trigger]')].find((b) =>
    /Capítulo|Preparación|Aplicación|Almacén|Medición|Transporte/i.test(b.textContent || '')
  );
  if (!trigger) return;
  if (!/Preparación de mezclas/i.test(trigger.textContent || '')) {
    trigger.click();
    await new Promise((r) => setTimeout(r, 400));
    const opt = [...document.querySelectorAll('[role=option], [data-slot=select-item]')].find((el) =>
      /Preparación de mezclas/i.test(el.textContent || '')
    );
    if (opt) opt.click();
  }
});
await wait(1200);

const cap4 = await p.evaluate(() => {
  const groups = [...document.querySelectorAll('.c360-chapter-measure')].map((el) => ({
    group: el.getAttribute('data-group'),
    badge: el.querySelector('.c360-measure-badge')?.textContent || '',
    title: el.querySelector('h4')?.textContent || '',
    labels: [...el.querySelectorAll('label')].map((l) => (l.childNodes[0]?.textContent || l.textContent || '').trim()),
  }));
  const sourceHidden = !!document.querySelector('.c360-measure-heading, [data-c360-measure-source]');
  const bottomDumpVisible = [...document.querySelectorAll('.form-body h3')].some((h) => {
    if (!/Mediciones de campo/i.test(h.textContent || '')) return false;
    const rect = h.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2 && getComputedStyle(h).visibility !== 'hidden';
  });
  const q46 = [...document.querySelectorAll('.question')].find((q) => q.querySelector('.question-code')?.textContent.trim() === '4.6');
  const agua = document.querySelector('.c360-chapter-measure[data-group="agua"]');
  const mezcla = document.querySelector('.c360-chapter-measure[data-group="mezcla"]');
  const aguaAfter = q46 && agua ? q46.compareDocumentPosition(agua) & Node.DOCUMENT_POSITION_FOLLOWING : false;
  const mezclaAfterAgua =
    agua && mezcla ? agua.compareDocumentPosition(mezcla) & Node.DOCUMENT_POSITION_FOLLOWING : false;
  const mezclaLabels = groups.find((g) => g.group === 'mezcla')?.labels || [];
  const radioLabels = [...document.querySelectorAll('.question label, .question [role=radio], .answer-option')]
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean);
  const hasCumple = radioLabels.some((t) => /^Sí cumple$/i.test(t)) && radioLabels.some((t) => /^No cumple$/i.test(t));
  return {
    groups,
    sourceHidden,
    bottomDumpVisible,
    aguaAfter,
    mezclaAfterAgua,
    hasMezcla: !!mezcla,
    mezclaOn46: groups.some((g) => g.group === 'mezcla' && /4\.6/.test(g.badge)),
    mezclaHasConductivity: mezclaLabels.some((t) => /Conductividad mezcla final/i.test(t)),
    hasCumple,
    radioSample: [...new Set(radioLabels)].slice(0, 8),
  };
});
check('En cap. 4 aparecen calidad del agua y mezcla final', cap4.groups.some((g) => g.group === 'agua') && cap4.hasMezcla, JSON.stringify(cap4.groups));
check('Las mediciones del bloque suelto no se ven en evaluación', !cap4.bottomDumpVisible, JSON.stringify({ bottomDumpVisible: cap4.bottomDumpVisible }));
check('Calidad del agua queda después del criterio 4.6', !!cap4.aguaAfter);
check('Mezcla final queda junto a 4.6 debajo del agua', !!cap4.mezclaAfterAgua && !!cap4.mezclaOn46, JSON.stringify({ mezclaAfterAgua: cap4.mezclaAfterAgua, mezclaOn46: cap4.mezclaOn46 }));
check('Mezcla final usa conductividad', !!cap4.mezclaHasConductivity, JSON.stringify(cap4.groups.find((g) => g.group === 'mezcla')));
check('Las respuestas dicen Sí cumple / No cumple', !!cap4.hasCumple, JSON.stringify(cap4.radioSample));
check(
  'No se muestra el recuadro de observaciones del capítulo',
  await p.evaluate(() => {
    const box = document.querySelector('.fields.chapter-notes');
    if (!box) return true;
    const style = getComputedStyle(box);
    const rect = box.getBoundingClientRect();
    return box.hidden || style.display === 'none' || rect.height < 2;
  })
);
check(
  'El criterio 4.6 ya no trae asteriscos ni parametros sin tilde',
  await p.evaluate(() => {
    const q46 = [...document.querySelectorAll('.question')].find((q) => q.querySelector('.question-code')?.textContent.trim() === '4.6');
    const text = (q46 && q46.textContent) || '';
    return /parámetros/.test(text) && /5\.5/.test(text) && !/\*\*/.test(text) && !/parametros/.test(text);
  })
);

// Fill mezcla final and scroll to it
await p.evaluate(() => {
  const set = (el, v) => {
    const proto = HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const mezcla = document.querySelector('.c360-chapter-measure[data-group="mezcla"]');
  mezcla?.scrollIntoView({ block: 'center' });
  [...(mezcla?.querySelectorAll('input') || [])].forEach((inp, i) => set(inp, i === 0 ? '6.0' : '55'));
  const agua = document.querySelector('.c360-chapter-measure[data-group="agua"]');
  [...(agua?.querySelectorAll('input') || [])].forEach((inp, i) => set(inp, ['6.2', '40', '0.3'][i] || '1'));
});
await wait(400);
await p.screenshot({ path: path.join(OUT, 'evaluacion_cap4_mezcla_final.png') });

// Switch to chapter 5
await p.evaluate(async () => {
  const trigger = [...document.querySelectorAll('button[role=combobox], [data-slot=select-trigger]')].find((b) =>
    /Capítulo|Preparación|Aplicación/i.test(b.textContent || '')
  );
  if (!trigger) return;
  trigger.click();
  await new Promise((r) => setTimeout(r, 400));
  const opt = [...document.querySelectorAll('[role=option], [data-slot=select-item]')].find((el) =>
    /Aplicación de PPC/i.test(el.textContent || '')
  );
  if (opt) opt.click();
});
await wait(1200);

const cap5 = await p.evaluate(() => {
  const groups = [...document.querySelectorAll('.c360-chapter-measure')].map((el) => ({
    group: el.getAttribute('data-group'),
    labels: [...el.querySelectorAll('label')].map((l) => (l.childNodes[0]?.textContent || l.textContent || '').trim()),
  }));
  const ids = groups.map((g) => g.group);
  const presion = groups.find((g) => g.group === 'presion');
  const labels = (presion && presion.labels) || [];
  const bombaIdx = labels.findIndex((t) => /bomba|Presión \(PSI\)/i.test(t));
  const implementoIdx = labels.findIndex((t) => /implemento/i.test(t));
  return {
    groups: ids,
    hasPresion: ids.includes('presion'),
    hasEquipo: ids.includes('equipo'),
    hasCama: ids.includes('cama'),
    noAgua: !ids.includes('agua'),
    pressureLabels: labels,
    implementUnderPump: bombaIdx >= 0 && implementoIdx === bombaIdx + 1,
  };
});
check('En cap. 5 solo salen presión, equipo y volumen/tiempo', cap5.hasPresion && cap5.hasEquipo && cap5.hasCama && cap5.noAgua, JSON.stringify(cap5));
check(
  'Debajo de presión de la bomba aparece presión del implemento',
  !!cap5.implementUnderPump,
  JSON.stringify(cap5.pressureLabels)
);
await p.screenshot({ path: path.join(OUT, 'evaluacion_cap5_mediciones.png') });

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
fs.copyFileSync(path.join(OUT, 'evaluacion_cap4_mezcla_final.png'), '/opt/cursor/artifacts/evaluacion_cap4_mezcla_final.png');
fs.copyFileSync(path.join(OUT, 'evaluacion_cap5_mediciones.png'), '/opt/cursor/artifacts/evaluacion_cap5_mediciones.png');
const passed = results.filter((r) => r.ok).length;
console.log('\n' + passed + '/' + results.length + ' comprobaciones correctas');
await b.close();
process.exit(passed === results.length ? 0 : 1);
