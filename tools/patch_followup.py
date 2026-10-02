#!/usr/bin/env python3
"""En el APK local, Seguimiento debe usar el panel con Agenda y revisión.

El bundle elige el panel «commitments-online» cuando no hay `window.careDesktop`.
Ese panel consulta `/api/commitments`, que no existe en el runtime del dispositivo,
así que las fechas de seguimiento (`visit.followup`) nunca aparecen.

Forzamos el panel clásico (PC), que lista «Seguimientos programados» desde las
visitas guardadas.
"""

from __future__ import annotations

import argparse
from pathlib import Path

OLD_FC = (
    "function FC({desktop:e=!1,farms:t,onOpenId:n,...r})"
    "{return e||typeof window<`u`&&window.careDesktop"
    "?(0,K.jsx)(PC,{...r})"
    ":(0,K.jsx)(MC,{farms:t,busy:r.busy,onOpen:r.onOpen,onOpenId:n})}"
)

NEW_FC = (
    "function FC({desktop:e=!1,farms:t,onOpenId:n,...r})"
    "{return(0,K.jsx)(PC,{...r})}"
)

MARKER = "function FC({desktop:e=!1,farms:t,onOpenId:n,...r}){return(0,K.jsx)(PC,{...r})}"


def index_paths(root: Path) -> list[Path]:
    found = []
    seen = set()
    for path in list(root.rglob("index-*.js")) + list(root.glob("assets/index-*.js")):
        if not path.is_file():
            continue
        key = str(path.resolve())
        if key in seen:
            continue
        seen.add(key)
        found.append(path)
    return found


def patch_file(path: Path) -> str | None:
    source = path.read_text(encoding="utf-8")
    if MARKER in source and OLD_FC not in source:
        return "ya estaba"
    if OLD_FC not in source:
        return None
    path.write_text(source.replace(OLD_FC, NEW_FC, 1), encoding="utf-8")
    return "aplicado"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="directorio extraído del APK o de la vista previa")
    args = parser.parse_args()
    root = Path(args.root)
    changed = []
    for path in index_paths(root):
        state = patch_file(path)
        if state:
            changed.append((str(path), state))
    if not changed:
        print("No se encontró el selector de panel de Seguimiento (FC) para parchear.")
        return 1
    print("Seguimiento (agenda local) actualizado en:")
    for path, state in changed:
        print("  ", path, f"→ {state}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
