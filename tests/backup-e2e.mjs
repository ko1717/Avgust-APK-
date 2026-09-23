/*
 * Ciclo real: guarda visita con capítulo 2 + mediciones, crea el respaldo
 * .care360, inspecciona el SQLite y restaura el JSON en un perfil limpio.
 *
 *   ../tools/dev-preview.sh
 *   CARE360_URL=http://localhost:8080/index.html node backup-e2e.mjs
 */
import puppeteer from "puppeteer";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.CARE360_URL || "http://localhost:8080/index.html";
const OUT = process.env.CARE360_TEST_OUT || fs.mkdtempSync(path.join(os.tmpdir(), "care360-backup-"));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (extra ? "  -> " + String(extra).slice(0, 220) : ""));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const sample = {
  farm: "Finca Respaldo Pesaje",
  date: "2026-05-20",
  city: "Bogotá",
  zone: "Sabana",
  technician: "Wilson Castro",
  responsible: "Kevin Villamizar",
  chapters: [1, 2, 3, 4, 5],
  answers: {
    "1.1": { value: "SI", observation: "", recommendation: "" },
    "2.1": { value: "SI", observation: "", recommendation: "" },
    "2.4": { value: "NO", observation: "Báscula descalibrada", recommendation: "Calibrar" },
    "4.6": { value: "SI", observation: "", recommendation: "" },
  },
  measurements: {
    ph: "6.1",
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
  conclusion: "Visita de prueba de respaldo.",
  photos: [],
  reviewed: true,
  serviceKind: "assurance",
};

const b = await puppeteer.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  protocolTimeout: 40000,
});
const p = await b.newPage();
await p.setUserAgent(
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
);
await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const downloads = [];
const client = await p.createCDPSession();
await client.send("Browser.setDownloadBehavior", {
  behavior: "allowAndName",
  downloadPath: OUT,
  eventsEnabled: true,
});
client.on("Browser.downloadWillBegin", (e) => downloads.push(e.suggestedFilename));
client.on("Browser.downloadProgress", (e) => {
  if (e.state === "completed") downloads.push("done:" + e.guid);
});

await p.goto(URL, { waitUntil: "networkidle2" });
await wait(2800);
if (await p.$('.c360-intro[data-open="1"]')) {
  await p.click('.c360-intro [data-act="skip"]');
  await wait(500);
}

await p.waitForFunction(() => !!(window.C360Import && window.C360Import.saveVisits && window.careDesktop), {
  timeout: 45000,
});

const seeded = await p.evaluate(async (visit) => {
  const list = await fetch("/api/visits").then((r) => r.json()).catch(() => []);
  for (const v of list || []) {
    if (v.id) await fetch("/api/visits/" + v.id, { method: "DELETE" }).catch(() => null);
  }
  const saved = await window.C360Import.saveVisits([visit]);
  const after = await fetch("/api/visits").then((r) => r.json());
  return { saved: saved.length, after: after.map((v) => ({ farm: v.farm, chapters: v.chapters, a21: v.answers && v.answers["2.1"], ph: v.measurements && v.measurements.ph })) };
}, sample);
check("Se guarda la visita con capítulo 2 y pH", seeded.saved === 1 && seeded.after.some((v) => v.a21 && v.a21.value === "SI" && v.ph === "6.1"), JSON.stringify(seeded));

const backup = await p.evaluate(async () => window.careDesktop.backup());
check("Crear respaldo completo no falla", !!(backup && !backup.error), JSON.stringify(backup));
await wait(2500);

const careFiles = fs.readdirSync(OUT).filter((n) => /\.care360$/i.test(n) || /AVGUST-CARE/i.test(n));
check("El respaldo .care360 se descarga", careFiles.length > 0 || downloads.some((d) => /\.care360/i.test(d)), downloads.join(", ") + " | " + fs.readdirSync(OUT).join(", "));

