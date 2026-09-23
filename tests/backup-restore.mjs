/*
 * Respaldo: el JSON de visita conserva capítulo 2 y mediciones,
 * y al rehidratar quedan para métricas / Word.
 *
 *   node backup-restore.mjs
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
  console.log((ok ? "PASS  " : "FAIL  ") + name + (extra ? "  -> " + extra : ""));
}

const code = fs.readFileSync(path.join(root, "enhance/src/care360-import.js"), "utf-8");
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
window.fetch = fetchFn;
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
  TextDecoder,
  Uint8Array,
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  setTimeout() {
    return 0;
  },
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const api = window.C360Import;
check("C360Import exporta sanitize, hydrate y parse de respaldo", !!(api && api.sanitizeVisit && api.hydrateVisitPayload && api.parseVisitBackup));

const formBackup = {
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
  measurements: {
    ph: 6.1,
    hardness: "45",
    conductivity: "0.35",
    mixPh: "6.0",
    mixConductivity: "0.40",
    pressure: "80",
    implementPressure: "75",
    equipment: "Lanza",
    implement: "Estacionaria",
    volume: "12",
    time: "25",
  },
  notes: {},
  recommendations: {},
  photos: [],
  reviewed: false,
};

const hydrated = api.hydrateVisitPayload(formBackup);
check(
  "hydrate añade el capítulo 2 si hay respuestas 2.x aunque no esté seleccionado",
  Array.isArray(hydrated.chapters) && hydrated.chapters.indexOf(2) >= 0,
  JSON.stringify(hydrated.chapters)
);
check(
  "hydrate conserva SI/NO de pesaje",
  hydrated.answers["2.1"].value === "SI" && hydrated.answers["2.4"].value === "NO",
  JSON.stringify(hydrated.answers["2.1"])
);
check(
  "hydrate convierte mediciones numéricas a texto",
  hydrated.measurements.ph === "6.1" && hydrated.measurements.conductivity === "0.35",
  JSON.stringify(hydrated.measurements)
);

const sanitized = api.sanitizeVisit(hydrated, [], { complete: true });
check(
  "sanitize deja los 5 capítulos en el respaldo importable",
  JSON.stringify(sanitized.chapters) === JSON.stringify([1, 2, 3, 4, 5]),
  JSON.stringify(sanitized.chapters)
);
check(
  "sanitize no pierde 2.1 / 2.4",
  sanitized.answers["2.1"].value === "SI" && sanitized.answers["2.4"].value === "NO",
  JSON.stringify({ a: sanitized.answers["2.1"], b: sanitized.answers["2.4"] })
);
check(
  "sanitize conserva mediciones de agua, mezcla, presión, equipo y cama",
  sanitized.measurements.ph === "6.1" &&
    sanitized.measurements.mixPh === "6.0" &&
    sanitized.measurements.pressure === "80" &&
    sanitized.measurements.equipment === "Lanza" &&
    sanitized.measurements.volume === "12",
  JSON.stringify(sanitized.measurements)
);

const json = JSON.stringify(formBackup, null, 2);
const parsed = api.parseVisitBackup(json);
check("parseVisitBackup lee el JSON de «Respaldar formulario»", parsed.visits.length === 1);
const visit = parsed.visits[0];
check(
  "el JSON rehidratado trae capítulo 2 y mediciones",
  visit.chapters.indexOf(2) >= 0 &&
    visit.answers["2.1"].value === "SI" &&
    visit.measurements.conductivity === "0.35" &&
    visit.measurements.implement === "Estacionaria",
  JSON.stringify({ chapters: visit.chapters, m: visit.measurements })
);

const bytes = new TextEncoder().encode(json);
check("looksLikeJsonBackup reconoce el JSON", api.looksLikeJsonBackup(bytes));
check("looksLikeJsonBackup no trata un sqlite como JSON", !api.looksLikeJsonBackup(new Uint8Array([0x53, 0x51, 0x4c, 0x69])));

const oldBackup = {
  farm: "Finca El Roble",
  date: "2025-11-02",
  responsible: "Histórico",
  chapters: [1, 2, 3, 4, 5],
  answers: {
    "2.1": { value: "SI", observation: "", recommendation: "" },
    "2.2": { value: "SI", observation: "", recommendation: "" },
  },
  measurements: { ph: "5.8", hardness: "60" },
};
const oldParsed = api.parseVisitBackup(JSON.stringify(oldBackup));
check(
  "un respaldo viejo que ya traía capítulo 2 se acepta igual",
  oldParsed.visits[0].answers["2.1"].value === "SI" && oldParsed.visits[0].measurements.ph === "5.8"
);

const restored = await api.restoreJsonBackup(bytes);
check("restoreJsonBackup guarda la visita", restored.visits && restored.visits.length === 1, JSON.stringify(restored.message));
check(
  "el POST de restore lleva 2.x y mediciones",
  savedPosts.some(
    (p) =>
      p.answers &&
      p.answers["2.1"] &&
      p.answers["2.1"].value === "SI" &&
      p.measurements &&
      p.measurements.ph === "6.1" &&
      (p.chapters || []).indexOf(2) >= 0
  ),
  JSON.stringify(savedPosts[0] && { chapters: savedPosts[0].chapters, keys: Object.keys(savedPosts[0].answers || {}) })
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas de respaldo superadas.`);
if (failed.length) process.exit(1);
