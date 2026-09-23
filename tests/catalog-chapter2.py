#!/usr/bin/env python3
"""El catálogo compilado tiene 2.1–2.8 y la visita nueva los deja seleccionados."""

from __future__ import annotations

import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import patch_draft  # noqa: E402

CHAPTER2_IDS = ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8"]


def extract_seed_js(dest: Path) -> Path:
    apk = ROOT / "tools" / "base" / "capacitor-seed.apk"
    with zipfile.ZipFile(apk) as zf:
        names = [n for n in zf.namelist() if n.startswith("assets/public/assets/index-") and n.endswith(".js")]
        if not names:
            raise SystemExit("No se encontró index-*.js en la semilla")
        target = dest / Path(names[0]).name
        target.write_bytes(zf.read(names[0]))
        return target


def extract_tf(source: str) -> str:
    start = source.find("var Tf=[")
    if start < 0:
        raise SystemExit("No está el catálogo Tf")
    i = source.find("[", start)
    depth = 0
    for k, ch in enumerate(source[i:], i):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return source[i : k + 1]
    raise SystemExit("Catálogo Tf incompleto")


def main() -> int:
    work = Path(tempfile.mkdtemp(prefix="care360-catalog-ch2-"))
    results: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, extra: str = "") -> None:
        results.append((name, ok, extra))
        print(("PASS  " if ok else "FAIL  ") + name + (("  -> " + extra) if extra else ""))

    try:
        js = extract_seed_js(work)
        source = js.read_text(encoding="utf-8")
        tf = extract_tf(source)
        items = re.findall(r"id:`(2\.\d+)`", tf)
        titles = re.findall(r"\{id:(\d+),title:`([^`]*)`", tf)
        title2 = next((t for cid, t in titles if cid == "2"), "")
        check("Tf incluye el capítulo 2", bool(title2), title2)
        check(
            "los ítems de pesaje son 2.1–2.8",
            items == CHAPTER2_IDS,
            ",".join(items),
        )
        check("2.4 habla de instrumentos de dosificación", "instrumentos para dosificación" in tf)
        check("Af() de la semilla nace en 3–4–5", "chapters:[3,4,5]" in source)
        check("Nueva visita llama ce() sin capítulos", "onClick:()=>ce(),children:" in source)

        applied = patch_draft.patch_file(js)
        patched = js.read_text(encoding="utf-8")
        check(
            "el parche deja Af() en 2–3–4–5",
            "chapters:[2,3,4,5]" in patched and "responsible:`Wilson Castro`,rtc:``,chapters:[3,4,5]" not in patched,
            ", ".join(applied),
        )
        check("siguen existiendo 2.1–2.8 después del parche", all(f"id:`{i}`" in patched for i in CHAPTER2_IDS))
        check(
            "4.6 es calidad del agua, no el KPI de pesaje",
            "id:`4.6`" in tf and ("calidad del agua" in tf or "parametros adecuados" in tf),
        )
    finally:
        shutil.rmtree(work, ignore_errors=True)

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} pruebas de catálogo superadas.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
