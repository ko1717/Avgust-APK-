const {build}=require('esbuild');
const fs=require('node:fs');
const path=require('node:path');
const wasm=path.join('node_modules','sql.js','dist','sql-wasm.wasm');
if(fs.existsSync(wasm))fs.copyFileSync(wasm,path.join('public','sql-wasm.wasm'));
Promise.all([
 build({entryPoints:['lib/validate.ts'],bundle:true,platform:'node',format:'cjs',outfile:'desktop/generated/validate.cjs'}),
 build({entryPoints:['lib/metric-definitions.ts'],bundle:true,platform:'node',format:'cjs',outfile:'desktop/generated/metric-definitions.cjs'}),
]).then(()=>fs.copyFileSync('lib/catalog.json','desktop/generated/catalog.json')).catch(()=>process.exit(1));
