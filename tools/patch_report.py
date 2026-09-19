#!/usr/bin/env python3
"""Ajustes del informe final y del consolidado de aseguramientos.

- Sí / No → Sí cumple / No cumple (formulario, informe HTML, Word, métricas).
- Mediciones junto al ítem del capítulo en el Word (4.6, 5.1, 5.3, 5.6).
- Sin observaciones ni recomendaciones de capítulo en el informe.
- Ortografía de criterios y títulos del informe.
- Hallazgos por capítulo más detallados en el consolidado (UI y Word).
"""

from __future__ import annotations

import argparse
from pathlib import Path

INDEX_PATCHES: list[tuple[str, str, str]] = [
    (
        "radios del formulario",
        "[[`SI`,`Sí`],[`NO`,`No`],[`NA`,`No aplica`]]",
        "[[`SI`,`Sí cumple`],[`NO`,`No cumple`],[`NA`,`No aplica`]]",
    ),
    (
        "respuesta en informe Word",
        "t?.value===`SI`?`Sí`:t?.value===`NO`?`No`:t?.value===`NA`?`No aplica`:`Sin evaluar`",
        "t?.value===`SI`?`Sí cumple`:t?.value===`NO`?`No cumple`:t?.value===`NA`?`No aplica`:`Sin evaluar`",
    ),
    (
        "respuesta en informe HTML",
        "n?.value===`SI`?`Sí`:n?.value===`NO`?`No`:n?.value===`NA`?`No aplica`:`Sin evaluar`",
        "n?.value===`SI`?`Sí cumple`:n?.value===`NO`?`No cumple`:n?.value===`NA`?`No aplica`:`Sin evaluar`",
    ),
    (
        "respuesta en matriz de métricas",
        "answer:r.value===`SI`?`Sí`:r.value===`NO`?`No`:`No aplica`",
        "answer:r.value===`SI`?`Sí cumple`:r.value===`NO`?`No cumple`:`No aplica`",
    ),
    (
        "texto alcance Word",
        "${r.findings} respuestas “No” en los capítulos con cuestionario.",
        "${r.findings} respuestas “No cumple” en los capítulos con cuestionario.",
    ),
    (
        "texto alcance HTML",
        "r.findings,` respuestas “No” en los capítulos con cuestionario.`",
        "r.findings,` respuestas “No cumple” en los capítulos con cuestionario.`",
    ),
    (
        "priorización métricas",
        "Ordenados por número de respuestas “No”. La matriz Excel contiene el detalle completo por finca e informe.",
        "Ordenados por número de respuestas “No cumple”. Debajo, el detalle por capítulo con hallazgo y recomendación.",
    ),
    (
        "excel hallazgos No",
        "[`Hallazgos (respuestas No)`,String(e.findings)]",
        "[`Hallazgos (respuestas No cumple)`,String(e.findings)]",
    ),
    (
        "título capítulo 1",
        "title:`Almacén e inventarios de PPC`",
        "title:`Almacenamiento y manejo de inventario`",
    ),
    (
        "título capítulo 2",
        "title:`Medición y dosificación de PPC`",
        "title:`Mediciones y pesaje de PPC's`",
    ),
    (
        "título objetivos específicos",
        "title:`OBJETIVOS ESPECIFICOS`",
        "title:`OBJETIVOS ESPECÍFICOS`",
    ),
    (
        "título metodología",
        "title:`METODOLOGIA`",
        "title:`METODOLOGÍA`",
    ),
    (
        "nombre del programa en metodología",
        "programa AVGUST care 360 se realiza acorde con las necesidades y o peticiones",
        "programa AVGUST CARE 360 se realiza acorde con las necesidades y/o peticiones",
    ),
    (
        "criterio 3.3 vehículo",
        "en un vehiculo seguro y señalizado",
        "en un vehículo seguro y señalizado",
    ),
    (
        "criterio 3.4 vehículo",
        "El vehiculo de transporte interno cuenta",
        "El vehículo de transporte interno cuenta",
    ),
    (
        "criterio 4.1 almacén",
        "no se pesa en almacen,",
        "no se pesa en almacén,",
    ),
    (
        "criterio 4.4 están",
        "Los tanques de preparación estan debidamente aforados.",
        "Los tanques de preparación están debidamente aforados.",
    ),
    (
        "criterio 4.5 punto final",
        "homogeneidad de la mezcla al momento de la aplicación`}",
        "homogeneidad de la mezcla al momento de la aplicación.`}",
    ),
    (
        "criterio 4.6 calidad del agua",
        "La calidad del agua cuenta con los parametros adecuados para la aplicación (dureza <70ppm - pH: 5.5-6-5). **Es probable que se manejen por debajo de este estandar**",
        "La calidad del agua cuenta con los parámetros adecuados para la aplicación (dureza <70 ppm · pH 5.5–6.5). Es probable que se manejen por debajo de este estándar.",
    ),
    (
        "criterio 4.7 PPC",
        "la premezcla de los ppc´s.",
        "la premezcla de los PPC.",
    ),
    (
        "criterio 4.8 orden de mezcla",
        "coadyuvantes, solidos (polvos mojables, granulos dispersables, polvos solubles) y liquidos de mayor a menor densidad (suspensiones concentradas, concentrados emulsionables, liquidos solubles)",
        "coadyuvantes, sólidos (polvos mojables, gránulos dispersables, polvos solubles) y líquidos de mayor a menor densidad (suspensiones concentradas, concentrados emulsionables, líquidos solubles)",
    ),
    (
        "criterio 4.9 envases originales",
        "asegurando que los envases originles se perforen y se lleven a centro de acopio`",
        "asegurando que los envases originales se perforen y se lleven a centro de acopio.`",
    ),
    (
        "criterio 5.1 punto final",
        "presión de salida de la bomba al momento de la aplicación`}",
        "presión de salida de la bomba al momento de la aplicación.`}",
    ),
    (
        "criterio 5.3 implementos",
        "Los implemetos de aspersión se encuentran limpios, en buen estado y sin fugas o taponamientos  (bomba, mangueras, mangos filtros, boquillas, aguilones, lanzas etc.)",
        "Los implementos de aspersión se encuentran limpios, en buen estado y sin fugas o taponamientos (bomba, mangueras, mangos, filtros, boquillas, aguilones, lanzas, etc.).",
    ),
    (
        "criterio 5.5 EPP",
        "La cuadrilla de aplicadores cuentan con los epp's requeridos para la labor y se usan adecuadamente`",
        "La cuadrilla de aplicadores cuenta con los EPP requeridos para la labor y se usan adecuadamente.`",
    ),
    (
        "criterio 5.6 instrucciones",
        "Antes de comenzar la aplicación la cuadrilla recibe instrucciones respecto a la misma  (productos a aplicar, blancos biologicos, tiempo por cama, volumen y tecnica de aplicación).",
        "Antes de comenzar la aplicación, la cuadrilla recibe instrucciones respecto a la misma (productos a aplicar, blancos biológicos, tiempo por cama, volumen y técnica de aplicación).",
    ),
    (
        "criterio 5.7 técnica",
        "La tecnica de aplicación (tiempos por cama, direccionamiento de equipos, presión de salida, cubrimientos etc) esta acorde con lo programado.",
        "La técnica de aplicación (tiempos por cama, direccionamiento de equipos, presión de salida, cubrimientos, etc.) está acorde con lo programado.",
    ),
    (
        "criterio 5.8 área",
        "El area tratada esta cerrada y tiene tablero de identificación que contenga la información de los ppc's aplicados y horas de reingreso`",
        "El área tratada está cerrada y tiene tablero de identificación que contenga la información de los PPC aplicados y horas de reingreso.`",
    ),
    (
        "informe HTML sin notas de capítulo",
        ",e.notes[t.id]&&(0,K.jsxs)(K.Fragment,{children:[(0,K.jsx)(`h3`,{children:`Observaciones del capítulo`}),(0,K.jsx)(`p`,{children:e.notes[t.id]})]}),e.recommendations[t.id]&&(0,K.jsxs)(K.Fragment,{children:[(0,K.jsx)(`h3`,{children:`Recomendaciones del capítulo`}),(0,K.jsx)(`p`,{children:e.recommendations[t.id]})]})",
        "",
    ),
]

