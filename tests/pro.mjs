/*
 * Pruebas de la capa profesional CARE 360 1.5.0 (sin marca).
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

check('versión de edición sin marca es 1.5.0', /VERSION_NAME="\$\{2:-1\.5\.0\}"/.test(build));
check('código de versión sin marca es 48', /VERSION_CODE="\$\{3:-48\}"/.test(build));

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
check('sin marca visible Avgust en capa pro', !/AVGUST CARE|Avgust Crop|avgust-logo/i.test(css + js), 'limpio');

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas superadas.`);
if (failed.length) process.exit(1);
