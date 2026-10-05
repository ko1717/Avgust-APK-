#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const candidates = [
  { root: "src", markers: ["package.json", "src"], description: "proyecto web fuente" },
  { root: "app/src", markers: ["app/src"], description: "proyecto Android fuente" },
  { root: "android/app/src/main/assets/public", markers: ["android/app/src/main/assets/public"], description: "web pública dentro del proyecto Android" }
];

const valid = candidates.filter((candidate) => {
  const rootPath = path.join(root, candidate.root);
  if (!fs.existsSync(rootPath)) return false;
  return candidate.markers.every((marker) => fs.existsSync(path.join(root, marker)));
});

if (!valid.length) {
  console.error("SOURCE GUARD: no existe un árbol fuente de aplicación válido.");
  console.error("No conviertas tools/base/capacitor-seed.apk en fuente de verdad.");
  console.error("Recupera el proyecto fuente original o inicia una reconstrucción explícita.");
  process.exit(2);
}

console.log("SOURCE GUARD: árbol fuente válido detectado:", valid.map((item) => item.description).join(", "));
