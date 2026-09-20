/*
 * Etiquetas del tablero e informe de métricas: Primera visita vs Última visita.
 *
 *   node metrics-labels.mjs
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

const js = fs.readFileSync(path.join(root, "enhance/src/care360-metrics.js"), "utf-8");

check("serie azul se llama Primera visita", /cap:\s*"Primera visita"/.test(js));
check("serie naranja se llama Última visita", /sub:\s*"Última visita"/.test(js));
check("no usa Periodo como serie naranja", !/sub:\s*"Periodo"/.test(js));
check("no usa Por ítem como serie", !/sub:\s*"Por ítem"/.test(js));
check(
  "Todas explica primera y última de cada finca",
  /primera visita de cada finca/.test(js) && /última visita de cada finca/.test(js)
);
check(
  "informe impreso usa seriesLabels en la tabla",
  /seriesLabels\(farmOnly \? "farm" : "all"\)\.cap \+ " %"/.test(js)
);
check(
  "CSV usa las mismas columnas de serie",
  /series\.cap\s*\+\s*" %,"/.test(js) && /series\.sub\s*\+\s*" %,/.test(js)
);
check("KPI de capítulo 2 se llama Mediciones y pesaje", /KPI_LABEL_DOSE = "Mediciones y pesaje"/.test(js));
check("KPI de capítulo 2 ya no dice Dosis", !/kpiCard\("Dosis"/.test(js) && !/"Dosis"/.test(js));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas superadas.`);
if (failed.length) process.exit(1);
