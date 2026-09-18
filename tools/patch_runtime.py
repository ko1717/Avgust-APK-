#!/usr/bin/env python3
"""Ajusta el runtime local para fincas, responsables y borrado.

- Al crear una finca acepta `managerName` en lugar de fijar «Responsable local».
- Permite renombrar al responsable local con la operación `renameLocal`.
- Expone DELETE para visitas, versiones de informe, solicitudes y fincas.
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
DELETE_FARM_METHOD = (
    "deleteFarm(e){let t=typeof e==`string`?e:g(e,`id`,36);"
    "let n=this.db.prepare(`SELECT * FROM farms WHERE id = ?`).get(t);"
    "if(!n)throw Error(`404:Finca no encontrada.`);"
    "return this.transaction(()=>{"
    "let _fn=String(n.name||``).trim().toLowerCase();"
    "let e=this.db.prepare(`SELECT id,farm_id,payload FROM visits`).all().filter(v=>{"
    "if(v.farm_id===t)return!0;"
    "try{let p=JSON.parse(String(v.payload||`{}`));"
    "return p.farmId===t||String(p.farm||``).trim().toLowerCase()===_fn}catch{return!1}"
    "}).map(v=>({id:v.id}));"
    "for(let n of e){"
    "let r=this.db.prepare(`SELECT id FROM report_versions WHERE visit_id = ?`).all(n.id);"
    "for(let e of r)this.db.prepare(`DELETE FROM report_events WHERE report_version_id = ?`).run(e.id);"
    "this.db.prepare(`DELETE FROM report_versions WHERE visit_id = ?`).run(n.id);"
    "let i;try{i=JSON.parse(String(this.db.prepare(`SELECT payload FROM visits WHERE id = ?`).get(n.id)?.payload||`{}`))}catch{i={}}"
    "let a=Array.isArray(i.photos)?i.photos.map(e=>e&&e.id).filter(Boolean):[];"
    "this.db.prepare(`DELETE FROM visits WHERE id = ?`).run(n.id);"
    "for(let e of a)this.db.prepare(`DELETE FROM photos WHERE id = ?`).run(e)"
    "}"
    "let r=this.db.prepare(`SELECT id FROM report_versions WHERE farm_id = ?`).all(t);"
    "for(let e of r)this.db.prepare(`DELETE FROM report_events WHERE report_version_id = ?`).run(e.id);"
    "this.db.prepare(`DELETE FROM report_versions WHERE farm_id = ?`).run(t);"
    "this.db.prepare(`DELETE FROM report_events WHERE farm_id = ?`).run(t);"
    "this.db.prepare(`DELETE FROM service_requests WHERE farm_id = ?`).run(t);"
    "this.db.prepare(`DELETE FROM photos WHERE farm_id = ?`).run(t);"
    "this.db.prepare(`DELETE FROM farm_contacts WHERE farm_id = ?`).run(t);"
    "this.db.prepare(`DELETE FROM farm_members WHERE farm_id = ?`).run(t);"
    "this.db.prepare(`DELETE FROM farms WHERE id = ?`).run(t)"
    "}),this.save(),{ok:!0,id:t,name:n.name}}"
)
DELETE_METHODS = (
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
    + DELETE_FARM_METHOD
)
NEW_CLEAR = OLD_CLEAR + DELETE_METHODS

OLD_DELETE_ROUTE = "if(i===`DELETE`&&r===`/api/draft`)return M(e.clearDraft());"
NEW_DELETE_ROUTE = (
    "if(i===`DELETE`){"
    "if(r===`/api/draft`)return M(e.clearDraft());"
    "if(r.startsWith(`/api/visits/`))return M(e.deleteVisit(r.slice(12).split(`?`)[0]));"
    "if(r.startsWith(`/api/reports/`))return M(e.deleteReport(r.slice(13).split(`?`)[0]));"
    "if(r.startsWith(`/api/requests/`))return M(e.deleteRequest(r.slice(14).split(`?`)[0]));"
    "if(r.startsWith(`/api/farms/`))return M(e.deleteFarm(r.slice(11).split(/[/?]/)[0]));"
    "}"
)

# Prior builds already have visit/report/request DELETE without farms.
OLD_DELETE_ROUTE_PARTIAL = (
    "if(i===`DELETE`){"
    "if(r===`/api/draft`)return M(e.clearDraft());"
    "if(r.startsWith(`/api/visits/`))return M(e.deleteVisit(r.slice(12).split(`?`)[0]));"
    "if(r.startsWith(`/api/reports/`))return M(e.deleteReport(r.slice(13).split(`?`)[0]));"
    "if(r.startsWith(`/api/requests/`))return M(e.deleteRequest(r.slice(14).split(`?`)[0]));"
    "}"
)

REQUIRED = (
    "crear finca con nombre de responsable",
    "renombrar responsable local",
    "borrar visitas informes y solicitudes",
    "borrar finca",
    "rutas DELETE de visitas informes y solicitudes",
    "ruta DELETE de fincas",
)


def already_has(name: str, source: str) -> bool:
    if name == "crear finca con nombre de responsable":
        return "managerName" in source and OLD_CREATE not in source
    if name == "renombrar responsable local":
        return "renameLocal" in source
    if name == "borrar visitas informes y solicitudes":
        return "deleteVisit(" in source and "deleteReport(" in source and "deleteRequest(" in source
    if name == "borrar finca":
        return "deleteFarm(" in source
    if name == "borrar finca por nombre de visita":
        return "deleteFarm(" in source and "_fn=String(n.name" in source
    if name == "rutas DELETE de visitas informes y solicitudes":
        return "e.deleteVisit(" in source and "e.deleteReport(" in source and "e.deleteRequest(" in source
    if name == "ruta DELETE de fincas":
        return "e.deleteFarm(" in source and "/api/farms/" in source
    return False


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
        if already_has(name, source):
            continue
        if old not in source:
            continue
        source = source.replace(old, new, 1)
        applied.append(name)

    # Incremental: prior builds already have visit/report/request delete.
    if not already_has("borrar finca", source):
        if "deleteRequest(" in source and "deleteFarm(" not in source:
            marker = (
                "return this.db.prepare(`DELETE FROM service_requests WHERE id = ?`).run(t),"
                "this.save(),{ok:!0,id:t}}"
            )
            if marker in source:
                source = source.replace(marker, marker + DELETE_FARM_METHOD, 1)
                applied.append("borrar finca")
            elif "inspect(e,t){" in source:
                source = source.replace("inspect(e,t){", DELETE_FARM_METHOD + "inspect(e,t){", 1)
                applied.append("borrar finca")

    if not already_has("ruta DELETE de fincas", source):
        if OLD_DELETE_ROUTE_PARTIAL in source:
            source = source.replace(OLD_DELETE_ROUTE_PARTIAL, NEW_DELETE_ROUTE, 1)
            applied.append("ruta DELETE de fincas")
        elif (
            "e.deleteRequest(r.slice(14).split(`?`)[0]));" in source
            and "e.deleteFarm(" not in source
        ):
            source = source.replace(
                "if(r.startsWith(`/api/requests/`))return M(e.deleteRequest(r.slice(14).split(`?`)[0]));"
                "}",
                "if(r.startsWith(`/api/requests/`))return M(e.deleteRequest(r.slice(14).split(`?`)[0]));"
                "if(r.startsWith(`/api/farms/`))return M(e.deleteFarm(r.slice(11).split(/[/?]/)[0]));"
                "}",
                1,
            )
            applied.append("ruta DELETE de fincas")

    # Upgrade: borrar también visitas huérfanas que solo guardan el nombre de finca.
    if not already_has("borrar finca por nombre de visita", source) and "deleteFarm(" in source:
        old_select = "let e=this.db.prepare(`SELECT id FROM visits WHERE farm_id = ?`).all(t);"
        new_select = (
            "let _fn=String(n.name||``).trim().toLowerCase();"
            "let e=this.db.prepare(`SELECT id,farm_id,payload FROM visits`).all().filter(v=>{"
            "if(v.farm_id===t)return!0;"
            "try{let p=JSON.parse(String(v.payload||`{}`));"
            "return p.farmId===t||String(p.farm||``).trim().toLowerCase()===_fn}catch{return!1}"
            "}).map(v=>({id:v.id}));"
        )
        if old_select in source:
            source = source.replace(old_select, new_select, 1)
            applied.append("borrar finca por nombre de visita")

    if applied:
        path.write_text(source, encoding="utf-8")
    return applied


def runtime_paths(root: Path) -> list[Path]:
    found = []
    seen = set()
    for path in list(root.rglob("device-runtime*.js")) + list(root.glob("assets/device-runtime*.js")):
        if not path.is_file():
            continue
        key = str(path.resolve())
        if key in seen:
            continue
        seen.add(key)
        found.append(path)
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="directorio extraído del APK o de la vista previa")
    args = parser.parse_args()
    root = Path(args.root)
    changed = []
    missing = set(REQUIRED)
    for path in runtime_paths(root):
        applied = patch_file(path)
        text = path.read_text(encoding="utf-8")
        present = {name for name in REQUIRED if already_has(name, text)}
        if applied:
            changed.append((str(path), "aplicado", applied))
        elif present:
            changed.append((str(path), "ya estaba", sorted(present)))
        missing.difference_update(present)
    if missing:
        print("No se encontraron estos parches de runtime: " + ", ".join(sorted(missing)))
        return 1
    print("Runtime actualizado en:")
    for path, state, names in changed:
        print("  ", path, f"→ {state}:", ", ".join(names))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
