# Demos e importables

Todo lo de ejemplo vive aquí (CSV, Word, métricas y scripts de captura).

## Word real con fotos

| Archivo | Contenido |
| --- | --- |
| **`CARE-360-Comercializadora-Tucan-2026-09-10.docx`** | Informe real: Comercializadora Tucán · 2026-09-10 · 4 fotos, plan y mediciones |

**Importar:** Fincas → Importar finca e informes → elige el `.docx`.

## CSV — Finca San Isidro (4 visitas)

| Archivo | Uso |
| --- | --- |
| **`finca-san-isidro_4-informes.csv`** | Los 4 informes en un archivo |
| `2025-*-finca-san-isidro.csv` | Visitas individuales (~40% → 90% → 70%) |

```bash
# regenerar CSV desde metrics/visits.json
node tools/demo/generate.mjs
```

## Métricas (demo estática)

Carpeta `metrics/`: `visits.json`, `index.html` y captura rápida.

```bash
CARE360_URL=http://127.0.0.1:8080/index.html node tools/demo/seed-4-informes.mjs
```
