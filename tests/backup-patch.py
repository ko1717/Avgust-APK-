#!/usr/bin/env python3
"""Comprueba que el parche de respaldo deja capítulo 2 y mediciones."""

from __future__ import annotations

import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import patch_backup  # noqa: E402


def extract(dest: Path, kind: str) -> Path:
    apk = ROOT / "tools" / "base" / "capacitor-seed.apk"
    prefix = "assets/public/assets/index-" if kind == "index" else "assets/public/assets/device-runtime"
    with zipfile.ZipFile(apk) as zf:
        names = [n for n in zf.namelist() if n.startswith(prefix) and n.endswith(".js")]
        if not names:
            raise SystemExit("No se encontró %s en la semilla" % kind)
        target = dest / Path(names[0]).name
        target.write_bytes(zf.read(names[0]))
        return target


def main() -> int:
    work = Path(tempfile.mkdtemp(prefix="care360-backup-patch-"))
    index = extract(work, "index")
    runtime = extract(work, "runtime")
    applied_i = patch_backup.apply_patches(index, patch_backup.INDEX_PATCHES)
    applied_r = patch_backup.apply_patches(runtime, patch_backup.RUNTIME_PATCHES)
    idx = index.read_text(encoding="utf-8")
    rt = runtime.read_text(encoding="utf-8")
    checks = [
        ("visita nueva con capítulos 1–5", "chapters:[1,2,3,4,5]" in idx),
        ("sin default 3–5", "chapters:[3,4,5]" not in idx),
        ("validador acepta mapas vacíos/numéricos", "if(t==null||t===``)t={}" in rt),
        ("validador acepta ítems 2.x", r"/^\d+\.\d+$/.test(e)" in rt),
        ("restaurar acepta JSON", ".json" in rt and "looksLikeJsonBackup" in rt),
        ("parche index aplicado", any("5 capítulos" in n or "ya estaba" in n for n in applied_i)),
        ("parche runtime aplicado", len(applied_r) >= 3),
    ]
    failed = 0
    for name, ok in checks:
        print(("PASS  " if ok else "FAIL  ") + name)
        if not ok:
            failed += 1
    print("index:", ", ".join(applied_i) or "(nada)")
    print("runtime:", ", ".join(applied_r) or "(nada)")
    if failed:
        return 1
    print("%d/%d comprobaciones de parche superadas." % (len(checks), len(checks)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
