# Fase 6 — métricas históricas y comparación entre visitas

## Propósito y fuente

La visita revisada continúa siendo la única fuente operativa. No se creó una tabla de métricas ni una migración. Cada punto conserva `farm_id`, `visit_id`, fecha real, responsable, valor original y valor numérico cuando existe.

`report_versions` conserva capturas documentales para leer o exportar un informe formal. Nunca participa en el historial operativo ni agrega puntos duplicados.

## Catálogo central

`lib/metric-definitions.ts` concentra el identificador, etiqueta, tipo, unidad, precisión, tolerancia y posibilidad de graficar.

| ID | Tipo | Unidad | Precisión | Gráfica |
| --- | --- | --- | --- | --- |
| `compliance` | numérico | % | 0 | Sí |
| `ph` | numérico | pH | 2 | Sí |
| `hardness` | numérico | ppm | 0 | Sí |
| `pressure` | numérico | PSI | 1 | Sí |
| `volume` | numérico | L | 2 | Sí |
| `time` | numérico | s | 2 | Sí |
| `equipment` | textual | — | — | No |

El cumplimiento se reconstruye con las respuestas aplicables de la visita, nunca desde un informe publicado. Las demás lecturas salen de `measurements`.

Una lectura numérica debe ser el valor decimal completo, por ejemplo `6.2` o `6,2`. Se conserva el texto original y se rechazan para cálculo valores como `aprox. diez` o `30 PSI`. No hay conversiones implícitas entre unidades.

La tolerancia inicial es `0` para todas las métricas: solo un valor igual al almacenado, después del redondeo central, se declara estable. Es una regla conservadora de presentación, no una regla agronómica.

## Historial y tendencia

`GET /api/farms/:id/metrics?metric=<id>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>&limit=<1..100>&cursor=<cursor>` valida identidad y acceso de lectura por finca antes de leer visitas revisadas. Ordena de forma determinista por `date` e `id`; el cursor avanza hacia registros anteriores. La respuesta entrega solo los puntos de la métrica solicitada, no todas las visitas al navegador.

La gráfica usa segmentos lineales entre observaciones reales, sin spline, suavizado, interpolación ni puntos estimados. La tabla conserva fecha, valor original, unidad, responsable y acceso a la visita de origen.

La tendencia es descriptiva: requiere al menos tres observaciones válidas y compara la primera con la última del tramo cargado. Sus únicos resultados son `increasing`, `decreasing`, `stable` e `insufficient_data`, presentados como aumentó, disminuyó, estable o datos insuficientes. No se usan términos favorables o desfavorables y no hay inferencia causal.

## Comparación

`POST /api/farms/:id/metrics/compare` recibe dos `visitId`, exige que ambas pertenezcan a la misma finca, que sean revisadas y que el usuario tenga acceso. Devuelve solo métricas presentes en ambas visitas.

- Para números se entrega diferencia absoluta y estado neutral.
- Para cumplimiento la diferencia se expresa en puntos porcentuales. La variación relativa se calcula como `((actual - anterior) / abs(anterior)) * 100` únicamente si el valor anterior no es cero.
- Para un valor anterior cero se devuelve `No aplica` para la variación relativa.
- Para texto se informa `Sin cambios` o `Texto distinto`; no hay gráfica, porcentaje ni tendencia.
- Las unidades distintas se rechazan como no comparables. No se convierten PSI, bar u otras unidades automáticamente.

## Experiencia y permisos

La sección **Evolución** se muestra dentro de `Consulta de finca`: selector de métrica, rango de fechas, resumen compacto, gráfica, tabla, apertura de visita y comparación. Se comparte con la consulta local de Windows.

En web, `viewer`, `editor` y `manager` pueden consultar solo fincas autorizadas. Las rutas no generan eventos de auditoría por lectura. Windows usa SQLite local y el mismo catálogo generado, con `Responsable local`; no sincroniza con D1 ni R2.

## Rendimiento y límites

El índice existente `(farm_id, date)` se reutiliza en web. Las métricas siguen dentro del JSON de visitas porque la consulta se pagina por finca y fecha; no se materializó una estructura secundaria sin una medición que lo justifique.

La prueba de integración de roles sembró 180 visitas y consultó una página de 30 puntos en 1 ms en SQLite en memoria. Es una medición local controlada, no una promesa de latencia para D1 remoto. Si una finca real presenta lentitud, se medirá ese caso antes de considerar un índice o una materialización adicional.

La revisión visual automatizada se intentó el 13 de septiembre de 2026. La aplicación local cargó hasta su pantalla de autenticación; la evolución requiere una sesión y la automatización no inicia sesión en nombre de una persona. Por tanto, no se declara una revisión visual autenticada de escritorio, tablet o móvil en este corte.

## Verificación

- `npx tsc --noEmit`
- `npm run lint`
- `node tests/model.mjs`
- `node tests/team.mjs`
- `pwsh -NoProfile -File tests/integration.ps1`
- `npm run desktop:test`
- `npm run build`
- `npm run test:backup`

Las pruebas cubren orden, cursor, rango, lectura numérica y textual, nulos, cero, porcentajes, estabilidad, tendencia, comparación A/B, métricas ausentes, acceso de viewer, bloqueo de otra finca, gráfico lineal y Windows local.
