#!/usr/bin/env python3
"""Ajusta el runtime local para fincas y responsables.

- Al crear una finca acepta `managerName` en lugar de fijar «Responsable local».
- Permite renombrar al responsable local con la operación `renameLocal`.
"""

from __future__ import annotations

import argparse
from pathlib import Path

OLD_CREATE = (
    "this.db.prepare(`INSERT INTO farm_members VALUES (?,?,?,?)`)"
    ".run(i,`local`,`Responsable local`,`manager`)"
)
NEW_CREATE = (
    "this.db.prepare(`INSERT INTO farm_members VALUES (?,?,?,?)`)"
    ".run(i,`local`,"
    "(typeof e.managerName==`string`&&e.managerName.trim())"
    "||(r[0]&&r[0].name)||`Responsable local`,`manager`)"
)

OLD_REMOVE = (
    "if(t===`removeLocal`){let t=g(e,`userId`);"
    "if(t===`local`)throw Error(`400:No puedes retirar al responsable local.`)"
)
NEW_REMOVE = (
    "if(t===`renameLocal`){let t=g(e,`name`);"
    "if(!t)throw Error(`400:Escribe el nombre del responsable.`);"
    "return this.db.prepare(`UPDATE farm_members SET name = ? WHERE farm_id = ? AND user_id = ?`)"
    ".run(t,n,`local`),this.save(),{ok:!0,name:t}}"
    "if(t===`removeLocal`){let t=g(e,`userId`);"
    "if(t===`local`)throw Error(`400:No puedes retirar al responsable local.`)"
)

PATCHES = (
    ("crear finca con nombre de responsable", OLD_CREATE, NEW_CREATE),
    ("renombrar responsable local", OLD_REMOVE, NEW_REMOVE),
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
    for path in list(root.rglob("device-runtime*.js")) + list(root.glob("assets/device-runtime*.js")):
        if not path.is_file():
            continue
        applied = patch_file(path)
        if applied:
            changed.append((str(path), applied))
            missing.difference_update(applied)
    if missing:
        print("No se encontraron estos parches de runtime: " + ", ".join(sorted(missing)))
        return 1
    print("Runtime actualizado en:")
    for path, applied in changed:
        print("  ", path, "→", ", ".join(applied))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
