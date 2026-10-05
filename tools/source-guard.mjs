#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceCandidates = [
  "src",
  "app/src",
  "android/app/src/main/assets/public"
];

const found = sourceCandidates.filter((p) => fs.existsSync(path.join(root, p)));
if (!found.length) {
  console.error("SOURCE GUARD: no existe un árbol fuente de aplicación.");
  console.error("No conviertas tools/base/capacitor-seed.apk en fuente de verdad.");
  process.exit(2);
}
console.log("SOURCE GUARD: árbol fuente detectado:", found.join(", "));