WORD_ITEM_LOOP = (
    "for(let n of t.items){let t=e.answers[n.id];"
    "s(`${n.id} · ${t?.value===`SI`?`Sí cumple`:t?.value===`NO`?`No cumple`:t?.value===`NA`?`No aplica`:`Sin evaluar`}`,Iv.HEADING_2),"
    "o(n.text),t?.observation&&o(`Hallazgo / observación: ${t.observation}`),"
    "t?.recommendation&&o(`Recomendación: ${t.recommendation}`)}"
)

WORD_ITEM_LOOP_NEW = (
    "let xf=[[`4.6`,`4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
    "[`4.6`,`4.6 Mezcla final`,[`mixPh`,`mixConductivity`]],"
    "[`5.1`,`5.1 Presión`,[`pressure`,`implementPressure`]],"
    "[`5.3`,`5.3 Equipo de aplicación`,[`equipment`,`implement`]],"
    "[`5.6`,`5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
    "for(let n of t.items){let t=e.answers[n.id];"
    "s(`${n.id} · ${t?.value===`SI`?`Sí cumple`:t?.value===`NO`?`No cumple`:t?.value===`NA`?`No aplica`:`Sin evaluar`}`,Iv.HEADING_2),"
    "o(n.text),t?.observation&&o(`Hallazgo / observación: ${t.observation}`),"
    "t?.recommendation&&o(`Recomendación: ${t.recommendation}`),"
    "xf.filter(([i])=>i===n.id).forEach(([,a,l])=>{let r=l.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
    "r.length&&(s(a,Iv.HEADING_2),c(r))})}"
)

