#!/usr/bin/env python3
"""Amplía las mediciones de campo según el protocolo MIPE.

Añade conductividad y bomba/implemento, y aclara que el equipo es lanza o
aguilón. Los datos se guardan en el mismo objeto `measurements` del informe.
"""

from __future__ import annotations

import argparse
from pathlib import Path

OLD = (
    "kf={ph:`pH del agua`,hardness:`Dureza (ppm)`,pressure:`Presión (PSI)`,"
    "volume:`Volumen por cama (L)`,time:`Tiempo por cama (s)`,equipment:`Equipo de aplicación`}"
)
NEW = (
    "kf={ph:`pH del agua`,hardness:`Dureza (ppm)`,conductivity:`Conductividad`,"
    "pressure:`Presión (PSI)`,implement:`Bomba / implemento`,"
    "volume:`Volumen por cama (L)`,time:`Tiempo por cama (s)`,"
    "equipment:`Equipo (lanza o aguilón)`}"
)


def patch_file(path: Path) -> bool:
    source = path.read_text(encoding="utf-8")
    if OLD not in source:
        return False
    path.write_text(source.replace(OLD, NEW, 1), encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="directorio extraído del APK o de la vista previa")
    args = parser.parse_args()
    root = Path(args.root)
    changed = []
    for path in list(root.rglob("index-*.js")) + list(root.glob("assets/*.js")):
        if path.is_file() and patch_file(path):
            changed.append(str(path))
    if not changed:
        print("No se encontró el mapa de mediciones para ampliarlo")
        return 1
    print("Mediciones ampliadas en:")
    for path in changed:
        print("  ", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
