# Mapa de migración source-first — AVGUST CARE 360

## Estado

El proyecto fuente original fue recuperado desde `D:\WILSON\avgust-care` e integrado en este repositorio. Corresponde a AVGUST CARE 360 1.5.35 e incluye web, Electron/Windows, Capacitor/Android, modelo de datos, migraciones y pruebas.

La recuperación de la fuente no equivale a certificar una nueva release. Los builds web, Windows y Android debug y las pruebas principales ya pasan. La evolución por finca y su exportación Word muestran el puntaje ponderado heredado solo como complemento; el porcentaje oficial de 1.5.35 no cambia.

## Componentes identificados

| Componente actual | Función | Destino |
|---|---|---|
| `app/`, `components/` | Interfaz y funciones web recuperadas | Fuente activa |
| `lib/model.ts`, `lib/validate.ts` | Modelo de visitas, catálogo y validación | Fuente activa; conservar el contrato existente |
| `lib/metric-analysis.ts`, `app/metrics-panel.tsx` | Métricas por finca y consolidado | Fuente activa |
| `android/`, `desktop/` | Adaptadores nativos y edición Windows | Fuente activa; validar builds localmente |
| `public/enhance/*` | Capa de experiencia que carga la aplicación fuente | Integrada desde el proyecto 1.5.35 |
| `enhance/src/*` | Mejoras de la antigua APK y Centro de Inteligencia MIPE | Preservada para auditoría y migración selectiva; no copiar a ciegas sobre `public/enhance` |
| `migration/source-core/*` | Scoring y KPIs gerenciales puros con pruebas | Núcleo de referencia; falta evaluar su integración tipada con `lib/` |
| `tools/patch_*.py`, `tools/build-apk.sh`, APK seed | Pipeline histórico basado en bundle | Solo compatibilidad/referencia; no usar como build principal |

## Arquitectura integrada

```
app/
components/
lib/
db/ drizzle/
android/
desktop/
public/
tests/
```

## Reglas de migración

1. No copiar el bundle minificado como si fuera fuente original.
2. Migrar primero lógica determinista y testeable: catálogo MIPE, scoring, estados y validaciones.
3. Separar presentación de cálculo.
4. El cálculo MIPE debe tener pruebas unitarias independientes del DOM.
5. La capa móvil no debe depender de selectores CSS de una aplicación compilada.
6. La persistencia offline debe tener un adaptador explícito.
7. La API/Firebase debe consumirse mediante servicios tipados, no desde componentes.
8. El indicador oficial conserva la fórmula 1.5.35; las ponderaciones por capítulo del dashboard anterior se muestran solo como análisis complementario y nunca lo reemplazan.
9. El build Android final no debe extraer `capacitor-seed.apk`.

## Auditoría de funciones de GitHub

La rama `main` de GitHub aporta mejoras históricas en `enhance/src/*`. Se compararon con la app React/TypeScript source-first para integrar capacidades, no scripts que parchean el DOM del bundle.

| Función anterior | Decisión | Estado en la app fuente |
|---|---|---|
| Comparación/benchmark de fincas | Adoptar con salvaguardas | El consolidado compara el último informe revisado por finca y solo agrupa iguales capítulos evaluados; usa el porcentaje oficial 1.5.35, marca empates y excluye fincas con varias visitas en su fecha más reciente. |
| Búsqueda y filtros de visitas | Adoptar | La lista permite buscar finca, responsable o fecha, filtrar borradores/revisados y paginar 8 resultados por página. |
| Progreso y siguiente criterio pendiente de la visita | Adoptar, respetando validaciones fuente | El editor muestra el avance sobre los criterios seleccionados y permite saltar a la primera respuesta pendiente o incompleta. La evidencia fotográfica sigue siendo opcional según la validación actual. |
| Resumen MIPE, tendencias e indicadores gerenciales | Conservar lo compatible | Evolución por finca, tendencia, alertas, consolidado, capítulos, criterios y ponderado complementario ya están en componentes tipados. No trasladar el score ponderado antiguo como fórmula oficial. |
| Seguimiento, prioridades y evidencia | Ya cubierto | Compromisos con responsables, fechas, estados, cierre, evidencia antes/después e historial están implementados. El consolidado prioriza criterios por frecuencia. |
| Guardado, borradores, modo oscuro y navegación de campo | Ya cubierto o nativo | La app tiene guardado manual, borrador automático en Windows, cambios pendientes, modo oscuro y navegación/adaptadores nativos. Evitar overlays duplicados basados en selectores del bundle. |
| Importación histórica de matrices | Ya cubierto | La app fuente tiene importación validada de la matriz técnica y exportación Excel/CSV/Word. |
| Importar archivos arbitrarios DOCX/PDF/CSV del parche heredado | No portar por ahora | El parser fue diseñado para el formato/bundle anterior; antes de migrarlo hace falta definir formatos aceptados y comprobar que el contenido se valida y se puede reconciliar sin campos actuales como lote/cultivo. |
| Modo sin marca CARE 360 y métricas en lote/cultivo del código heredado | Descartar de la experiencia AVGUST | Duplica identidad y/o depende de datos que el modelo fuente actual no contiene. |

## Siguiente trabajo

1. Resolver las 18 vulnerabilidades de dependencias de producción con actualizaciones compatibles y pruebas, sin aplicar `npm audit fix --force`.
2. Corregir los errores restantes de lint y definir qué pruebas E2E antiguas siguen siendo aplicables a la app fuente.
3. Comparar el comportamiento con la APK 1.5.32 y verificar firma/versionCode antes de publicar.

## Criterio de aceptación

El proyecto fuente está integrado. La migración de release no se considera terminada hasta demostrar una instalación limpia, builds reproducibles, pruebas aprobadas y paridad funcional con 1.5.32. `tools/build-apk.sh` permanece fuera de la ruta principal.