# Blocks that follow the item loop: notes + leftover measurement dumps.
# Each one is replaced together with WORD_ITEM_LOOP so quality tables sit
# after 4.6 / 5.1 / 5.3 / 5.6 and chapter notes disappear from the Word.
WORD_AFTER_ITEM_VARIANTS = [
    (
        "e.notes[t.id]&&(s(`Observaciones del capítulo`,Iv.HEADING_2),o(e.notes[t.id])),"
        "e.recommendations[t.id]&&(s(`Recomendaciones del capítulo`,Iv.HEADING_2),o(e.recommendations[t.id]));"
        "let xf=[[4,`4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
        "[4,`4.6 Mezcla final`,[`mixPh`,`mixConductivity`]],"
        "[5,`5.1 Presión`,[`pressure`,`implementPressure`]],"
        "[5,`5.3 Equipo de aplicación`,[`equipment`,`implement`]],"
        "[5,`5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
        "xf.filter(([n])=>n===t.id).forEach(([,a,o])=>{let r=o.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
        "r.length&&(s(a,Iv.HEADING_2),c(r))})}"
        "e.conclusion&&"
    ),
    (
        "e.notes[t.id]&&(s(`Observaciones del capítulo`,Iv.HEADING_2),o(e.notes[t.id])),"
        "e.recommendations[t.id]&&(s(`Recomendaciones del capítulo`,Iv.HEADING_2),o(e.recommendations[t.id]))}"
        "let xf=[[`Cap. 4 · 4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
        "[`Cap. 4 · 4.10 Mezcla final`,[`mixPh`,`mixHardness`]],"
        "[`Cap. 5 · 5.1 Presión`,[`pressure`,`implementPressure`]],"
        "[`Cap. 5 · 5.3 Equipo de aplicación`,[`equipment`,`implement`]],"
        "[`Cap. 5 · 5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
        "xf.forEach(([t,n])=>{let r=n.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
        "r.length&&(s(t,Iv.HEADING_2),c(r))}),e.conclusion&&"
    ),
    (
        "e.notes[t.id]&&(s(`Observaciones del capítulo`,Iv.HEADING_2),o(e.notes[t.id])),"
        "e.recommendations[t.id]&&(s(`Recomendaciones del capítulo`,Iv.HEADING_2),o(e.recommendations[t.id]))}"
        "let xf=[[`Cap. 4 · 4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
        "[`Cap. 4 · 4.6 Mezcla final`,[`mixPh`,`mixConductivity`]],"
        "[`Cap. 5 · 5.1 Presión`,[`pressure`,`implementPressure`]],"
        "[`Cap. 5 · 5.3 Equipo de aplicación`,[`equipment`,`implement`]],"
        "[`Cap. 5 · 5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
        "xf.forEach(([t,n])=>{let r=n.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
        "r.length&&(s(t,Iv.HEADING_2),c(r))}),e.conclusion&&"
    ),
    (
        "e.notes[t.id]&&(s(`Observaciones del capítulo`,Iv.HEADING_2),o(e.notes[t.id])),"
        "e.recommendations[t.id]&&(s(`Recomendaciones del capítulo`,Iv.HEADING_2),o(e.recommendations[t.id]))}"
        "let xf=[[`Cap. 4 · 4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
        "[`Cap. 4 · 4.10 Mezcla final`,[`mixPh`,`mixConductivity`]],"
        "[`Cap. 5 · 5.1 Presión`,[`pressure`,`implementPressure`]],"
        "[`Cap. 5 · 5.3 Equipo de aplicación`,[`equipment`,`implement`]],"
        "[`Cap. 5 · 5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
        "xf.forEach(([t,n])=>{let r=n.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
        "r.length&&(s(t,Iv.HEADING_2),c(r))}),e.conclusion&&"
    ),
    (
        "e.notes[t.id]&&(s(`Observaciones del capítulo`,Iv.HEADING_2),o(e.notes[t.id])),"
        "e.recommendations[t.id]&&(s(`Recomendaciones del capítulo`,Iv.HEADING_2),o(e.recommendations[t.id]))}"
        "e.conclusion&&"
    ),
]

