# Fase 3 — expediente técnico unificado de finca

Fecha: 2026-09-10

## Propósito y fuente de verdad

El expediente técnico es una vista agregada de una finca registrada. No crea tablas de copias para solicitudes, visitas, fotografías, informes, métricas ni compromisos.

| Información mostrada | Fuente existente |
| --- | --- |
| Finca, participantes y contactos | `farms`, `farm_members`, `farm_contacts` |
| Solicitudes | `service_requests.payload` |
| Visitas, informes y seguimiento | `visits.payload` |
| Fotografías | Referencias en `visits.payload` y metadatos de `photos` |
| Indicador y estado | Cálculo `metrics(Visit)` sobre una visita revisada |

Una visita revisada se muestra como **Informe técnico revisado**. El sistema no registra todavía la descarga de Word, impresión o envío de correo, por lo que el expediente no afirma que un informe fue generado o enviado en una fecha determinada. Las solicitudes se ordenan por su fecha propuesta o programada, porque su tabla aún no conserva una fecha de creación independiente.

## API y rendimiento

`GET /api/farms/:id/dossier` exige pertenencia vigente a la finca. Acepta `limit` de 1 a 50, `cursor`, `types` (`visit`, `request`, `report`, `photo`, `followup`) y el rango inclusivo `from` / `to` en formato `YYYY-MM-DD`.

La interfaz solicita 20 eventos por página. El cursor es opaco y continúa con una clave compuesta, sin usar `OFFSET`. La respuesta contiene el resumen operativo, una página de eventos y `nextCursor`; cada evento entrega datos de presentación y el identificador del registro de origen. `GET /api/visits/:id` vuelve a comprobar identidad y pertenencia antes de abrir una visita.

La migración `0004_farm_dossier_indexes.sql` agrega los índices `visits(farm_id, date)` y `photos(farm_id)`. Así, una finca con años de actividad no necesita cargar todo su historial para abrir el expediente ni escanear fotografías de otras fincas.

## Vista de usuario

La consulta web presenta finca, zona, participantes, nueva visita, última medición revisada, visitas, solicitudes abiertas, informes revisados y compromisos pendientes. La línea de tiempo tiene filtros por actividad y fechas, abre cada registro original y permite cargar actividad anterior.

La edición Windows conserva su consulta local existente. El expediente paginado se aplica a la modalidad web central, donde D1 aplica los permisos por finca y los índices de consulta.

## Cobertura comprobada

Las pruebas de permisos comprueban la página inicial y siguiente del cursor, filtro de informes, conteos, acceso de consulta y bloqueo 403 para un tercero. La integración HTTP local crea una finca y visita compartida, verifica el resumen, la página limitada y la apertura directa de la visita original.

No se probaron datos de producción, D1 remoto, R2 remoto ni una inspección visual interactiva automatizada: la herramienta de captura visual del entorno no pudo inicializarse. Las pruebas de compilación y las rutas HTTP locales sí pasaron.
