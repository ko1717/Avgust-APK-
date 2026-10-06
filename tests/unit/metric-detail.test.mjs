import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));

async function loadModule(entry) {
  const result = await build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false
  });
  const code = Buffer.from(result.outputFiles[0].contents).toString("base64");
  return import(`data:text/javascript;base64,${code}`);
}

const analysis = await loadModule("lib/metric-analysis.ts");
const model = await loadModule("lib/model.ts");

function visit(date, answers, chapters = [4]) {
  return {
    id: date,
    revision: 1,
    farm: "Finca Norte",
    date,
    city: "",
    zone: "",
    technician: "Técnica",
    responsible: "Responsable",
    rtc: "",
    chapters,
    answers,
    notes: {},
    recommendations: {},
    measurements: {},
    delivery: "",
    followup: "",
    conclusion: "",
    photos: [],
    reviewed: true
  };
}

test("farm history compares first and latest answers for each chapter item", () => {
  const result = analysis.farmMetricHistory([
    visit("2026-01-10", {
      "4.6": { value: "SI" },
      "4.7": { value: "NO" }
    }),
    visit("2026-03-10", {
      "4.6": { value: "NO" },
      "4.7": { value: "SI" }
    })
  ], "Finca Norte");

  assert.deepEqual(result.chapters.map((chapter) => chapter.id), [1, 2, 3, 4, 5]);
  const chapter = result.chapters.find((item) => item.id === 4);
  assert.equal(chapter.firstScore, 50);
  assert.equal(chapter.score, 50);
  assert.deepEqual(
    chapter.items.slice(5, 7).map(({ id, firstScore, latestScore }) => ({ id, firstScore, latestScore })),
    [
      { id: "4.6", firstScore: 100, latestScore: 0 },
      { id: "4.7", firstScore: 0, latestScore: 100 }
    ]
  );
  assert.equal(result.chapters.find((item) => item.id === 2).status, "pending");
});

test("consolidated metrics include all chapters and their full subchapter catalog", () => {
  const result = analysis.consolidatedMetricAnalysis([
    visit("2026-01-10", {
      "4.6": { value: "SI" },
      "4.7": { value: "NO" }
    })
  ]);

  assert.deepEqual(result.chapters.map((chapter) => chapter.id), [1, 2, 3, 4, 5]);
  assert.equal(result.chapters.find((chapter) => chapter.id === 1).score, null);
  assert.equal(result.items.length, model.catalog.reduce((total, chapter) => total + chapter.items.length, 0));
  assert.deepEqual(
    ["4.7", "4.6"].map((id) => {
      const { applicable, findings, rate } = result.items.find((item) => item.id === id);
      return { id, applicable, findings, rate };
    }),
    [
      { id: "4.7", applicable: 1, findings: 1, rate: 100 },
      { id: "4.6", applicable: 1, findings: 0, rate: 0 }
    ]
  );
  const unmeasuredItem = result.items.find((item) => item.id === "1.1");
  assert.equal(unmeasuredItem.applicable, 0);
  assert.equal(unmeasuredItem.farms, 0);
});

test("field measurements are grouped under their report subchapters", () => {
  assert.deepEqual(model.blankVisit().chapters, [2, 3, 4, 5]);
  const groups = model.measurementGroupsFor({
    ph: "5.8",
    hardness: "45",
    mixPh: "5.7",
    pressure: "145",
    implementPressure: "60",
    equipment: "Bomba móvil",
    implement: "Aguilón",
    volume: "10",
    time: "60"
  });

  assert.deepEqual(groups.map((group) => group.criterionId), ["4.6", "4.6", "5.1", "5.3", "5.6"]);
  assert.deepEqual(model.measurementGroupsFor({ ph: "5.8" }, "4.6")[0].rows, [
    { key: "ph", label: "pH del agua", value: "5.8" }
  ]);
  assert.deepEqual(model.ungroupedMeasurements({}), []);
});