WORD_MEASURE_NEW = WORD_ITEM_LOOP_NEW + "}e.conclusion&&"

WORD_READY_MARK = "xf.filter(([i])=>i===n.id)"

K6_OLD = (
    "i(`Hallazgos por capítulo`),"
    "a([[`Capítulo`,`Hallazgos`,`Criterios aplicables`,`Indicador`,`Fincas`],..."
    "e.chapters.map(e=>[`${e.id}. ${e.title}`,String(e.findings),String(e.applicable),"
    "e.score===null?`Sin medición`:`${e.score}%`,String(e.farms)])]),"
    "i(`Ítems prioritarios`)"
)

K6_NEW = (
    "i(`Hallazgos por capítulo`),"
    "a([[`Capítulo`,`Hallazgos`,`Criterios aplicables`,`Indicador`,`Fincas`],..."
    "e.chapters.map(e=>[`${e.id}. ${e.title}`,String(e.findings),String(e.applicable),"
    "e.score===null?`Sin medición`:`${e.score}%`,String(e.farms)])]),"
    "e.chapters.forEach(t=>{let n=e.matrix.filter(e=>e.answer===`No cumple`&&e.chapter.startsWith(`${t.id}.`));"
    "n.length&&(i(`${t.id}. ${t.title} · detalle`),a([[`Finca`,`Fecha`,`Ítem`,`Criterio`,`Hallazgo / observación`,`Recomendación`],"
    "...n.map(e=>[e.farm,e.date,e.item,e.text,e.observation||`—`,e.recommendation||`—`])]));}),"
    "i(`Ítems prioritarios`)"
)

UI_OLD = (
    "(0,K.jsx)(`div`,{className:`eyebrow`,children:`PRIORIZACIÓN`}),"
    "(0,K.jsx)(`h3`,{children:`Ítems con más inconvenientes`})"
)

