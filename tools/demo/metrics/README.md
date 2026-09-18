# Demo estática de métricas (4 informes)

Semilla para ver Evolución, capítulos y hallazgos.

| Fecha | Indicador | Hallazgos |
| --- | --- | --- |
| 2025-10-08 | 40% | 6 |
| 2025-12-17 | 60% | 4 |
| 2026-03-11 | 90% | 1 |
| 2026-06-25 | 70% | 3 |

CSV importables y scripts de siembra: carpeta padre `tools/demo/`.

```bash
# demo estática
mkdir -p /tmp/c360-demo/enhance
cp tools/demo/metrics/index.html /tmp/c360-demo/
cp enhance/src/care360-enhance.css enhance/src/care360-metrics.js /tmp/c360-demo/enhance/
cd /tmp/c360-demo && python3 -m http.server 8765
```
