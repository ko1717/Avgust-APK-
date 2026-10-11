#!/usr/bin/env node
/**
 * Copies the key-free consult helpers into functions/ before `firebase deploy`.
 * Cloud Functions uploads only the functions/ directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(rootDir, 'lib', 'consulta-avgust-core.mjs');
const dest = path.join(rootDir, 'functions', 'consulta-avgust-core.mjs');
fs.copyFileSync(source, dest);
console.log('staged functions/consulta-avgust-core.mjs (no API key)');