UI_NEW = (
    "(0,K.jsx)(`div`,{className:`eyebrow`,children:`HALLAZGOS DETALLADOS`}),"
    "(0,K.jsx)(`h3`,{children:`Hallazgos por capítulo · detalle`}),"
    "(0,K.jsx)(`p`,{className:`muted`,children:`Cada “No cumple” con su finca, criterio, observación y recomendación.`}),"
    "(0,K.jsx)(`div`,{className:`c360-metric-findings`,children:u.chapters.filter(e=>e.findings>0).map(t=>(0,K.jsxs)(`section`,{className:`c360-metric-finding-chapter`,children:[(0,K.jsxs)(`h4`,{children:[t.id,`. `,t.title,` · `,t.findings,` hallazgo`,t.findings===1?``:`s`,` · indicador `,t.score===null?`—`:`${t.score}%`]}),(0,K.jsx)(`div`,{className:`table-scroll`,children:(0,K.jsxs)(`table`,{className:`followup-table metric-table`,children:[(0,K.jsx)(`thead`,{children:(0,K.jsxs)(`tr`,{children:[(0,K.jsx)(`th`,{children:`Finca`}),(0,K.jsx)(`th`,{children:`Fecha`}),(0,K.jsx)(`th`,{children:`Ítem`}),(0,K.jsx)(`th`,{children:`Criterio`}),(0,K.jsx)(`th`,{children:`Hallazgo`}),(0,K.jsx)(`th`,{children:`Recomendación`})]})}),(0,K.jsx)(`tbody`,{children:u.matrix.filter(e=>e.answer===`No cumple`&&e.chapter.startsWith(`${t.id}.`)).map((e,n)=>(0,K.jsxs)(`tr`,{children:[(0,K.jsx)(`td`,{children:e.farm}),(0,K.jsx)(`td`,{children:e.date}),(0,K.jsx)(`td`,{children:(0,K.jsx)(`strong`,{children:e.item})}),(0,K.jsx)(`td`,{children:e.text}),(0,K.jsx)(`td`,{children:e.observation||`—`}),(0,K.jsx)(`td`,{children:e.recommendation||`—`})]},`${e.farm}-${e.date}-${e.item}-${n}`))})]})})]},t.id))}),"
    "(0,K.jsx)(`div`,{className:`eyebrow`,children:`PRIORIZACIÓN`}),"
    "(0,K.jsx)(`h3`,{children:`Ítems con más inconvenientes`})"
)


def apply_simple(source: str, patches: list[tuple[str, str, str]]) -> tuple[str, list[str]]:
    applied = []
    for name, old, new in patches:
        if old in source:
            source = source.replace(old, new, 1)
            applied.append(name)
            continue
        if new and new in source:
            applied.append(f"{name} (ya estaba)")
    return source, applied


def patch_file(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    applied: list[str] = []

    source, simple = apply_simple(source, INDEX_PATCHES)
    applied.extend(simple)

    if WORD_READY_MARK not in source:
        relocated = False
        for tail in WORD_AFTER_ITEM_VARIANTS:
            old = WORD_ITEM_LOOP + tail
            if old in source:
                source = source.replace(old, WORD_MEASURE_NEW, 1)
                applied.append("mediciones Word junto al ítem")
                relocated = True
                break
        if not relocated and "let xf=[[`Cap. 4 · 4.6 Calidad del agua`" in source:
            pass
    else:
        applied.append("mediciones Word junto al ítem (ya estaba)")

    if "Hallazgos por capítulo · detalle" not in source and "${t.id}. ${t.title} · detalle" not in source:
        if K6_OLD in source:
            source = source.replace(K6_OLD, K6_NEW, 1)
            applied.append("detalle hallazgos Word consolidado")
    else:
        applied.append("detalle hallazgos Word consolidado (ya estaba)")

    if "c360-metric-findings" not in source:
        if UI_OLD in source:
            source = source.replace(UI_OLD, UI_NEW, 1)
            applied.append("detalle hallazgos en métricas UI")
    else:
        applied.append("detalle hallazgos en métricas UI (ya estaba)")

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
    seen: set[str] = set()
    for path in list(root.rglob("index-*.js")) + list(root.glob("assets/*.js")):
        if not path.is_file():
            continue
        if "device-runtime" in path.name:
            continue
        key = str(path.resolve())
        if key in seen:
            continue
        seen.add(key)
        applied = patch_file(path)
        if applied:
            changed.append((str(path), applied))
    if not changed:
        print("No se aplicaron parches de informe")
        return 1
    print("Informe y consolidado actualizados en:")
    for path, applied in changed:
        print("  ", path, "→", ", ".join(applied))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
