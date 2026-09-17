# Demo: 4 informes en Métricas

Semilla reutilizable para ver **Evolución**, **capítulos** y **hallazgos** con 4 puntos claros.

## Historia en gráfica (Finca San Isidro)

| Fecha | Responsable | Indicador | Hallazgos (NO cumple) |
| --- | --- | --- | --- |
| 2025-10-08 | Ana Ruiz | 40% | 6 |
| 2025-12-17 | Wilson Castro | 60% | 4 |
| 2026-03-11 | Ana Ruiz | 90% | 1 |
| 2026-06-25 | Luis Pérez | 70% | 3 |

Trayectoria: mejora fuerte (40→90) y leve caída en junio (−20 pts), para poblar «Qué atender».

## Opción C — Importar CSV en la app (sin script)

Archivos listos para **Fincas → Importar finca e informes**:

→ **`tools/demo-informes/`** (CSV combinado + 4 individuales + README en español)

```bash
# regenerar desde visits.json
node tools/demo-informes/generate.mjs
```

## Opción A — Preview real (IndexedDB / `/api/visits`)

Con la vista previa sirviendo en el puerto 8080:

```bash
CARE360_URL=http://127.0.0.1:8080/index.html node tools/seed-4-informes.mjs
```

El script borra visitas previas de San Isidro, importa las 4 con `C360Import.saveVisits` y guarda capturas en `/opt/cursor/artifacts/`.

Luego en la app: **Métricas → Por finca → Finca San Isidro → Todo**.

## Opción B — Demo estática (mock de `/api/visits`)

```bash
# desde la raíz del repo, copiar enhance + index y servir
mkdir -p /tmp/c360-4-informes-demo/enhance
cp tools/metrics-demo-4-informes/index.html /tmp/c360-4-informes-demo/
cp enhance/src/care360-enhance.css enhance/src/care360-metrics.js /tmp/c360-4-informes-demo/enhance/
cd /tmp/c360-4-informes-demo && python3 -m http.server 8765
# abrir http://127.0.0.1:8765/
```

Datos: `visits.json`. Captura rápida: `node tools/metrics-demo-4-informes/capture.mjs`.
