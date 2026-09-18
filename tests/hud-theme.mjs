/*
 * Comprueba que el panel de calidad no flota y que modo oscuro / lector
 * cubren las superficies que antes quedaban ilegibles.
 *
 *   node hud-theme.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (extra ? "  -> " + extra : ""));
}
const read = (p) => fs.readFileSync(path.join(root, p), "utf-8");

const enhance = read("enhance/src/care360-enhance.css");
const proCss = read("enhance/src/care360-pro.css");
const proJs = read("enhance/src/care360-pro.js");

const hudBlock = enhance.match(/\.c360-visit-hud\s*\{[^}]+\}/g) || [];
check("hay reglas del panel de calidad", hudBlock.length > 0, String(hudBlock.length));
check(
  "el panel de calidad no usa position:sticky",
  hudBlock.every((rule) => !/position:\s*sticky/.test(rule)),
  hudBlock.join(" | ").slice(0, 180)
);
check(
  "el panel de calidad queda en el flujo (relative/static)",
  hudBlock.some((rule) => /position:\s*(relative|static)/.test(rule))
);
check(
  "con teclado el panel deja de flotar",
  /html\.c360-keyboard \.c360-visit-hud[\s\S]{0,180}position:\s*static/.test(enhance)
);

for (const sel of [
  "html.dark .chapter-choice.chosen",
  "html.dark [data-slot=\"select-trigger\"]",
  "html.dark .report-paper",
  "html.dark .report-lifecycle",
  "html.dark .chapter-choice small",
]) {
  check(`oscuro cubre ${sel}`, enhance.includes(sel));
}

for (const sel of [
  "html.dark.c360-sun",
  "html.c360-sun .chapter-choice.chosen",
  "html.c360-sun .report-paper",
  "html.c360-sun [data-slot=\"select-trigger\"]",
  "modo lector",
]) {
  check(`lector cubre ${sel}`, (proCss + proJs).toLowerCase().includes(sel.toLowerCase()));
}

check("el botón ☀ se presenta como modo lector", /modo lector/i.test(proJs));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas superadas.`);
if (failed.length) process.exit(1);
