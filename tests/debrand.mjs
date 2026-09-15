/*
 * Comprueba que la vista previa sin marca no muestra logos ni el nombre Avgust.
 *
 *   C360_DEBRAND=1 ../tools/dev-preview.sh
 *   CARE360_URL=http://localhost:8080/index.html npm run test:debrand
 */
import puppeteer from 'puppeteer';

const URL = process.env.CARE360_URL || 'http://localhost:8080/index.html';
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
}

const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p = await b.newPage();
await p.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36');
await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(URL, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2800));

const intro = await p.evaluate(() => {
  const overlay = document.querySelector('.c360-intro');
  const img = overlay?.querySelector('img');
  const visibleImg = img && img.getClientRects().length > 0 && getComputedStyle(img).display !== 'none';
  return {
    open: overlay?.getAttribute('data-open') === '1',
    text: overlay?.innerText || '',
    hasLogo: !!visibleImg,
    debrandFlag: window.__C360_DEBRAND === true,
  };
});
check('La bandera sin marca está activa', intro.debrandFlag);
check('La presentación no muestra el logo Avgust', !intro.hasLogo);
check('La presentación no nombra a Avgust', !/avgust/i.test(intro.text), intro.text.slice(0, 120).replace(/\n/g, ' '));
check('La presentación se presenta como CARE 360', /CARE 360/.test(intro.text));

if (intro.open) {
  await p.click('.c360-intro [data-act="skip"]');
  await new Promise((r) => setTimeout(r, 700));
}

const app = await p.evaluate(() => {
  const images = [...document.querySelectorAll('img')].filter((img) => {
    const style = getComputedStyle(img);
    return img.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  });
  const branded = images.filter((img) => /avgust/i.test((img.src || '') + (img.alt || '')));
  return {
    title: document.title,
    body: document.body.innerText,
    brandedVisible: branded.map((img) => img.src.split('/').pop() + ':' + img.alt),
  };
});
check('El título de la pestaña no dice Avgust', !/avgust/i.test(app.title), app.title);
check('No hay logotipos Avgust visibles', app.brandedVisible.length === 0, app.brandedVisible.join(', '));
check('La pantalla de Inicio no nombra a Avgust', !/avgust/i.test(app.body), app.body.slice(0, 160).replace(/\n/g, ' '));

const passed = results.filter((r) => r.ok).length;
console.log('\n' + passed + '/' + results.length + ' comprobaciones correctas');
await b.close();
process.exit(passed === results.length ? 0 : 1);
