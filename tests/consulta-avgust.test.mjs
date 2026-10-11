import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  CONSULTA_AVGUST_MODEL,
  CONSULTA_AVGUST_SYSTEM_PROMPT,
  buildGeminiContents,
  buildGeminiRequestBody,
  consultaAllowOrigin,
  normalizeConsultaMessages,
  resolveConsultaEndpoint
} from '../lib/consulta-avgust-core.mjs';

test('static Hosting has no consult endpoint unless a public URL is configured', () => {
  assert.equal(resolveConsultaEndpoint({hostingPortalOnly: true}), '');
  assert.equal(
    resolveConsultaEndpoint({
      hostingPortalOnly: true,
      publicUrl: 'https://example.com/consulta/'
    }),
    'https://example.com/consulta'
  );
  assert.equal(resolveConsultaEndpoint({hostingPortalOnly: false}), '/api/consulta-avgust');
});

test('prompt stays inside agriculture and CARE 360 and refuses doses', () => {
  assert.match(CONSULTA_AVGUST_SYSTEM_PROMPT, /FUERA DE ALCANCE/);
  assert.match(CONSULTA_AVGUST_SYSTEM_PROMPT, /CARE 360/);
  assert.match(CONSULTA_AVGUST_SYSTEM_PROMPT, /No inventes números de dosis/);
  assert.equal(CONSULTA_AVGUST_MODEL, 'gemini-3.5-flash-lite');
});

test('history must end with a user turn and drops empty text', () => {
  const bad = normalizeConsultaMessages([{role: 'assistant', content: 'hola'}]);
  assert.equal(bad.ok, false);
  const good = normalizeConsultaMessages([
    {role: 'user', content: '  ¿qué preparar para la visita?  '},
    {role: 'assistant', content: 'Lleva el cuaderno de aplicaciones.'},
    {role: 'user', content: '¿y el EPP?'}
  ]);
  assert.equal(good.ok, true);
  assert.equal(good.messages[0].content, '¿qué preparar para la visita?');
  const contents = buildGeminiContents(good.messages, {farm: 'La Pradera', clientName: 'Ana'});
  assert.match(contents[0].parts[0].text, /La Pradera/);
  assert.equal(contents[1].role, 'model');
  const body = buildGeminiRequestBody(good.messages, {farm: 'La Pradera'}, CONSULTA_AVGUST_MODEL);
  assert.equal(body.generationConfig.maxOutputTokens, 768);
  assert.doesNotMatch(JSON.stringify(body), /AIza|GEMINI_API_KEY/);
});

test('function and route sources do not embed a Gemini key', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const files = [
    'functions/index.js',
    'functions/consulta-avgust.js',
    'functions/package.json',
    'app/api/consulta-avgust/route.ts',
    'lib/consulta-avgust-core.mjs',
    'scripts/build-firebase.mjs',
    'firebase.json'
  ];
  const combined = files.map(rel => fs.readFileSync(path.join(root, rel), 'utf8')).join('\n');
  assert.doesNotMatch(combined, /AIza[0-9A-Za-z\-_]{10,}/);
  assert.doesNotMatch(combined, /GEMINI_API_KEY\s*[:=]\s*['"][^'"]+['"]/);
  assert.doesNotMatch(combined, /x-goog-api-key['"]?\s*[:=]\s*['"][^'"]+['"]/);
});

test('browser calls only allow the portal origins', () => {
  assert.equal(consultaAllowOrigin('https://gen-lang-client-0175464290.web.app'), 'https://gen-lang-client-0175464290.web.app');
  assert.equal(consultaAllowOrigin('https://evil.example'), '');
  assert.equal(consultaAllowOrigin('https://care360.avgust.com', 'https://care360.avgust.com'), 'https://care360.avgust.com');
});
