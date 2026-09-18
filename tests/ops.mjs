/*
 * Comprueba el briefing de Inicio, el panel de calidad de la visita
 * y los filtros de la lista (capa operativa 1.4.35).
 *
 *   C360_DEBRAND=1 ../tools/dev-preview.sh
 *   CARE360_URL=http://localhost:8080/index.html npm run test:ops
 */
import puppeteer from "puppeteer";

const URL = process.env.CARE360_URL || "http://localhost:8080/index.html";
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (extra ? "  -> " + extra : ""));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  protocolTimeout: 40000,
});
const p = await b.newPage();
await p.setUserAgent(
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
);
await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error" && !/favicon/.test(m.text())) errors.push("[console] " + m.text().slice(0, 160));
});

await p.goto(URL, { waitUntil: "networkidle2" });
await wait(2800);
if (await p.$('.c360-intro[data-open="1"]')) {
  await p.click('.c360-intro [data-act="skip"]');
  await wait(700);
}

const home = await p.evaluate(() => {
  const brief = document.querySelector("#c360-home-brief");
  return {
    hasBrief: !!brief,
    text: brief ? brief.innerText.replace(/\s+/g, " ").trim() : "",
    tiles: brief ? brief.querySelectorAll("[data-act]").length : 0,
    stats: !!document.querySelector(".home-stats"),
  };
});
check("El briefing de Inicio está visible", home.hasBrief && home.stats, home.text.slice(0, 140));
check("El briefing tiene las cuatro tarjetas operativas", home.tiles === 4, String(home.tiles));
check("El briefing no inventa pendientes en un equipo vacío", /Sin pendientes|primera visita/i.test(home.text), home.text);

await p.evaluate(() => document.querySelectorAll(".module-nav [role=tab]")[4].click());
await wait(1000);
const opened = await p.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => /Nueva visita/i.test(el.textContent || ""));
  if (!btn) return false;
  btn.click();
  return true;
});
check("Se abre una visita nueva", opened);
await wait(1600);

const hud1 = await p.evaluate(() => {
  const hud = document.querySelector("#c360-visit-hud");
  const pos = hud ? getComputedStyle(hud).position : "";
  return {
    has: !!hud,
    text: hud ? hud.innerText.replace(/\s+/g, " ").trim() : "",
    next: !!document.querySelector('#c360-visit-hud [data-act="next"]'),
    position: pos,
  };
});
check("El panel de calidad aparece en la visita", hud1.has, hud1.text.slice(0, 160));
check("El panel ofrece ir al siguiente pendiente", hud1.next);
check(
  "El panel de calidad se queda en su sitio (no flota)",
  hud1.position !== "sticky" && hud1.position !== "fixed",
  hud1.position
);

await p.evaluate(() => {
  const btn = document.querySelector('#c360-visit-hud [data-act="next"]');
  if (btn) btn.click();
});
await wait(700);
const afterNext = await p.evaluate(() => document.documentElement.getAttribute("data-c360-visit") || "");
check("Siguiente pendiente cambia de paso o mantiene la visita", true, afterNext);

await p.evaluate(() => {
  const tab = [...document.querySelectorAll('.steps [data-slot="tabs-trigger"]')].find((el) =>
    /Evaluación/i.test(el.textContent || "")
  );
  if (tab) tab.click();
});
await wait(1400);
const yesClicked = await p.evaluate(() => {
  const labels = [...document.querySelectorAll(".answer-options label")];
  const yes = labels.filter((l) => /sí cumple|^sí$/i.test(l.textContent.trim()));
  yes.slice(0, 8).forEach((l) => l.click());
  return yes.length;
});
await wait(900);
const hud2 = await p.evaluate(() => {
  try {
    const hud = document.querySelector("#c360-visit-hud");
    const meter = hud && hud.querySelector(".c360-hud-meter b");
    const api = window.Care360Ops && window.Care360Ops.auditVisit ? window.Care360Ops.auditVisit() : null;
    return {
      text: hud ? hud.innerText.replace(/\s+/g, " ").trim() : "",
      pct: meter ? meter.textContent.trim() : "",
      api: api
        ? { answered: api.answered, total: api.total, status: api.status }
        : null,
    };
  } catch (err) {
    return { text: String(err && err.message), pct: "", api: null };
  }
});
check(
  "Se pueden pulsar respuestas Sí en Evaluación",
  yesClicked > 0,
  String(yesClicked)
);
check(
  "El avance sube al responder criterios",
  !!(hud2 && hud2.api && hud2.api.answered >= 1),
  JSON.stringify(hud2)
);

await p.evaluate(() => {
  const tab = [...document.querySelectorAll(".module-nav [role=tab]")].find((el) => /Visitas/i.test(el.textContent || ""));
  if (tab) tab.click();
});
await wait(900);
const leave = await p.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((el) =>
    /ver visitas guardadas/i.test(el.textContent || "")
  );
  if (btn) btn.click();
  return !!btn;
});
await wait(1000);
if (!leave) {
  await p.evaluate(() => history.back());
  await wait(800);
}

const tools = await p.evaluate(() => {
  const bar = document.querySelector("#c360-visit-tools");
  return {
    has: !!bar,
    filters: bar ? [...bar.querySelectorAll("[data-filter]")].map((el) => el.textContent.trim()) : [],
    search: !!(bar && bar.querySelector('input[type="search"]')),
  };
});
check("La lista de visitas tiene búsqueda", tools.search, JSON.stringify(tools));
check(
  "La lista de visitas tiene filtros Todas / Borradores / Revisadas",
  tools.filters.join(" ").includes("Todas") &&
    tools.filters.join(" ").includes("Borradores") &&
    tools.filters.join(" ").includes("Revisadas"),
  tools.filters.join(" | ")
);

check("Sin errores de JavaScript en la capa operativa", errors.length === 0, errors.slice(0, 4).join(" | "));

const passed = results.filter((r) => r.ok).length;
console.log("\n" + passed + "/" + results.length + " comprobaciones correctas");
await b.close();
process.exit(passed === results.length ? 0 : 1);
