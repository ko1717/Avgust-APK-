#!/usr/bin/env python3
"""Añade «Tipo de cultivo» a la visita y al encabezado del informe.

- Campo editable en Datos de la finca (después de Municipio / zona).
- Se guarda en la visita (runtime).
- Aparece en el encabezado del informe en pantalla y en Word.
"""

from __future__ import annotations

import argparse
from pathlib import Path

INDEX_PATCHES = (
    (
        "valor por defecto de la visita",
        "city:``,zone:``,technician:``,responsible:`Wilson Castro`",
        "city:``,zone:``,crop:``,technician:``,responsible:`Wilson Castro`",
    ),
    (
        "campo en datos de la finca",
        "[`city`,`Departamento / ciudad`],[`zone`,`Municipio / zona`],"
        "[`technician`,`Representante de la finca *`]",
        "[`city`,`Departamento / ciudad`],[`zone`,`Municipio / zona`],"
        "[`crop`,`Tipo de cultivo`],[`technician`,`Representante de la finca *`]",
    ),
    (
        "encabezado del informe (tabla)",
        "[`Finca`,e.farm],[`Fecha`,e.date],[`Ciudad / departamento`,e.city],"
        "[`Municipio / zona`,e.zone],[`Representante de la finca`,e.technician]",
        "[`Finca`,e.farm],[`Fecha`,e.date],[`Tipo de cultivo`,e.crop],"
        "[`Ciudad / departamento`,e.city],[`Municipio / zona`,e.zone],"
        "[`Representante de la finca`,e.technician]",
    ),
    (
        "subtítulo Word del informe",
        "o(`${e.farm} · ${e.date}`)",
        "o(`${e.farm} · ${e.date}`+(e.crop?` · `+e.crop:``))",
    ),
    (
        "subtítulo HTML del informe",
        "(0,K.jsxs)(`p`,{children:[(0,K.jsx)(`strong`,{children:e.farm||`Finca pendiente`}),` · `,e.date]})",
        "(0,K.jsxs)(`p`,{children:[(0,K.jsx)(`strong`,{children:e.farm||`Finca pendiente`}),` · `,e.date,e.crop?` · `+e.crop:``]})",
    ),
)

RUNTIME_PATCHES = (
    (
        "persistir cultivo en la visita",
        "farm:r(`farm`),date:r(`date`),city:r(`city`),zone:r(`zone`),technician:r(`technician`)",
        "farm:r(`farm`),date:r(`date`),city:r(`city`),zone:r(`zone`),crop:r(`crop`),technician:r(`technician`)",
    ),
)


def already(name: str, source: str) -> bool:
    if "cultivo" in name or "crop" in name.lower() or "encabezado" in name or "subtítulo" in name or "campo" in name or "valor" in name:
        if name.startswith("persistir"):
            return "crop:r(`crop`)" in source
        if "tabla" in name:
            return "[`Tipo de cultivo`,e.crop]" in source
        if "Word" in name:
            return "e.crop?` · `+e.crop:``" in source and "o(`${e.farm}" in source
        if "HTML" in name:
            return "e.crop?` · `+e.crop:``]})" in source or "e.date,e.crop?` · `+e.crop:``]})" in source
        if "campo" in name:
            return "[`crop`,`Tipo de cultivo`]" in source
        if "valor" in name:
            return "crop:``" in source
    return False


def apply_patches(path: Path, patches: tuple[tuple[str, str, str], ...]) -> list[str]:
    source = path.read_text(encoding="utf-8")
    applied = []
    for name, old, new in patches:
        if already(name, source):
            continue
        if old not in source:
            continue
        # La tabla del informe aparece dos veces (Word y HTML): reemplazar todas.
        count = 0 if "tabla" in name else 1
        source = source.replace(old, new) if count == 0 else source.replace(old, new, 1)
        applied.append(name)
    if applied:
        path.write_text(source, encoding="utf-8")
    return applied


def unique_paths(root: Path, patterns: list[str]) -> list[Path]:
    seen = set()
    out = []
    for pattern in patterns:
        for path in root.rglob(pattern):
            if not path.is_file():
                continue
            key = str(path.resolve())
            if key in seen:
                continue
            seen.add(key)
            out.append(path)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="directorio extraído del APK o de la vista previa")
    args = parser.parse_args()
    root = Path(args.root)

    changed = []
    missing = {name for name, _, _ in INDEX_PATCHES + RUNTIME_PATCHES}

    for path in unique_paths(root, ["index-*.js"]):
        text = path.read_text(encoding="utf-8")
        present = {name for name, _, _ in INDEX_PATCHES if already(name, text)}
        applied = apply_patches(path, INDEX_PATCHES)
        if applied:
            changed.append((str(path), "aplicado", applied))
        elif present:
            changed.append((str(path), "ya estaba", sorted(present)))
        missing.difference_update(present)
        missing.difference_update(applied)

    for path in unique_paths(root, ["device-runtime*.js"]):
        text = path.read_text(encoding="utf-8")
        present = {name for name, _, _ in RUNTIME_PATCHES if already(name, text)}
        applied = apply_patches(path, RUNTIME_PATCHES)
        if applied:
            changed.append((str(path), "aplicado", applied))
        elif present:
            changed.append((str(path), "ya estaba", sorted(present)))
        missing.difference_update(present)
        missing.difference_update(applied)

    if missing:
        print("No se encontraron estos parches de cultivo: " + ", ".join(sorted(missing)))
        return 1
    print("Tipo de cultivo actualizado en:")
    for path, state, names in changed:
        print("  ", path, f"→ {state}:", ", ".join(names))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
