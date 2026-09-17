# Informes demo importables — Finca San Isidro

Archivos listos para Kevin: **CSV** que acepta CARE 360 en **Fincas → Importar finca e informes**.

> El importador de la app procesa CSV de forma directa y fiable. Excel `.xlsx` se redirige al importador nativo de matriz (menos predecible). Word/PDF también se aceptan, pero el CSV es la vía recomendada.

## Dónde están los archivos

Carpeta: `tools/demo-informes/`

| Archivo | Contenido |
| --- | --- |
| **`finca-san-isidro_4-informes.csv`** | Los **4 informes en un solo archivo** (recomendado: una sola importación) |
| `2025-10-08_finca-san-isidro.csv` | Visita 1 — Ana Ruiz — indicador ~40% |
| `2025-12-17_finca-san-isidro.csv` | Visita 2 — Wilson Castro — ~60% |
| `2026-03-11_finca-san-isidro.csv` | Visita 3 — Ana Ruiz — ~90% |
| `2026-06-25_finca-san-isidro.csv` | Visita 4 — Luis Pérez — ~70% |

Formato: CSV con columnas `finca`, `fecha`, `capitulo`, `item`, `respuesta`, `responsable avgust`, `hallazgo observacion`, `recomendacion`. Fechas `AAAA-MM-DD`. Respuestas `Sí cumple` / `No cumple` / `No aplica`. Cada visita incluye la **matriz completa** de criterios CARE 360 (ítems no evaluados van como No aplica).

## Cómo importarlos en la app

1. Abre CARE 360 (APK o preview).
2. Ve a la pestaña **Fincas**.
3. Abre **Importar finca e informes**.
4. Pulsa **Elegir archivo** y selecciona:
   - `finca-san-isidro_4-informes.csv` (los 4 de una vez), **o**
   - cada CSV individual, uno tras otro.
5. Revisa la vista previa (“X aseguramiento(s) listos”) y pulsa **Importar finca e informes**.
6. La app crea **Finca San Isidro** si no existe y guarda los informes en Visitas.

Si un informe con la misma finca + fecha ya existe, esa visita se omite.

## Resultado esperado

| Fecha | Responsable | Indicador | Hallazgos (No cumple) |
| --- | --- | --- | --- |
| 2025-10-08 | Ana Ruiz | ~40% | 6 |
| 2025-12-17 | Wilson Castro | ~60% | 4 |
| 2026-03-11 | Ana Ruiz | ~90% | 1 |
| 2026-06-25 | Luis Pérez | ~70% | 3 |

En **Métricas → Por finca → Finca San Isidro → Todo**: gráfica de Evolución 40→60→90→70 (mejora fuerte y leve caída).

## Regenerar desde la semilla

```bash
node tools/demo-informes/generate.mjs
```

Fuente de datos: `tools/metrics-demo-4-informes/visits.json`.
