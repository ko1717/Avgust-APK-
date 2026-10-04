/*
 * Pruebas de la capa profesional CARE 360 1.5.13.
 * La edición con marca muestra Avgust. La edición sin marca no.
 *
 * Verificaciones estáticas: no requieren servidor ni navegador.
 *
 *   node pro.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
}
const read = (p) => fs.readFileSync(path.join(root, p), 'utf-8');

const css = read('enhance/src/care360-pro.css');
const js = read('enhance/src/care360-pro.js');
const build = read('tools/build-apk.sh');
const preview = read('tools/dev-preview.sh');
const debrandPy = read('tools/debrand_web.py');

check('existe care360-pro.css', css.length > 2000, css.length + ' caracteres');
check('existe care360-pro.js', js.length > 2000, js.length + ' caracteres');

check('build-apk enlaza care360-pro.css', build.includes('care360-pro.css'));
check('build-apk enlaza care360-pro.js', build.includes('care360-pro.js'));
check('dev-preview enlaza care360-pro.css', preview.includes('care360-pro.css'));
check('dev-preview enlaza care360-pro.js', preview.includes('care360-pro.js'));

check('versión de edición sin marca sale de version.json', build.includes('DEFAULT_VERSION_NAME') && build.includes('version.json'));
check('código de versión sale de version.json', build.includes('DEFAULT_VERSION_CODE') && build.includes('version.json'));
check('build-apk exige CARE360_KEYSTORE_PASS', build.includes('CARE360_KEYSTORE_PASS'));
check('build-apk exige CARE360_KEY_PASS', build.includes('CARE360_KEY_PASS'));
check('build-apk no asigna contraseña por defecto', !/CARE360_KEYSTORE_PASS:-/.test(build) && !/CARE360_KEY_PASS:-/.test(build));
check('build-apk no genera un almacén nuevo', !/keytool\s+-genkeypair/.test(build));

for (const feat of ['Care360Pro', 'c360-pro-conn', 'c360-pro-filter', 'c360-sun', 'c360-pro-save', 'c360-pro-report-head', 'MIPE']) {
  check(`pro.js incluye ${feat}`, js.includes(feat));
}
for (const sel of ['c360-pro-filter', 'c360-pro-save', 'c360-pro-report-head', 'c360-sun', '@media print', 'c360-debrand', ':focus-visible']) {
  check(`pro.css incluye ${sel}`, css.includes(sel));
}
check('pro.css trae membrete de informe impreso', /CARE 360.*Informe t/i.test(css));
check('pro.js nunca lanza excepciones fuera (defensivo)', /nunca romper la app|defensivo/i.test(js));
check('filtros acotados a vistas de primer nivel (:scope)', js.includes(':scope >'));
check('filtros con tope global anti-ruido', />= 12/.test(js));
check('filtros exigen lista con contenido (mínimo 3)', /count < 3/.test(js));
check('filtros no duplican el buscador operativo de visitas', js.includes('c360-visit-search'));
check('pro.css oculta el texto de marca original tras el lockup', css.includes('.brand[data-c360-pro="1"]'));

check('favicon profesional con verde agro', debrandPy.includes('#14532d') && debrandPy.includes('M24 44'));
check('tema profesional reemplaza el azul legado', debrandPy.includes('PRO_THEME') && debrandPy.includes('#007fa3'));

const debrandStart = js.indexOf('mark.innerHTML = debrand');
const debrandEnd = js.indexOf(': AVGUST_LOGO', debrandStart);
const debrandArm = debrandStart >= 0 && debrandEnd > debrandStart ? js.slice(debrandStart, debrandEnd) : '';
const debrandCss = read('enhance/src/care360-debrand.css');
const debrandPrint = css.match(/html\.c360-debrand \.workspace::before\s*\{[^}]+\}/);
check(
  'sin marca visible Avgust en la edición sin marca',
  debrandArm.length > 0 &&
    !/AVGUST CARE|Avgust Crop|avgust-logo/i.test(debrandArm) &&
    /CARE 360/.test(debrandArm) &&
    /img\[src\*="avgust-logo"\]/.test(debrandCss) &&
    /display:\s*none\s*!important/.test(debrandCss) &&
    !!debrandPrint &&
    !/AVGUST/i.test(debrandPrint[0]) &&
    /CARE 360/.test(debrandPrint[0]),
  debrandArm.replace(/\s+/g, ' ').slice(0, 140)
);
check(
  'la edición con marca muestra el nombre Avgust',
  /AVGUST CARE 360/.test(js) &&
    /avgust-logo\.svg/.test(js) &&
    /is-avgust/.test(js) &&
    /html\.c360-branded/.test(css) &&
    /AVGUST CARE 360 · Informe técnico/.test(css)
);

const printCss = css.slice(css.indexOf('@media print'));
check('el impreso no fija el verde #14532d', !/#14532d/.test(printCss));
check(
  'el impreso usa la identidad activa',
  /var\(--c360-brand-strong\)/.test(printCss) && /var\(--c360-brand\)/.test(printCss)
);
check(
  'objetivos de 44px en pasos, filas y acciones de informe',
  /\.steps \[data-slot="tabs-trigger"\][\s\S]{0,600}min-height:\s*44px/.test(css) &&
    /\.visit-row[\s\S]{0,400}min-height:\s*44px/.test(css) &&
    /report-version-actions button[\s\S]{0,400}min-height:\s*44px/.test(css)
);
check(
  'el estado de guardado sube con el teclado',
  /html\.c360-keyboard \.c360-pro-save[\s\S]{0,240}--c360-keyboard-h/.test(css) &&
    css.includes('c360-pro-sunbtn')
);

const enhance = read('enhance/src/care360-enhance.css');
check(
  'en el teléfono cabecera y módulos forman un bloque más bajo',
  /--c360-topbar-h:\s*52px/.test(enhance) &&
    /--c360-nav-h:\s*44px/.test(enhance) &&
    /--c360-topbar-h:\s*66px/.test(enhance) &&
    /--c360-nav-h:\s*68px/.test(enhance)
);

const intro = read('enhance/src/care360-presentation.js');
const ops = read('enhance/src/care360-ops.js');
check(
  'con visita abierta la guía no ocupa la primera sesión',
  /function visitIsOpen/.test(intro) &&
    /goToPending/.test(intro) &&
    /decideFirstRun/.test(intro) &&
    /c360-hud-next/.test(intro) &&
    intro.includes('>Guía<')
);
check('sin visita se mantiene la guía', /open\(0\)/.test(intro));
check('el panel de calidad expone el siguiente pendiente', ops.includes('focusNextGap'));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas superadas.`);
if (failed.length) process.exit(1);
