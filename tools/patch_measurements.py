#!/usr/bin/env python3
"""Amplía las mediciones de campo según el protocolo MIPE.

Añade conductividad y bomba, nombra los implementos de aplicación
(lanza o aguilón) y los agrupa junto a la presión en el informe Word.
"""

from __future__ import annotations

import argparse
from pathlib import Path

OLD_KF = (
    "kf={ph:`pH del agua`,hardness:`Dureza (ppm)`,pressure:`Presión (PSI)`,"
    "volume:`Volumen por cama (L)`,time:`Tiempo por cama (s)`,equipment:`Equipo de aplicación`}"
)
NEW_KF = (
    "kf={ph:`pH del agua`,hardness:`Dureza (ppm)`,conductivity:`Conductividad`,"
    "pressure:`Presión (PSI)`,equipment:`Implementos de aplicación`,implement:`Bomba`,"
    "volume:`Volumen por cama (L)`,time:`Tiempo por cama (s)`}"
)

OLD_WORD = (
    "let l=Object.entries(kf).filter(([t])=>e.measurements[t]).map(([t,n])=>[n,e.measurements[t]]);"
    "l.length&&(s(`Mediciones de campo`),c(l))"
)
NEW_WORD = (
    "let xf=[[`Cap. 4 · 4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
    "[`Cap. 5 · 5.1 Presión de la bomba`,[`pressure`]],"
    "[`Implementos de aplicación`,[`equipment`,`implement`]],"
    "[`Cap. 5 · 5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
    "xf.some(([,n])=>n.some(t=>e.measurements[t]))&&(s(`Mediciones de campo`),"
    "xf.forEach(([t,n])=>{let r=n.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
    "r.length&&(s(t,Iv.HEADING_2),c(r))}))"
)

OLD_METRIC = "{id:`equipment`,label:`Equipo de aplicación`"
NEW_METRIC = "{id:`equipment`,label:`Implementos de aplicación`"

PATCHES = (
    ("mapa de mediciones", OLD_KF, NEW_KF),
    ("informe Word", OLD_WORD, NEW_WORD),
    ("métricas", OLD_METRIC, NEW_METRIC),
)


def patch_file(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    applied = []
    for name, old, new in PATCHES:
        if old not in source:
            continue
        source = source.replace(old, new, 1)
        applied.append(name)
    if applied:
        path.write_text(source, encoding="utf-8")
    return applied


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="directorio extraído del APK o de la vista previa")
    args = parser.parse_args()
    root = Path(args.root)
    changed = []
    missing = {name for name, _, _ in PATCHES}
    for path in list(root.rglob("index-*.js")) + list(root.glob("assets/*.js")):
        if not path.is_file():
            continue
        applied = patch_file(path)
        if applied:
            changed.append((str(path), applied))
            missing.difference_update(applied)
    if missing:
        print("No se encontraron estos parches: " + ", ".join(sorted(missing)))
        return 1
    print("Mediciones e informe actualizados en:")
    for path, applied in changed:
        print("  ", path, "→", ", ".join(applied))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