let sqliteVisit = null;
for (const name of fs.readdirSync(OUT)) {
  const file = path.join(OUT, name);
  try {
    const raw = execFileSync(
      "python3",
      [
        "-c",
        "import sqlite3,json,sys; c=sqlite3.connect(sys.argv[1]); r=c.execute('select payload from visits').fetchall(); print(json.dumps([json.loads(x[0]) for x in r]))",
        file,
      ],
      { encoding: "utf8" }
    );
    const visits = JSON.parse(raw);
    if (Array.isArray(visits) && visits.length) {
      sqliteVisit = visits.find((v) => /Respaldo Pesaje/i.test(v.farm || "")) || visits[0];
      break;
    }
  } catch {
    /* no es sqlite */
  }
}
check(
  "El SQLite del respaldo trae respuestas 2.x",
  !!(sqliteVisit && sqliteVisit.answers && sqliteVisit.answers["2.1"] && sqliteVisit.answers["2.1"].value === "SI" && sqliteVisit.answers["2.4"] && sqliteVisit.answers["2.4"].value === "NO"),
  sqliteVisit ? JSON.stringify({ chapters: sqliteVisit.chapters, a: sqliteVisit.answers && sqliteVisit.answers["2.1"] }) : "sin visitas en el .care360"
);
check(
  "El SQLite del respaldo trae mediciones de campo",
  !!(sqliteVisit && sqliteVisit.measurements && sqliteVisit.measurements.ph === "6.1" && sqliteVisit.measurements.conductivity === "0.35" && sqliteVisit.measurements.equipment === "Lanza"),
  sqliteVisit ? JSON.stringify(sqliteVisit.measurements) : "sin mediciones"
);

const jsonPath = path.join(OUT, "respaldo-visita-2026-05-20.json");
fs.writeFileSync(jsonPath, JSON.stringify(sample, null, 2));

const restored = await p.evaluate(async () => {
  const list = await fetch("/api/visits").then((r) => r.json()).catch(() => []);
  for (const v of list || []) {
    if (v.id) await fetch("/api/visits/" + v.id, { method: "DELETE" }).catch(() => null);
  }
  const empty = await fetch("/api/visits").then((r) => r.json());
  return { empty: (empty || []).length };
});
check("El perfil queda vacío antes de restaurar", restored.empty === 0, JSON.stringify(restored));

const jsonBytes = fs.readFileSync(jsonPath);
const rehydrated = await p.evaluate(async (b64) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const result = await window.C360Import.restoreJsonBackup(bin);
  const list = await fetch("/api/visits").then((r) => r.json());
  const v = (list || []).find((x) => /Respaldo Pesaje/i.test(x.farm || "")) || (list || [])[0];
  const dose = window.Care360Metrics && v ? window.Care360Metrics.chapterKpi(window.Care360Metrics.aggregateAll(list).chapters, 2) : null;
  return {
    message: result && result.message,
    chapters: v && v.chapters,
    a21: v && v.answers && v.answers["2.1"],
    a24: v && v.answers && v.answers["2.4"],
    measurements: v && v.measurements,
    dose,
  };
}, jsonBytes.toString("base64"));

check(
  "Tras restaurar el JSON reaparecen 2.1 / 2.4",
  rehydrated.a21 && rehydrated.a21.value === "SI" && rehydrated.a24 && rehydrated.a24.value === "NO" && (rehydrated.chapters || []).indexOf(2) >= 0,
  JSON.stringify({ chapters: rehydrated.chapters, a21: rehydrated.a21, a24: rehydrated.a24 })
);
check(
  "Tras restaurar reaparecen las mediciones",
  rehydrated.measurements &&
    rehydrated.measurements.ph === "6.1" &&
    rehydrated.measurements.mixPh === "6.0" &&
    rehydrated.measurements.volume === "12",
  JSON.stringify(rehydrated.measurements)
);
check(
  "El KPI de Mediciones y pesaje deja de estar en raya",
  rehydrated.dose && /^\d+%$/.test(rehydrated.dose.value),
  JSON.stringify(rehydrated.dose)
);

await p.screenshot({ path: path.join(OUT, "backup_restore_visits.png") });
const artifactDir = "/opt/cursor/artifacts";
try {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.copyFileSync(path.join(OUT, "backup_restore_visits.png"), path.join(artifactDir, "backup_restore_pesaje.png"));
  if (sqliteVisit) {
    fs.writeFileSync(path.join(artifactDir, "backup_visit_payload.json"), JSON.stringify(sqliteVisit, null, 2));
  }
  fs.copyFileSync(jsonPath, path.join(artifactDir, "respaldo-visita-pesaje.json"));
} catch {
  /* sin carpeta de artefactos */
}

await b.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas e2e de respaldo superadas.`);
console.log("Salida:", OUT);
if (failed.length) process.exit(1);
