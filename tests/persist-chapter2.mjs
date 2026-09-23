/*
 * Persistencia de Mediciones y pesaje: 2.x y mediciones sobreviven el
 * guardado nativo sin forzar capítulos 1–5 en la visita nueva.
 *
 *   node persist-chapter2.mjs
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (extra ? "  -> " + String(extra).slice(0, 220) : ""));
}

const savedPosts = [];
const fetchFn = async (url, init) => {
  const method = String((init && init.method) || "GET").toUpperCase();
  if (String(url).includes("/api/visits") && method === "GET") {
    return { ok: true, json: async () => [], text: async () => "[]" };
  }
  if (String(url).includes("/api/visits") && method === "POST") {
    const body = JSON.parse(init.body);
    savedPosts.push(body);
    return {
      ok: true,
      json: async () => Object.assign({ id: "11111111-1111-4111-8111-111111111111" }, body),
      text: async () => "{}",
    };
  }
  if (String(url).includes("/api/draft") && method === "POST") {
    const body = JSON.parse(init.body);
    savedPosts.push(body);
    return { ok: true, json: async () => ({ ok: true }), text: async () => "{}" };
  }
  if (String(url).includes("/api/team") && method === "POST") {
    return {
      ok: true,
      json: async () => ({ id: "22222222-2222-4222-8222-222222222222", name: "Finca Los Rosales" }),
      text: async () => "{}",
    };
  }
  if (String(url).includes("/api/team")) {
    return { ok: true, json: async () => ({ farms: [] }), text: async () => "{}" };
  }
  return { ok: true, json: async () => ({}), text: async () => "{}" };
};

const window = { fetch: fetchFn };
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
  fetch: fetchFn,
  Array,
  Object,
  Math,
  Number,
  String,
  Boolean,
  Date,
  JSON,
  console,
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  setTimeout() {
    return 0;
  },
  requestAnimationFrame() {},
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "enhance/src/care360-import.js"), "utf-8"), sandbox);
const api = window.C360Import;
check("C360Import exporta persistVisitPayload", !!(api && api.persistVisitPayload && api.sanitizeVisit));

const filled = {
  farm: "Finca Los Rosales",
  date: "2026-05-20",
  responsible: "Kevin Villamizar",
  technician: "Wilson Castro",
  chapters: [3, 4, 5],
  answers: {
    "2.1": { value: "SI" },
    "2.4": { value: "NO", observation: "Báscula descalibrada", recommendation: "Calibrar" },
    "4.6": { value: "SI" },
  },
  measurements: { ph: 6.1, hardness: "45", conductivity: "0.35" },
  notes: {},
  recommendations: {},
  photos: [],
  reviewed: false,
};

const persisted = api.persistVisitPayload(filled);
check(
  "si hay 2.x se añade el capítulo 2 y se conservan 3–5",
  JSON.stringify(persisted.chapters) === JSON.stringify([2, 3, 4, 5]),
  JSON.stringify(persisted.chapters)
);
check(
  "las respuestas 2.1 / 2.4 quedan con SI/NO y textos",
  persisted.answers["2.1"].value === "SI" &&
    persisted.answers["2.1"].observation === "" &&
    persisted.answers["2.4"].value === "NO" &&
    persisted.answers["2.4"].observation === "Báscula descalibrada",
  JSON.stringify({ a: persisted.answers["2.1"], b: persisted.answers["2.4"] })
);
check(
  "las mediciones numéricas pasan a texto",
  persisted.measurements.ph === "6.1" && persisted.measurements.conductivity === "0.35",
  JSON.stringify(persisted.measurements)
);
check("no se inventan capítulos 1 vacíos", persisted.chapters.indexOf(1) < 0, JSON.stringify(persisted.chapters));

const seedOnly = api.persistVisitPayload({
  farm: "Finca El Roble",
  date: "2026-09-10",
  responsible: "Wilson Castro",
  chapters: [3, 4, 5],
  answers: {
    "4.1": { value: "SI", observation: "", recommendation: "" },
    "4.6": { value: "NO", observation: "pH alto", recommendation: "Ajustar" },
  },
  measurements: {},
});
check(
  "sin 2.x la visita nueva sigue en 3–5",
  JSON.stringify(seedOnly.chapters) === JSON.stringify([3, 4, 5]),
  JSON.stringify(seedOnly.chapters)
);
check("sin 2.x no aparecen respuestas de pesaje", !seedOnly.answers["2.1"] && !seedOnly.answers["2.4"]);

const imported = api.sanitizeVisit(
  {
    farm: "Finca Importada",
    date: "2026-01-15",
    responsible: "Histórico",
    answers: { "2.1": { value: "SI" }, "4.6": { value: "SI" } },
  },
  [],
  { complete: true }
);
check(
  "el importador histórico sí puede traer los cinco capítulos",
  JSON.stringify(imported.chapters) === JSON.stringify([1, 2, 3, 4, 5]),
  JSON.stringify(imported.chapters)
);

savedPosts.length = 0;
const hooked = await window.fetch("/api/visits", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(filled),
});
check("el POST nativo no falla", !!(hooked && hooked.ok));
check(
  "el POST lleva 2.x, capítulo 2 y pH en texto",
  savedPosts.some(
    (p) =>
      p.answers &&
      p.answers["2.1"] &&
      p.answers["2.1"].value === "SI" &&
      p.answers["2.4"] &&
      p.answers["2.4"].value === "NO" &&
      p.measurements &&
      p.measurements.ph === "6.1" &&
      (p.chapters || []).indexOf(2) >= 0 &&
      (p.chapters || []).indexOf(1) < 0
  ),
  JSON.stringify(savedPosts[0] && { chapters: savedPosts[0].chapters, keys: Object.keys(savedPosts[0].answers || {}), ph: savedPosts[0].measurements && savedPosts[0].measurements.ph })
);

const metricsCode = fs.readFileSync(path.join(root, "enhance/src/care360-metrics.js"), "utf-8");
const metricsWindow = {};
const metricsDoc = {
  readyState: "loading",
  addEventListener() {},
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
};
const metricsBox = {
  window: metricsWindow,
  document: metricsDoc,
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
vm.createContext(metricsBox);
vm.runInContext(metricsCode, metricsBox);
const metrics = metricsWindow.Care360Metrics;
const withPesaje = [
  {
    farm: "Finca Los Rosales",
    date: "2026-05-20",
    reviewed: true,
    serviceKind: "assurance",
    answers: {
      "2.1": { value: "SI" },
      "2.4": { value: "NO" },
      "4.6": { value: "SI" },
    },
  },
];
const dose = metrics.chapterKpi(metrics.aggregateAll(withPesaje).chapters, 2);
const mix = metrics.chapterKpi(metrics.aggregateAll(withPesaje).chapters, 4);
check("con 2.x el KPI de pesaje muestra %", /^\d+%$/.test(dose.value), JSON.stringify(dose));
check("Mezclas sigue funcionando", /^\d+%$/.test(mix.value), JSON.stringify(mix));

const oldVisit = [
  {
    farm: "Finca El Roble",
    date: "2026-09-10",
    reviewed: true,
    serviceKind: "assurance",
    answers: { "4.1": { value: "SI" }, "4.6": { value: "NO" } },
  },
];
const honest = metrics.chapterKpi(metrics.aggregateAll(oldVisit).chapters, 2);
check("sin 2.x el KPI de pesaje queda en raya", honest.value === "—", JSON.stringify(honest));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas de persistencia superadas.`);
if (failed.length) process.exit(1);
