#!/usr/bin/env python3
"""Ajustes del informe final y del consolidado de aseguramientos.

- Sí / No → Sí cumple / No cumple (formulario, informe HTML, Word, métricas).
- Mediciones de Cap. 4 y 5 debajo del subcapítulo (4.6, 5.1, 5.3, 5.6).
- Mezcla final junto a Cap. 4.6 (calidad del agua).
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
]

# Trailing measurement blocks that patch_measurements may leave before relocation.
# Important: after the chapter `for` closes, the original continues as a comma
# expression (`xf.forEach(...),e.conclusion&&...`). When xf moves inside the
# loop we must drop that leading comma so `e.conclusion` starts a statement.
WORD_TRAILING_VARIANTS = [
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
]

WORD_MEASURE_NEW = (
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
)

# Tablas al final del capítulo (tras observaciones). Se mueven debajo del ítem.
WORD_CHAPTER_END = (
    "for(let n of t.items){let t=e.answers[n.id];"
    "s(`${n.id} · ${t?.value===`SI`?`Sí cumple`:t?.value===`NO`?`No cumple`:t?.value===`NA`?`No aplica`:`Sin evaluar`}`,Iv.HEADING_2),"
    "o(n.text),t?.observation&&o(`Hallazgo / observación: ${t.observation}`),"
    "t?.recommendation&&o(`Recomendación: ${t.recommendation}`)}"
    "e.notes[t.id]&&(s(`Observaciones del capítulo`,Iv.HEADING_2),o(e.notes[t.id])),"
    "e.recommendations[t.id]&&(s(`Recomendaciones del capítulo`,Iv.HEADING_2),o(e.recommendations[t.id]));"
    "let xf=[[4,`4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
    "[4,`4.6 Mezcla final`,[`mixPh`,`mixConductivity`]],"
    "[5,`5.1 Presión`,[`pressure`,`implementPressure`]],"
    "[5,`5.3 Equipo de aplicación`,[`equipment`,`implement`]],"
    "[5,`5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
    "xf.filter(([n])=>n===t.id).forEach(([,a,o])=>{let r=o.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
    "r.length&&(s(a,Iv.HEADING_2),c(r))})}"
)

WORD_UNDER_ITEM = (
    "let xf=[[`4.6`,`4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
    "[`4.6`,`4.6 Mezcla final`,[`mixPh`,`mixConductivity`]],"
    "[`5.1`,`5.1 Presión`,[`pressure`,`implementPressure`]],"
    "[`5.3`,`5.3 Equipo de aplicación`,[`equipment`,`implement`]],"
    "[`5.6`,`5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
    "for(let n of t.items){let a=e.answers[n.id];"
    "s(`${n.id} · ${a?.value===`SI`?`Sí cumple`:a?.value===`NO`?`No cumple`:a?.value===`NA`?`No aplica`:`Sin evaluar`}`,Iv.HEADING_2),"
    "o(n.text),a?.observation&&o(`Hallazgo / observación: ${a.observation}`),"
    "a?.recommendation&&o(`Recomendación: ${a.recommendation}`),"
    "xf.filter(([i])=>i===n.id).forEach(([,l,k])=>{let r=k.filter(t=>e.measurements[t]).map(t=>[kf[t],e.measurements[t]]);"
    "r.length&&(s(l,Iv.HEADING_2),c(r))})}"
    "e.notes[t.id]&&(s(`Observaciones del capítulo`,Iv.HEADING_2),o(e.notes[t.id])),"
    "e.recommendations[t.id]&&(s(`Recomendaciones del capítulo`,Iv.HEADING_2),o(e.recommendations[t.id]))}"
)

HTML_ITEM_OLD = (
    "t.items.map(t=>{let n=e.answers[t.id];return(0,K.jsxs)(`div`,{children:["
    "(0,K.jsxs)(`h3`,{children:[t.id,` · `,n?.value===`SI`?`Sí cumple`:n?.value===`NO`?`No cumple`:n?.value===`NA`?`No aplica`:`Sin evaluar`]}),"
    "(0,K.jsx)(`p`,{children:t.text}),"
    "n?.observation&&(0,K.jsxs)(`p`,{children:[(0,K.jsx)(`strong`,{children:`Hallazgo / observación: `}),n.observation]}),"
    "n?.recommendation&&(0,K.jsxs)(`p`,{children:[(0,K.jsx)(`strong`,{children:`Recomendación: `}),n.recommendation]})]},t.id)})"
)

HTML_ITEM_NEW = (
    "t.items.map(t=>{let n=e.answers[t.id],"
    "xf=[[`4.6`,`4.6 Calidad del agua`,[`ph`,`hardness`,`conductivity`]],"
    "[`4.6`,`4.6 Mezcla final`,[`mixPh`,`mixConductivity`]],"
    "[`5.1`,`5.1 Presión`,[`pressure`,`implementPressure`]],"
    "[`5.3`,`5.3 Equipo de aplicación`,[`equipment`,`implement`]],"
    "[`5.6`,`5.6 Volumen y tiempo por cama`,[`volume`,`time`]]];"
    "return(0,K.jsxs)(`div`,{children:["
    "(0,K.jsxs)(`h3`,{children:[t.id,` · `,n?.value===`SI`?`Sí cumple`:n?.value===`NO`?`No cumple`:n?.value===`NA`?`No aplica`:`Sin evaluar`]}),"
    "(0,K.jsx)(`p`,{children:t.text}),"
    "n?.observation&&(0,K.jsxs)(`p`,{children:[(0,K.jsx)(`strong`,{children:`Hallazgo / observación: `}),n.observation]}),"
    "n?.recommendation&&(0,K.jsxs)(`p`,{children:[(0,K.jsx)(`strong`,{children:`Recomendación: `}),n.recommendation]}),"
    "...xf.filter(([i,,k])=>i===t.id&&k.some(i=>e.measurements[i])).map(([i,a,o])=>(0,K.jsxs)(`div`,{className:`c360-report-inline-measures`,"
    "children:[(0,K.jsx)(`h3`,{children:a}),(0,K.jsx)(`table`,{children:(0,K.jsx)(`tbody`,{children:o.filter(i=>e.measurements[i]).map(i=>(0,K.jsxs)(`tr`,{children:[(0,K.jsx)(`th`,{children:kf[i]}),(0,K.jsx)(`td`,{children:e.measurements[i]})]},i))})})]},a))]},t.id)})"
)

HTML_DUMP_OLD = (
    "Object.values(e.measurements).some(Boolean)&&(0,K.jsxs)(K.Fragment,{children:["
    "(0,K.jsx)(`h2`,{children:`Mediciones de campo`}),"
    "(0,K.jsx)(`table`,{children:(0,K.jsx)(`tbody`,{children:Object.entries(kf).filter(([t])=>e.measurements[t]).map(([t,n])=>(0,K.jsxs)(`tr`,{children:[(0,K.jsx)(`th`,{children:n}),(0,K.jsx)(`td`,{children:e.measurements[t]})]},t))})})]})"
)

HTML_DUMP_KEYS = (
    "`ph`,`hardness`,`conductivity`,`mixPh`,`mixConductivity`,"
    "`pressure`,`implementPressure`,`equipment`,`implement`,`volume`,`time`"
)

HTML_DUMP_NEW = (
    "Object.entries(kf).filter(([t])=>e.measurements[t]&&!["
    + HTML_DUMP_KEYS
    + "].includes(t)).length&&(0,K.jsxs)(K.Fragment,{children:["
    "(0,K.jsx)(`h2`,{children:`Mediciones de campo`}),"
    "(0,K.jsx)(`table`,{children:(0,K.jsx)(`tbody`,{children:Object.entries(kf).filter(([t])=>e.measurements[t]&&!["
    + HTML_DUMP_KEYS
    + "].includes(t)).map(([t,n])=>(0,K.jsxs)(`tr`,{children:[(0,K.jsx)(`th`,{children:n}),(0,K.jsx)(`td`,{children:e.measurements[t]})]},t))})})]})"
)

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
        if new in source and old not in source:
            applied.append(f"{name} (ya estaba)")
            continue
        if old not in source:
            continue
        source = source.replace(old, new, 1)
        applied.append(name)
    return source, applied


def patch_file(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    applied: list[str] = []

    source, simple = apply_simple(source, INDEX_PATCHES)
    applied.extend(simple)

    if "xf.filter(([i])=>i===n.id)" not in source:
        if "xf.filter(([n])=>n===t.id)" not in source:
            relocated = False
            for old in WORD_TRAILING_VARIANTS:
                if old in source:
                    source = source.replace(old, WORD_MEASURE_NEW, 1)
                    applied.append("mediciones Word dentro del capítulo")
                    relocated = True
                    break
            if not relocated and "let xf=[[`Cap. 4 · 4.6 Calidad del agua`" in source:
                # Soft fail: leave for diagnostics
                pass
        if WORD_CHAPTER_END in source:
            source = source.replace(WORD_CHAPTER_END, WORD_UNDER_ITEM, 1)
            applied.append("mediciones Word debajo del subcapítulo")
        elif "xf.filter(([n])=>n===t.id)" in source:
            applied.append("mediciones Word dentro del capítulo (pendiente anclar al ítem)")
    else:
        applied.append("mediciones Word debajo del subcapítulo (ya estaba)")

    if "c360-report-inline-measures" not in source:
        if HTML_ITEM_OLD in source:
            source = source.replace(HTML_ITEM_OLD, HTML_ITEM_NEW, 1)
            applied.append("mediciones HTML debajo del subcapítulo")
        if HTML_DUMP_OLD in source:
            source = source.replace(HTML_DUMP_OLD, HTML_DUMP_NEW, 1)
            applied.append("ocultar dump HTML de mediciones ya ancladas")
    else:
        applied.append("mediciones HTML debajo del subcapítulo (ya estaba)")

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
