#!/usr/bin/env python3
"""Incluye capítulo 2 y mediciones en el respaldo / restauración.

- La visita nueva evalúa los 5 capítulos (antes 3–5), así el pesaje viaja.
- El validador de visitas acepta mediciones numéricas y respuestas 2.x
  sin tumbar el restore.
- Restaurar acepta JSON de «Respaldar formulario» además del .care360.
"""

from __future__ import annotations

import argparse
from pathlib import Path

OLD_DEFAULT_CHAPTERS = "responsible:`Wilson Castro`,rtc:``,chapters:[3,4,5],answers:{}"
NEW_DEFAULT_CHAPTERS = "responsible:`Wilson Castro`,rtc:``,chapters:[1,2,3,4,5],answers:{}"

OLD_TEXT_MAP = (
    "a=e=>{let t=n[e];if(!t||typeof t!=`object`||Array.isArray(t))"
    "throw Error(`400:Campo inválido: ${e}.`);let r={};"
    "for(let[e,n]of Object.entries(t)){"
    "if(!/^[a-z0-9.]+$/i.test(e)||typeof n!=`string`||n.length>12e3)"
    "throw Error(`400:Texto inválido.`);r[e]=n}return r}"
)
NEW_TEXT_MAP = (
    "a=e=>{let t=n[e];if(t==null||t===``)t={};"
    "if(typeof t!=`object`||Array.isArray(t))"
    "throw Error(`400:Campo inválido: ${e}.`);let r={};"
    "for(let[e,n]of Object.entries(t)){"
    "if(!/^[a-z0-9.]+$/i.test(e))continue;"
    "let i=n==null?``:typeof n==`string`?n:String(n);"
    "if(i.length>12e3)i=i.slice(0,12e3);r[e]=i}return r}"
)

OLD_ANSWERS = (
    "for(let[e,t]of Object.entries(s)){"
    "if(!c.has(e)||!t||typeof t!=`object`||"
    "![``,`SI`,`NO`,`NA`].includes(t.value)||"
    "typeof t.observation!=`string`||typeof t.recommendation!=`string`||"
    "t.observation.length>12e3||t.recommendation.length>12e3)"
    "throw Error(`400:Respuesta inválida.`);"
    "o[e]={value:t.value,observation:t.observation,recommendation:t.recommendation}}"
)
NEW_ANSWERS = (
    "for(let[e,t]of Object.entries(s)){"
    "if(!c.has(e)&&!/^\\d+\\.\\d+$/.test(e))continue;"
    "if(!t||typeof t!=`object`||Array.isArray(t))continue;"
    "let v=typeof t.value==`string`?t.value:t.value==null?``:String(t.value);"
    "if(v===`si`||v===`SI`||v===`Sí`||v===`sí`)v=`SI`;"
    "else if(v===`no`||v===`NO`)v=`NO`;"
    "else if(v===`na`||v===`NA`||v===`n/a`)v=`NA`;"
    "if(![``,`SI`,`NO`,`NA`].includes(v))continue;"
    "let obs=typeof t.observation==`string`?t.observation:t.observation==null?``:String(t.observation);"
    "let rec=typeof t.recommendation==`string`?t.recommendation:t.recommendation==null?``:String(t.recommendation);"
    "if(obs.length>12e3)obs=obs.slice(0,12e3);if(rec.length>12e3)rec=rec.slice(0,12e3);"
    "o[e]={value:v,observation:obs,recommendation:rec}}"
)

OLD_ACCEPT = "t.accept=`.care360,application/octet-stream`"
NEW_ACCEPT = "t.accept=`.care360,.json,.zip,application/octet-stream,application/json`"

