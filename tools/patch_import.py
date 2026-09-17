#!/usr/bin/env python3
"""Mejoras de importación de fincas e informes históricos.

- Acepta respuestas “Sí cumple” / “No cumple” en la matriz.
- Renombra el panel a “Importar finca e informes”.
- Amplía el mensaje de ayuda (Excel, CSV, Word).
"""

from __future__ import annotations

import argparse
from pathlib import Path

PATCHES: list[tuple[str, str, str]] = [
    (
        "respuestas Sí cumple / No cumple",
        "N6=e=>{let t=A6(e);return t===`si`||t===`sí`?`SI`:t===`no`?`NO`:t===`no aplica`||t===`na`?`NA`:``}",
        "N6=e=>{let t=A6(e);return t===`si`||t===`si cumple`||t===`cumple`?`SI`:t===`no`||t===`no cumple`||t===`incumple`?`NO`:t===`no aplica`||t===`na`?`NA`:``}",
    ),
    (
        "título del panel de importación",
        "` Importar matriz histórica`",
        "` Importar finca e informes`",
    ),
    (
        "ayuda del panel de importación",
        "`Selecciona la matriz Excel descargada desde CARE 360 o un CSV con Finca, Fecha, Capítulo, Ítem y Respuesta. Se revisa antes de guardar.`",
        "`Sube la matriz Excel/CSV de CARE 360, o un informe Word. Se crean la finca (si falta) y los aseguramientos. Respuestas: Sí cumple, No cumple o No aplica.`",
    ),
    (
        "accept de archivos de importación",
        "accept:`.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv`",
        "accept:`.xlsx,.csv,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document`",
    ),
]


def patch_file(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    applied: list[str] = []
    for name, old, new in PATCHES:
        if new in source and old not in source:
            applied.append(f"{name} (ya estaba)")
            continue
        if old not in source:
            continue
        source = source.replace(old, new, 1)
        applied.append(name)
    real = [n for n in applied if "ya estaba" not in n]
    if real:
        path.write_text(source, encoding="utf-8")
    return applied


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="directorio extraído del APK o de la vista previa")
    args = parser.parse_args()
    root = Path(args.root)
    changed = []
    seen: set[str] = set()
    for path in list(root.rglob("index-*.js")) + list(root.glob("assets/*.js")):
        if not path.is_file() or "device-runtime" in path.name:
            continue
        key = str(path.resolve())
        if key in seen:
            continue
        seen.add(key)
        applied = patch_file(path)
        if applied:
            changed.append((str(path), applied))
    if not changed:
        print("No se aplicaron parches de importación")
        return 1
    print("Importación actualizada en:")
    for path, applied in changed:
        print("  ", path, "→", ", ".join(applied))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
