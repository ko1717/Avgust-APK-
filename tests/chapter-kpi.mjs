/*
 * Scoring de KPIs de capítulo: última visita → primera → periodo.
 *
 *   node chapter-kpi.mjs
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (extra ? "  -> " + extra : ""));
}

function ans(map) {
  const out = {};
  Object.keys(map).forEach((id) => {
    out[id] = { value: map[id] };
  });
  return out;
}

function visit(farm, date, answers) {
  return {
    farm,
    date,
    reviewed: true,
    serviceKind: "assurance",
    answers: ans(answers),
  };
}

const code = fs.readFileSync(path.join(root, "enhance/src/care360-metrics.js"), "utf-8");
const window = {};
const document = {
  readyState: "loading",
  addEventListener() {},
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
};
const sandbox = {
  window,
  document,
  Array,
  Object,
  Math,
  Number,
  String,
  Boolean,
  Date,
  JSON,
  console,
  setTimeout() {
    return 0;
  },
  setInterval() {
    return 0;
  },
  clearInterval() {},
  requestAnimationFrame() {},
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const api = window.Care360Metrics;
check("Care360Metrics exporta aggregateAll y chapterKpi", !!(api && api.aggregateAll && api.chapterKpi));

const holeVisits = [
  visit("Finca San Isidro", "2025-10-08", {
    "1.1": "NO",
    "1.2": "SI",
    "4.1": "NO",
    "4.2": "SI",
  }),
  visit("Finca San Isidro", "2025-12-17", {
    "1.1": "SI",
    "2.1": "NO",
    "2.2": "SI",
    "4.1": "SI",
    "4.2": "SI",
  }),
  visit("Finca San Isidro", "2026-03-11", {
    "1.1": "SI",
    "2.1": "SI",
    "2.2": "SI",
    "4.1": "SI",
    "4.2": "SI",
  }),
  visit("Finca San Isidro", "2026-06-25", {
    "1.1": "SI",
    "4.1": "SI",
    "4.2": "NO",
  }),
  visit("Finca El Roble", "2026-02-10", {
    "1.1": "SI",
    "4.1": "SI",
    "4.2": "SI",
  }),
];

const allHole = api.aggregateAll(holeVisits);
const ch2 = (allHole.chapters || []).find((c) => Number(c.id) === 2);
const dose = api.chapterKpi(allHole.chapters, 2);
const mix = api.chapterKpi(allHole.chapters, 4);
check(
  "Todas: capítulo 2 queda en la lista aunque primera y última no lo tengan",
  !!(ch2 && ch2.score == null && ch2.subScore == null && ch2.periodScore != null),
  JSON.stringify(ch2)
);
check(
  "Todas: Mediciones y pesaje usa el % del periodo (75%)",
  dose.value === "75%" && dose.score === 75,
  JSON.stringify(dose)
);
check("Todas: Mezclas no queda en raya", /^\d+%$/.test(mix.value), JSON.stringify(mix));

const lastWins = api.aggregateAll([
  visit("Finca A", "2025-01-01", { "2.1": "NO", "2.2": "NO" }),
  visit("Finca A", "2025-06-01", { "2.1": "SI", "2.2": "SI" }),
]);
check(
  "Todas: si la última visita tiene SI/NO, el KPI usa esa (100%)",
  api.chapterKpi(lastWins.chapters, 2).value === "100%",
  JSON.stringify(api.chapterKpi(lastWins.chapters, 2))
);

const firstFallback = api.aggregateAll([
  visit("Finca A", "2025-01-01", { "2.1": "SI", "2.2": "NO" }),
  visit("Finca A", "2025-06-01", { "4.1": "SI", "4.2": "SI" }),
]);
check(
  "Todas: si la última no tiene capítulo 2, usa la primera (50%)",
  api.chapterKpi(firstFallback.chapters, 2).value === "50%",
  JSON.stringify(api.chapterKpi(firstFallback.chapters, 2))
);

const empty = api.aggregateAll([
  visit("Finca A", "2025-01-01", { "4.1": "SI" }),
  visit("Finca A", "2025-06-01", { "4.1": "NO" }),
]);
check(
  "Todas: sin SI/NO de capítulo 2 el KPI sigue en raya",
  api.chapterKpi(empty.chapters, 2).value === "—",
  JSON.stringify(api.chapterKpi(empty.chapters, 2))
);

const farmHole = api.aggregateFarm(
  holeVisits.filter((v) => /San Isidro/i.test(v.farm)),
  "Finca San Isidro",
  "",
  ""
);
const farmDose = api.chapterKpi(farmHole.chapters, 2);
check(
  "Por finca: Mediciones y pesaje usa el periodo si primera y última no lo tienen",
  farmDose.value === "75%" && farmDose.score === 75,
  JSON.stringify(farmDose)
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas superadas.`);
if (failed.length) process.exit(1);
