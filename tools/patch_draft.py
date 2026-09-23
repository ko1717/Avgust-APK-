#!/usr/bin/env python3
"""Ajustes del borrador local y de la visita nueva.

Tras borrar una versión de informe, el borrador automático suele seguir en el
dispositivo. El bundle original lo recupera y abre el editor («Nueva visita
técnica»), lo que parece una carga del informe borrado y confunde con Cancelar
del diálogo nativo.

Cambios:
1. Recuperar el borrador en memoria, pero no abrir el editor solo.
2. «Nueva visita» descarta el borrador sucio en lugar de guardarlo primero.
3. La visita nueva nace con el capítulo 2 (2.1–2.8 del catálogo Tf), además
   de 3–5. Sin eso el KPI de Mediciones y pesaje no tiene SI/NO que contar.
"""

from __future__ import annotations

import argparse
from pathlib import Path

OLD_RECOVERY = (
    "e&&M8(`/api/draft`).then(e=>{e&&(g(e),k(!0),l(!0),s(`visits`),"
    "M({text:`Se recuperó tu último borrador local. Revisa y guarda la visita para continuar.`}))})"
    ".catch(()=>r(`No se pudo recuperar el borrador local.`))"
)

NEW_RECOVERY = (
    "e&&M8(`/api/draft`).then(e=>{e&&(g(e),k(!0),s(`visits`),"
    "M({text:`Hay un borrador local. Usa «Continuar borrador» para retomarlo o «Nueva visita» para empezar limpio.`}))})"
    ".catch(()=>r(`No se pudo recuperar el borrador local.`))"
)

OLD_SE = (
    "async function se(e){let t=e;if(O){let n=await ne();e?.id===n.id&&(t=n)}"
    "g(t||Af()),k(!!(t&&!t.id)),B(``),v(`datos`),b(t?.chapters[0]||3),l(!0),u(`visits`)}"
)

NEW_SE = (
    "async function se(e){let t=e;"
    "if(O&&e){let n=await ne();e?.id===n.id&&(t=n)}"
    "if(!e&&O){try{await M8(`/api/draft`,{method:`DELETE`})}catch{}"
    "k(!1)}"
    "g(t||Af()),k(!!(t&&!t.id)),B(``),v(`datos`),b(t?.chapters[0]||3),l(!0),u(`visits`)}"
)

# El catálogo Tf tiene 2.1–2.8. «Nueva visita» llama ce() → Af() y, si
# Af() nace en [3,4,5], esos ítems nunca se responden. Incluir 2 no inventa
# un porcentaje: solo deja el capítulo visible para evaluarlo.
OLD_AF_CHAPTERS = "responsible:`Wilson Castro`,rtc:``,chapters:[3,4,5],answers:{}"
NEW_AF_CHAPTERS = "responsible:`Wilson Castro`,rtc:``,chapters:[2,3,4,5],answers:{}"

MARKERS = (
    "Hay un borrador local. Usa «Continuar borrador»",
    "if(!e&&O){try{await M8(`/api/draft`,{method:`DELETE`})",
    "chapters:[2,3,4,5]",
)


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


def patch_file(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    applied = []

    if OLD_RECOVERY in source:
        source = source.replace(OLD_RECOVERY, NEW_RECOVERY, 1)
        applied.append("recuperación sin abrir editor")
    elif MARKERS[0] not in source and "Se recuperó tu último borrador local" in source:
        return []

    if OLD_SE in source:
        source = source.replace(OLD_SE, NEW_SE, 1)
        applied.append("nueva visita descarta borrador")
    elif MARKERS[1] not in source and "async function se(e){let t=e;if(O){" in source:
        return []

    if OLD_AF_CHAPTERS in source:
        source = source.replace(OLD_AF_CHAPTERS, NEW_AF_CHAPTERS, 1)
        applied.append("visita nueva incluye capítulo 2")
    elif "function Af()" in source and "chapters:[3,4,5]" in source and "chapters:[2,3,4,5]" not in source:
        source = source.replace("chapters:[3,4,5]", "chapters:[2,3,4,5]", 1)
        applied.append("visita nueva incluye capítulo 2")

    if applied:
        path.write_text(source, encoding="utf-8")
    elif all(marker in source for marker in MARKERS):
        return ["ya estaba"]
    return applied


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
        print("No se encontró la recuperación de borrador / Nueva visita para parchear.")
        return 1
    print("Borrador local actualizado en:")
    for path, state in changed:
        label = ", ".join(state) if isinstance(state, list) else state
        print("  ", path, f"→ {label}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
