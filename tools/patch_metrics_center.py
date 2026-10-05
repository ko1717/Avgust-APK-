#!/usr/bin/env python3
"""Patch React bundle to render the professional Centro de Inteligencia MIPE metrics board."""

import sys
import re
from pathlib import Path

def patch_index(dist_dir: Path):
    assets_dir = dist_dir / "assets"
    index_files = list(assets_dir.glob("index-*.js"))
    if not index_files:
        print("No index-*.js found in", assets_dir)
        return False

    index_file = index_files[0]
    print(f"Patching {index_file} for Professional MIPE Intelligence Metrics...")
    code = index_file.read_text(encoding="utf-8")

    # 1. Update tab label to Métricas
    old_tab = "{id:`metrics`,label:`Métricas`,short:`Métricas`,icon:R,description:`Consulta indicadores, estados y evolución.`}"
    new_tab = "{id:`metrics`,label:`Métricas`,short:`Métricas`,icon:R,description:`Indicadores de aseguramiento, ponderación MIPE y evolución por finca.`}"
    if old_tab in code:
        code = code.replace(old_tab, new_tab)
        print("✓ Tab updated to Métricas")

    # 2. Replace K6 so that it renders the high-performance container for the metrics board
    clean_k6_target = "function K6(e){let[t,n]=(0,T.useState)(`farm`);return(0,K.jsxs)(`section`,{className:`metrics-area`,children:[(0,K.jsxs)(`div`,{className:`metric-view-switch no-print`,role:`tablist`,\"aria-label\":`Tipo de métricas`,children:[(0,K.jsx)(`button`,{role:`tab`,\"aria-selected\":t===`farm`,className:t===`farm`?`active`:``,onClick:()=>n(`farm`),children:`Por finca`}),(0,K.jsx)(`button`,{role:`tab`,\"aria-selected\":t===`consolidated`,className:t===`consolidated`?`active`:``,onClick:()=>n(`consolidated`),children:`Consolidado de aseguramientos`})]}),t===`farm`?(0,K.jsx)(G6,{visits:e.visits,loading:e.loading,onOpen:e.onOpen}):(0,K.jsx)(H6,{visits:e.visits,loading:e.loading,onImport:e.onImport})]})}";
    new_k6 = "function K6(e){try{if(window.Care360Metrics&&typeof window.Care360Metrics.setVisits===`function`){window.Care360Metrics.setVisits(e.visits);}else{window.__c360_visits=e.visits;}}catch(err){}return(0,K.jsx)(`section`,{className:`metrics-area`,children:(0,K.jsx)(`div`,{id:`c360-metrics-board`,className:`c360-metrics-board`})})}"
    if clean_k6_target in code:
        code = code.replace(clean_k6_target, new_k6)
        print("✓ K6 component replaced with metrics board container")
    else:
        m = re.search(r"function K6\(e\)\{[\s\S]*?t===`farm`\?\(0,K\.jsx\)\(G6[\s\S]*?\)\:\(0,K\.jsx\)\(H6[\s\S]*?\}\)\}\)", code)
        if m:
            code = code[:m.start()] + new_k6 + code[m.end():]
            print("✓ K6 component replaced with regex match")

    # 3. Hide old module heading when on metrics tab (our dashboard provides an authoritative header)
    old_page_heading = "(0,K.jsxs)(`div`,{className:`page-heading module-heading`"
    new_page_heading = "(0,K.jsxs)(`div`,{className:`page-heading module-heading` + (o===`metrics`?` hide-for-mipe-board`:``)"
    if old_page_heading in code:
        code = code.replace(old_page_heading, new_page_heading, 1)
        print("✓ Page heading hidden on metrics tab")

    index_file.write_text(code, encoding="utf-8")
    print("✓ Successfully saved patched index file.")
    return True

if __name__ == "__main__":
    dist = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("dist")
    patch_index(dist)
