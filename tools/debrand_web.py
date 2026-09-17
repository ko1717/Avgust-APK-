#!/usr/bin/env python3
"""Quita la marca Avgust de los archivos web (y la etiqueta del paquete).

Sustituye el logotipo, el favicon, el nombre visible y los textos de la
interfaz. No toca identificadores internos (base de datos, puente de archivos,
paquete Android) para que los datos y la instalación encima sigan funcionando.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

PROTECTED = [
    "AvgustFileBridge",
    "avgust-care-desktop",
    "avgust-care360",
    "co.com.avgust",
    "Lco/com/avgust",
    "avgust.care360",
    "/avgust-logo.svg",
]

PAIRS = [
    ("Avgust Crop Protection", "Acompañamiento en campo"),
    ("AVGUST Crop Protection", "Acompañamiento en campo"),
    ("EQUIPO AVGUST CARE 360", "EQUIPO DE CAMPO"),
    ("AVGUST CARE 360", "CARE 360"),
    ("AVGUST care 360", "CARE 360"),
    ("AVGUST-CARE-", "CARE-360-"),
    ("Responsable AVGUST", "Responsable técnico"),
    ("responsable AVGUST", "responsable técnico"),
    ("Técnico AVGUST", "Técnico de campo"),
    ("profesional de AVGUST", "profesional técnico"),
    ("asistencia técnica de Avgust", "asistencia técnica en campo"),
    (" · AVGUST", ""),
    (" de AVGUST", " técnico"),
]

EMPTY_LOGO = """<svg xmlns="http://www.w3.org/2000/svg" width="1303" height="347" viewBox="0 0 1303 347"></svg>
"""

NEUTRAL_FAVICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#14532d"/><path d="M32 10c-9 6-14 11-14 19a14 14 0 0 0 28 0c0-8-5-13-14-19z" fill="#7cb342"/><path d="M32 14v30M32 30l-8-8M32 26l8-8" stroke="#14532d" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M24 44l5 5 11-12" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
"""

# Verde agro profesional de la edición sin marca.
PRO_THEME = "#14532d"
LEGACY_THEME = "#007fa3"


def scrub_text(source: str) -> str:
    placeholders = {}
    for index, token in enumerate(PROTECTED):
        mark = "@@C360P%d@@" % index
        placeholders[mark] = token
        source = source.replace(token, mark)
    for old, new in PAIRS:
        source = source.replace(old, new)
    source = re.sub(r"(?<![A-Za-z])AVGUST(?![A-Za-z])", "", source)
    source = re.sub(r"(?<![A-Za-z])Avgust(?![A-Za-z])", "", source)
    for mark, token in placeholders.items():
        source = source.replace(mark, token)
    return source


def patch_arsc_label(data: bytearray) -> bool:
    needle = b"AVGUST CARE 360"
    offset = data.find(needle)
    if offset < 0:
        return False
    prefix = offset - 2
    if prefix < 0 or data[prefix] != 15 or data[prefix + 1] != 15:
        replacement = b"CARE 360       "
        data[offset : offset + 15] = replacement
        return True
    data[prefix] = 8
    data[prefix + 1] = 8
    data[offset : offset + 8] = b"CARE 360"
    data[offset + 8] = 0
    for extra in range(9, 15):
        data[offset + extra] = 0
    return True


def patch_tree(root: Path) -> list[str]:
    changed: list[str] = []
    logo = root / "assets/public/avgust-logo.svg"
    if not logo.exists():
        logo = root / "avgust-logo.svg"
    if logo.exists():
        logo.write_text(EMPTY_LOGO, encoding="utf-8")
        changed.append(str(logo))

    favicon = root / "assets/public/favicon.svg"
    if not favicon.exists():
        favicon = root / "favicon.svg"
    if favicon.exists():
        favicon.write_text(NEUTRAL_FAVICON, encoding="utf-8")
        changed.append(str(favicon))

    text_globs = [
        "assets/public/index.html",
        "assets/public/manifest.webmanifest",
        "assets/public/sw.js",
        "assets/public/assets/*.js",
        "assets/capacitor.config.json",
        "index.html",
        "manifest.webmanifest",
        "sw.js",
        "assets/*.js",
        "capacitor.config.json",
    ]
    seen = set()
    for pattern in text_globs:
        for path in root.glob(pattern):
            if path in seen or not path.is_file():
                continue
            seen.add(path)
            original = path.read_text(encoding="utf-8")
            updated = scrub_text(original)
            if LEGACY_THEME in updated:
                updated = updated.replace(LEGACY_THEME, PRO_THEME)
            if updated != original:
                path.write_text(updated, encoding="utf-8")
                changed.append(str(path))

    arsc = root / "resources.arsc"
    if arsc.exists():
        blob = bytearray(arsc.read_bytes())
        if patch_arsc_label(blob):
            arsc.write_bytes(blob)
            changed.append(str(arsc))

    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="directorio con los archivos extraídos del APK o la vista previa")
    args = parser.parse_args()
    root = Path(args.root)
    if not root.is_dir():
        print("No existe el directorio %s" % root)
        return 1
    changed = patch_tree(root)
    print("Desmarcado: %d archivos" % len(changed))
    for path in changed:
        print("  ", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
