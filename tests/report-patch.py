#!/usr/bin/env python3
"""Comprueba que los parches dejan el Word con mediciones junto al ítem."""

from __future__ import annotations

import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import patch_measurements  # noqa: E402
import patch_report  # noqa: E402


def extract_seed_js(dest: Path) -> Path:
    apk = ROOT / "tools" / "base" / "capacitor-seed.apk"
    with zipfile.ZipFile(apk) as zf:
        names = [n for n in zf.namelist() if n.startswith("assets/public/assets/index-") and n.endswith(".js")]
        if not names:
            raise SystemExit("No se encontró index-*.js en la semilla")
        target = dest / Path(names[0]).name
        target.write_bytes(zf.read(names[0]))
        return target


def main() -> int:
    work = Path(tempfile.mkdtemp(prefix="care360-report-patch-"))
    try:
        js = extract_seed_js(work)
        applied_m = patch_measurements.patch_file(js)
        applied_r = patch_report.patch_file(js)
        source = js.read_text(encoding="utf-8")
        checks = [
            ("mediciones junto al ítem", "xf.filter(([i])=>i===n.id)" in source),
            ("sin observaciones de capítulo en Word", "s(`Observaciones del capítulo`" not in source),
            (
                "sin observaciones de capítulo en HTML",
                "(0,K.jsx)(`h3`,{children:`Observaciones del capítulo`})" not in source,
            ),
            ("parámetros con tilde", "parámetros adecuados" in source),
            ("sin parametros sin tilde", "parametros adecuados" not in source),
            ("envases originales", "envases originales" in source),
            ("implementos", "Los implementos de aspersión" in source),
            ("metodología", "title:`METODOLOGÍA`" in source),
        ]
        print("patch_measurements:", ", ".join(applied_m) or "(nada)")
        print("patch_report:", ", ".join(applied_r) or "(nada)")
        failed = 0
        for name, ok in checks:
            print(("PASS  " if ok else "FAIL  ") + name)
            failed += 0 if ok else 1
        return 1 if failed else 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
