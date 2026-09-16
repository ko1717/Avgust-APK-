#!/usr/bin/env python3
"""Mediciones MIPE dentro de los capítulos de evaluación.

- Amplía el mapa de mediciones (conductividad, implementos, mezcla final,
  presión del implemento).
- En el Word agrupa por criterio del capítulo (4.6, 4.10, 5.1, 5.3, 5.6).
"""

from __future__ import annotations

import argparse
from pathlib import Path

OLD_KF = (
    "kf={ph:`pH del agua`,hardness:`Dureza (ppm)`,pressure:`Presión (PSI)`,"
    "volume:`Volumen por cama (L)`,time:`Tiempo por cama (s)`,equipment:`Equipo de aplicación`}"
)
MID_KF = (
    "kf={ph:`pH del agua`,hardness:`Dureza (ppm)`,conductivity:`Conductividad`,"
    "pressure:`Presión (PSI)`,equipment:`Equipo de aplicación`,"
    "implement:`Implementos de aplicación`,"
    "volume:`Volumen por cama (L)`,time:`Tiempo por cama (s)`}"
)
MIX_KF = (
    "kf={ph:`pH del agua`,hardness:`Dureza (ppm)`,conductivity:`Conductividad`,"
    "mixPh:`pH mezcla final`,mixHardness:`Dureza mezcla final (ppm)`,"
    "pressure:`Presión (PSI)`,equipment:`Equipo de aplicación`,"
    "implement:`Implementos de aplicación`,"
    "volume:`Volumen por cama (L)`,time:`Tiempo por cama (s)`}"
)
NEW_KF = (
    "kf={ph:`pH del agua`,hardness:`Dureza (ppm)`,conductivity:`Conductividad`,"
    "mixPh:`pH mezcla final`,mixHardness:`Dureza mezcla final (ppm)`,"
    "pressure:`Presión de la bomba (PSI)`,"
    "implementPressure:`Presión del implemento de aplicación (PSI)`,"
    "equipment:`Equipo de aplicación`,"
    "implement:`Implementos de aplicación`,"
    "volume:`Volumen por cama (L)`,time:`Tiempo por cama (s)`}"
)

OLD_WORD = (
    "let l=Object.entries(kf).filter(([t])=>e.measurements[t]).map(([t,n])=>[n,e.measurements[t]]);"
    "l.length&&(s(`Mediciones de campo`),c(l))"
)
MID_WORD = (
    "let xf=[[`Cap. 4 · 4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
    "[`Cap. 5 · 5.1 Presión de la bomba`,[`pressure`]],"
    "[`Equipo de aplicación`,[`equipment`,`implement`]],"
    "[`Cap. 5 · 5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
    "xf.some(([,n])=>n.some(t=>e.measurements[t]))&&(s(`Mediciones de campo`),"
    "xf.forEach(([t,n])=>{let r=n.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
    "r.length&&(s(t,Iv.HEADING_2),c(r))}))"
)
MIX_WORD = (
    "let xf=[[`Cap. 4 · 4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
    "[`Cap. 4 · 4.10 Mezcla final`,[`mixPh`,`mixHardness`]],"
    "[`Cap. 5 · 5.1 Presión de la bomba`,[`pressure`]],"
    "[`Cap. 5 · 5.3 Equipo de aplicación`,[`equipment`,`implement`]],"
    "[`Cap. 5 · 5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
    "xf.forEach(([t,n])=>{let r=n.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
    "r.length&&(s(t,Iv.HEADING_2),c(r))})"
)
NEW_WORD = (
    "let xf=[[`Cap. 4 · 4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
    "[`Cap. 4 · 4.10 Mezcla final`,[`mixPh`,`mixHardness`]],"
    "[`Cap. 5 · 5.1 Presión`,[`pressure`,`implementPressure`]],"
    "[`Cap. 5 · 5.3 Equipo de aplicación`,[`equipment`,`implement`]],"
    "[`Cap. 5 · 5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
    "xf.forEach(([t,n])=>{let r=n.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
    "r.length&&(s(t,Iv.HEADING_2),c(r))})"
)


def patch_file(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    applied = []

    if "implementPressure:`Presión del implemento" not in source:
        if OLD_KF in source:
            source = source.replace(OLD_KF, NEW_KF, 1)
            applied.append("mapa de mediciones")
        elif MID_KF in source:
            source = source.replace(MID_KF, NEW_KF, 1)
            applied.append("mapa de mediciones")
        elif MIX_KF in source:
            source = source.replace(MIX_KF, NEW_KF, 1)
            applied.append("mapa de mediciones (presión implemento)")
    else:
        applied.append("mapa de mediciones (ya estaba)")

    if "implementPressure`" not in source or "[`pressure`,`implementPressure`]" not in source:
        if OLD_WORD in source:
            source = source.replace(OLD_WORD, NEW_WORD, 1)
            applied.append("informe Word")
        elif MID_WORD in source:
            source = source.replace(MID_WORD, NEW_WORD, 1)
            applied.append("informe Word")
        elif MIX_WORD in source:
            source = source.replace(MIX_WORD, NEW_WORD, 1)
            applied.append("informe Word (presión implemento)")
        elif "[`Cap. 5 · 5.1 Presión de la bomba`,[`pressure`]]" in source:
            source = source.replace(
                "[`Cap. 5 · 5.1 Presión de la bomba`,[`pressure`]]",
                "[`Cap. 5 · 5.1 Presión`,[`pressure`,`implementPressure`]]",
                1,
            )
            applied.append("informe Word (presión implemento)")
    else:
        applied.append("informe Word (ya estaba)")

    real = [name for name in applied if "ya estaba" not in name]
    if real:
        path.write_text(source, encoding="utf-8")
    return applied


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="directorio extraído del APK o de la vista previa")
    args = parser.parse_args()
    root = Path(args.root)
    changed = []
    missing = {"mapa de mediciones", "informe Word"}
    seen = set()
    for path in list(root.rglob("index-*.js")) + list(root.glob("assets/*.js")):
        if not path.is_file():
            continue
        key = str(path.resolve())
        if key in seen:
            continue
        seen.add(key)
        applied = patch_file(path)
        if applied:
            changed.append((str(path), applied))
            for name in applied:
                if "mapa" in name:
                    missing.discard("mapa de mediciones")
                if "Word" in name:
                    missing.discard("informe Word")
    if missing:
        print("No se encontraron estos parches: " + ", ".join(sorted(missing)))
        return 1
    print("Mediciones e informe actualizados en:")
    for path, applied in changed:
        print("  ", path, "→", ", ".join(applied))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
