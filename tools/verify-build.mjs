import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const version = JSON.parse(read("version.json"));

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " -> " + detail : ""));
};

check("version.json existe", !!version.name && Number.isInteger(version.code));
check("version semver válida", /^\d+\.\d+\.\d+$/.test(String(version.name || "")), String(version.name));
check("versionCode válido", Number.isInteger(version.code) && version.code > 0, String(version.code));
check("cache definida", typeof version.buildCache === "string" && version.buildCache.length > 0);

const build = read("build.js");
const apk = read("tools/build-apk.sh");
const presentation = read("enhance/src/care360-presentation.js");
const pkg = JSON.parse(read("package.json"));

check("build.js usa version.json", build.includes("version.json"));
check("build.js valida semver correctamente", build.includes("/^\\d+\\.\\d+\\.\\d+$/"));
check("build.js usa cache configurada", build.includes("${BUILD_CACHE}") && !build.includes('k!=="avgust-care-shell-v2"'));
check("build.js falla si un patch falla", build.includes("process.exit(res.status || 1)"));
check("build.js no fija 1.5.32", !build.includes("'v1.5.32'") && !build.includes('"v1.5.32"'));
check("build-apk usa version.json", apk.includes("version.json"));
check("build-apk usa buildCache", apk.includes("BUILD_CACHE") && apk.includes("get("buildCache""));
check("build-apk no fija la caché de producción", !apk.includes('prefix = "avgust-care-shell"'));
check("build-apk no tiene 1.5.13 como default", !/VERSION_NAME="\$\{2:-1\.5\.13\}"/.test(apk));
check("presentación conserva marcador", presentation.includes("__C360_VERSION__"));
check("build:apk existe", pkg.scripts?.["build:apk"] === "bash tools/build-apk.sh");
check("build:web existe", pkg.scripts?.["build:web"] === "node build.js");
check("verify:build existe", pkg.scripts?.["verify:build"] === "node tools/verify-build.mjs");

const required = [
  "enhance/src/care360-enhance.css",
  "enhance/src/care360-experience.js",
  "enhance/src/care360-metrics.js",
  "tools/build-apk.sh",
  "tools/patch_manifest.py",
  "tools/dev-preview.sh",
  "tools/signing/README.md",
  "tools/base/capacitor-seed.apk"
];
for (const p of required) check("archivo requerido: " + p, fs.existsSync(path.join(root, p)));

const failed = checks.filter((x) => !x.ok);
console.log("\n" + (checks.length - failed.length) + "/" + checks.length + " verificaciones correctas.");
if (failed.length) process.exit(1);
