/**
 * Verifica Todas las fincas + informe de métricas: Primera visita / Última visita.
 */
import puppeteer from "../../tests/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js";
import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.DEMO_PORT || 8771);
const OUT = process.env.C360_ARTIFACTS || "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function contentType(file) {
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return "text/html; charset=utf-8";
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  let file;
  if (urlPath.startsWith("/enhance/")) {
    file = path.join(ROOT, "enhance/src", urlPath.slice("/enhance/".length));
  } else {
    file = path.join(__dirname, "metrics", urlPath.replace(/^\//, ""));
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found: " + urlPath);
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(file) });
    res.end(data);
  });
});

await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
const URL = `http://127.0.0.1:${PORT}/index.html`;

const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=820,1180"],
  defaultViewport: null,
});
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (extra ? "  -> " + extra : ""));
}

await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector("#c360-metrics-board", { timeout: 20000 });
await wait(800);

await page.evaluate(() => {
  document.querySelector('#c360-metrics-board [data-range="all"]')?.click();
  document.querySelector('#c360-metrics-board [data-mode="all"]')?.click();
});
await wait(700);

const allProbe = await page.evaluate(() => {
  const board = document.querySelector("#c360-metrics-board");
  const text = board ? board.innerText : "";
  const block = document.querySelector(".c360-metrics-capsub-block");
  const legend = [...(block?.querySelectorAll(".c360-groupbars-leg, [data-capsub-toggle]") || [])].map((el) =>
    (el.textContent || "").replace(/\s+/g, " ").trim()
  );
  const heads = [...(block?.querySelectorAll("th") || [])].map((el) => (el.textContent || "").trim());
  const lead = block?.querySelector(".c360-metrics-card-head p")?.textContent || "";
  const title = block?.querySelector(".c360-metrics-card-head h3")?.textContent || "";
  return { text, legend, heads, lead, title };
});

check("Todas: título Cumplimiento por capítulo", /Cumplimiento por capítulo/i.test(allProbe.title));
check("Todas: leyenda Primera visita", allProbe.legend.some((x) => /Primera visita/i.test(x)), allProbe.legend.join(" | "));
check("Todas: leyenda Última visita", allProbe.legend.some((x) => /Última visita/i.test(x)), allProbe.legend.join(" | "));
check("Todas: no dice Por ítem", !/Por ítem/i.test(allProbe.text + allProbe.legend.join(" ")));
check("Todas: no dice Periodo como serie", !allProbe.legend.some((x) => /^Periodo$/i.test(x)));
check(
  "Todas: lead primera y última de cada finca",
  /primera visita de cada finca/i.test(allProbe.lead) && /última visita de cada finca/i.test(allProbe.lead),
  allProbe.lead
);
check("Todas: columnas Primera visita y Última visita", allProbe.heads.includes("Primera visita") && allProbe.heads.includes("Última visita"), allProbe.heads.join(","));

await page.evaluate(() => {
  document.querySelector(".c360-metrics-capsub-block")?.scrollIntoView({ block: "start" });
});
await wait(250);
const block = await page.$(".c360-metrics-capsub-block");
if (block) {
  await block.screenshot({ path: path.join(OUT, "metricas_todas_ultima_visita.png") });
}
await page.screenshot({ path: path.join(OUT, "metricas_todas_tablero.png"), fullPage: false });

let reportHtml = "";
const client = await page.createCDPSession();
await client.send("Browser.setDownloadBehavior", {
  behavior: "allowAndName",
  downloadPath: OUT,
  eventsEnabled: true,
});

await page.evaluate(() => {
  const orig = window.Blob;
  window.__c360CapturedHtml = "";
  window.Blob = function (parts, opts) {
    const blob = new orig(parts, opts);
    if (opts && String(opts.type || "").includes("html")) {
      window.__c360CapturedHtml = Array.isArray(parts) ? parts.join("") : String(parts);
    }
    return blob;
  };
});

await page.click('#c360-metrics-board [data-act="export-print"]');
await wait(1200);
reportHtml = await page.evaluate(() => window.__c360CapturedHtml || "");

if (!reportHtml) {
  const pages = await browser.pages();
  const extra = pages.find((p) => p !== page);
  if (extra) {
    reportHtml = await extra.content();
    await extra.close();
  }
}

check("Informe de métricas generado", reportHtml.length > 400, "len=" + reportHtml.length);
check("Informe: columna Primera visita", /Primera visita/i.test(reportHtml));
check("Informe: columna Última visita", /Última visita/i.test(reportHtml));
check("Informe: no dice Por ítem", !/Por ítem/i.test(reportHtml));
check(
  "Informe: lead de Todas",
  /primera visita de cada finca/i.test(reportHtml) && /última visita de cada finca/i.test(reportHtml),
  (reportHtml.match(/primera visita[^<]{0,80}/i) || [""])[0]
);

if (reportHtml) {
  const reportPath = path.join(OUT, "informe_metricas_todas.html");
  fs.writeFileSync(reportPath, reportHtml);
  const reportPage = await browser.newPage();
  await reportPage.setViewport({ width: 920, height: 1100 });
  await reportPage.goto("file://" + reportPath, { waitUntil: "domcontentloaded" });
  await wait(400);
  await reportPage.screenshot({ path: path.join(OUT, "informe_metricas_todas.png"), fullPage: false });
  await reportPage.close();
}

await page.evaluate(() => {
  document.querySelector('#c360-metrics-board [data-mode="farm"]')?.click();
});
await wait(500);
await page.evaluate(() => {
  const sel = document.querySelector('#c360-metrics-board select[data-field="farm"]');
  if (!sel) return;
  const opt = [...sel.options].find((o) => /San Isidro/i.test(o.value + " " + o.textContent));
  if (opt) {
    sel.value = opt.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }
});
await wait(700);
const farmProbe = await page.evaluate(() => {
  const block = document.querySelector(".c360-metrics-capsub-block");
  const legend = [...(block?.querySelectorAll(".c360-groupbars-leg, [data-capsub-toggle]") || [])].map((el) =>
    (el.textContent || "").replace(/\s+/g, " ").trim()
  );
  const heads = [...(block?.querySelectorAll("th") || [])].map((el) => (el.textContent || "").trim());
  return { legend, heads };
});
check("Por finca: leyenda Primera visita", farmProbe.legend.some((x) => /Primera visita/i.test(x)), farmProbe.legend.join(" | "));
check("Por finca: columnas iguales", farmProbe.heads.includes("Primera visita") && farmProbe.heads.includes("Última visita"), farmProbe.heads.join(","));

await page.evaluate(() => {
  document.querySelector(".c360-metrics-capsub-block")?.scrollIntoView({ block: "start" });
});
await wait(200);
const farmBlock = await page.$(".c360-metrics-capsub-block");
if (farmBlock) {
  await farmBlock.screenshot({ path: path.join(OUT, "metricas_finca_ultima_visita.png") });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas superadas.`);
fs.writeFileSync(
  path.join(OUT, "verify-todas-labels.json"),
  JSON.stringify({ results, allProbe, farmProbe }, null, 2)
);

await browser.close();
server.close();
process.exit(failed.length ? 1 : 0);