OLD_RESTORE = (
    "restore:async()=>{try{let e=await P();if(!e)return{cancelled:!0};"
    "let t=await w(r);return a.store=re(a.store,e,t,()=>{i()}),await i(),"
    "setTimeout(()=>location.reload(),100),{message:`Respaldo restaurado.`}}"
    "catch(e){return{error:e instanceof Error?e.message:`No se restauró el archivo.`}}}"
)
NEW_RESTORE = (
    "restore:async()=>{try{let e=await P();if(!e)return{cancelled:!0};"
    "if(window.C360Import&&window.C360Import.looksLikeJsonBackup&&"
    "window.C360Import.looksLikeJsonBackup(e)){"
    "let n=await window.C360Import.restoreJsonBackup(e);"
    "return setTimeout(()=>location.reload(),100),"
    "(n||{message:`Respaldo JSON restaurado.`})}"
    "let t=await w(r);return a.store=re(a.store,e,t,()=>{i()}),await i(),"
    "setTimeout(()=>location.reload(),100),{message:`Respaldo restaurado.`}}"
    "catch(e){return{error:e instanceof Error?e.message:`No se restauró el archivo.`}}}"
)

INDEX_PATCHES = (
    ("visita nueva con los 5 capítulos", OLD_DEFAULT_CHAPTERS, NEW_DEFAULT_CHAPTERS),
)
RUNTIME_PATCHES = (
    ("mapas de texto tolerantes (mediciones)", OLD_TEXT_MAP, NEW_TEXT_MAP),
    ("respuestas de capítulo 2 en el validador", OLD_ANSWERS, NEW_ANSWERS),
    ("restaurar acepta JSON", OLD_ACCEPT, NEW_ACCEPT),
    ("restaurar JSON de formulario", OLD_RESTORE, NEW_RESTORE),
)


def already(name: str, source: str) -> bool:
    if name == "visita nueva con los 5 capítulos":
        return NEW_DEFAULT_CHAPTERS in source
    if name == "mapas de texto tolerantes (mediciones)":
        return "if(t==null||t===``)t={}" in source and "Campo inválido" in source
    if name == "respuestas de capítulo 2 en el validador":
        return r"/^\d+\.\d+$/.test(e)" in source or "/^\\d+\\.\\d+$/.test(e)" in source
    if name == "restaurar acepta JSON":
        return ".json" in source and "care360" in source and "accept=" in source
    if name == "restaurar JSON de formulario":
        return "looksLikeJsonBackup" in source
    return False


def apply_patches(path: Path, patches: tuple[tuple[str, str, str], ...]) -> list[str]:
    source = path.read_text(encoding="utf-8")
    applied: list[str] = []
    for name, old, new in patches:
        if already(name, source) and old not in source:
            applied.append(f"{name} (ya estaba)")
            continue
        if old not in source:
            continue
        source = source.replace(old, new, 1)
        applied.append(name)
    if any("ya estaba" not in n for n in applied):
        path.write_text(source, encoding="utf-8")
    return applied


def index_paths(root: Path) -> list[Path]:
    found, seen = [], set()
    for path in list(root.rglob("index-*.js")) + list(root.glob("assets/index-*.js")):
        if not path.is_file() or "device-runtime" in path.name:
            continue
        key = str(path.resolve())
        if key in seen:
            continue
        seen.add(key)
        found.append(path)
    return found


def runtime_paths(root: Path) -> list[Path]:
    found, seen = [], set()
    for path in list(root.rglob("device-runtime*.js")) + list(root.glob("assets/device-runtime*.js")):
        if not path.is_file():
            continue
        key = str(path.resolve())
        if key in seen:
            continue
        seen.add(key)
        found.append(path)
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="directorio extraído del APK o de la vista previa")
    args = parser.parse_args()
    root = Path(args.root)
    changed = []
    for path in index_paths(root):
        applied = apply_patches(path, INDEX_PATCHES)
        if applied:
            changed.append((str(path), applied))
    for path in runtime_paths(root):
        applied = apply_patches(path, RUNTIME_PATCHES)
        if applied:
            changed.append((str(path), applied))
    if not changed:
        print("No se aplicaron parches de respaldo")
        return 1
    print("Respaldo actualizado en:")
    for path, applied in changed:
        print("  ", path, "→", ", ".join(applied))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
