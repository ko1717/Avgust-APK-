#!/usr/bin/env python3
"""Ajusta el runtime local para fincas, responsables y borrado.

- Al crear una finca acepta `managerName` en lugar de fijar «Responsable local».
- Permite renombrar al responsable local con la operación `renameLocal`.
- Expone DELETE para visitas, versiones de informe y solicitudes.
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

OLD_CLEAR = (
    "clearDraft(){return this.db.prepare(`DELETE FROM drafts WHERE id = ?`)"
    ".run(`current`),this.save(),{ok:!0}}"
)
NEW_CLEAR = (
    "clearDraft(){return this.db.prepare(`DELETE FROM drafts WHERE id = ?`)"
    ".run(`current`),this.save(),{ok:!0}}"
    "deleteVisit(e){let t=typeof e==`string`?e:g(e,`id`,36);"
    "let n=this.db.prepare(`SELECT * FROM visits WHERE id = ?`).get(t);"
    "if(!n)throw Error(`404:Visita no encontrada.`);"
    "let r;try{r=JSON.parse(String(n.payload))}catch{r={}}"
    "let i=Array.isArray(r.photos)?r.photos.map(e=>e&&e.id).filter(Boolean):[];"
    "return this.transaction(()=>{"
    "let e=this.db.prepare(`SELECT id FROM report_versions WHERE visit_id = ?`).all(t);"
    "for(let n of e)this.db.prepare(`DELETE FROM report_events WHERE report_version_id = ?`).run(n.id);"
    "this.db.prepare(`DELETE FROM report_versions WHERE visit_id = ?`).run(t);"
    "this.db.prepare(`DELETE FROM visits WHERE id = ?`).run(t);"
    "for(let e of i)this.db.prepare(`DELETE FROM photos WHERE id = ?`).run(e)"
    "}),this.save(),{ok:!0,id:t}}"
    "deleteReport(e){let t=typeof e==`string`?e:g(e,`id`,36);"
    "let n=this.db.prepare(`SELECT * FROM report_versions WHERE id = ?`).get(t);"
    "if(!n)throw Error(`404:Versión de informe no encontrada.`);"
    "return this.transaction(()=>{"
    "this.db.prepare(`DELETE FROM report_events WHERE report_version_id = ?`).run(t);"
    "this.db.prepare(`DELETE FROM report_versions WHERE id = ?`).run(t)"
    "}),this.save(),{ok:!0,id:t}}"
    "deleteRequest(e){let t=typeof e==`string`?e:g(e,`id`,36);"
    "if(!this.db.prepare(`SELECT id FROM service_requests WHERE id = ?`).get(t))"
    "throw Error(`404:Solicitud no encontrada.`);"
    "return this.db.prepare(`DELETE FROM service_requests WHERE id = ?`).run(t),"
    "this.save(),{ok:!0,id:t}}"
)

OLD_DELETE_ROUTE = "if(i===`DELETE`&&r===`/api/draft`)return M(e.clearDraft());"
NEW_DELETE_ROUTE = (
    "if(i===`DELETE`){"
    "if(r===`/api/draft`)return M(e.clearDraft());"
    "if(r.startsWith(`/api/visits/`))return M(e.deleteVisit(r.slice(12).split(`?`)[0]));"
    "if(r.startsWith(`/api/reports/`))return M(e.deleteReport(r.slice(13).split(`?`)[0]));"
    "if(r.startsWith(`/api/requests/`))return M(e.deleteRequest(r.slice(14).split(`?`)[0]));"
    "}"
)

PATCHES = (
    ("crear finca con nombre de responsable", OLD_CREATE, NEW_CREATE),
    ("renombrar responsable local", OLD_REMOVE, NEW_REMOVE),
    ("borrar visitas informes y solicitudes", OLD_CLEAR, NEW_CLEAR),
    ("rutas DELETE de visitas informes y solicitudes", OLD_DELETE_ROUTE, NEW_DELETE_ROUTE),
)


def patch_file(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    applied = []
    for name, old, new in PATCHES:
        if old not in source:
            # Ya aplicado (el ancla antigua ya no existe y el resultado sí).
            if new in source or (name.startswith("borrar") and "deleteVisit(" in source):
                continue
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
        text = path.read_text(encoding="utf-8")
        already = set()
        if "deleteVisit(" in text and "deleteReport(" in text and "deleteRequest(" in text:
            already.update(
                {
                    "borrar visitas informes y solicitudes",
                    "rutas DELETE de visitas informes y solicitudes",
                }
            )
        if "renameLocal" in text:
            already.add("renombrar responsable local")
        if "managerName" in text:
            already.add("crear finca con nombre de responsable")
        applied = patch_file(path)
        if applied or already:
            changed.append((str(path), applied or sorted(already)))
            missing.difference_update(applied)
            missing.difference_update(already)
    if missing:
        print("No se encontraron estos parches de runtime: " + ", ".join(sorted(missing)))
        return 1
    print("Runtime actualizado en:")
    for path, applied in changed:
        print("  ", path, "→", ", ".join(applied))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
