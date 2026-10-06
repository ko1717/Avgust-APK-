# Fase 5 — Ciclo de vida y versionado de informes

## Regla de fuente de verdad

`visits` sigue siendo la fuente técnica de AVGUST CARE 360. Sus respuestas, métricas derivadas, recomendaciones, compromisos, solicitudes y referencias de fotos no se copian a tablas operativas nuevas.

`report_versions` solo registra el historial documental de un informe. Al pasar de borrador a revisión guarda una captura editorial inmutable: datos visibles de la finca, responsables y participantes, fecha, capítulos y textos, respuestas, mediciones, recomendaciones, compromisos, indicador y referencias de fotografías. No guarda bytes de imágenes ni objetos R2. Las fotografías no tienen una ruta de borrado actual, por lo que sus identificadores se mantienen como referencias estables mientras exista la finca.

## Estados y permisos

| Estado | Quién puede cambiarlo | Regla |
| --- | --- | --- |
| `draft` | manager o editor | Se crea solo desde una visita de finca con revisión técnica completa. Sigue apuntando a la visita actual. |
| `in_review` | manager o editor al enviar | Congela la captura y la revisión de origen. |
| `approved` | manager | Requiere que la visita no haya cambiado desde el envío. |
| `published` | manager | Conserva la captura aprobada y no tiene transición de regreso. |

Un `viewer` puede consultar y exportar las versiones disponibles, pero no crea ni modifica estados. Si la fuente cambia después del envío, la aprobación responde con conflicto y coordinación debe devolver la versión a borrador para enviarla de nuevo. Después de publicar, una nueva presentación crea `v2`; `v1` no se modifica.

La marca histórica `reviewed=true` no cambió de significado: confirma que la visita está técnicamente completa para preparar un informe. No significa aprobación, publicación, envío por correo, impresión ni descarga. Las exportaciones siguen siendo locales en el cliente; el servidor no registra acciones que no puede comprobar.

## Auditoría y expediente

Los eventos `report_draft_created`, `report_version_created`, `report_submitted`, `report_returned`, `report_approved` y `report_published` se escriben en `audit_events` con identificadores y estado/versiones, sin snapshot, contactos, textos técnicos, fotografías ni códigos de invitación.

El expediente de finca muestra los informes formales desde `report_versions`. Una visita antigua que tenga `reviewed=true` y no tenga versión conserva el rótulo **Informe técnico revisado (registro anterior)**. El expediente sigue paginado y no es una tabla paralela.

## Windows local

La edición local usa las mismas transiciones en SQLite y registra el actor como `Responsable local`. Las tablas `report_versions` y `report_events` quedan dentro del respaldo `.care360`; no hay sincronización automática con el servicio web.

## Verificación

Las pruebas de equipo cubren creación, envío, captura sin binarios, cambio de visita posterior, retorno, aprobación, publicación, v2, lectura de viewer, rechazo de editor al aprobar y eventos de auditoría. `tests/desktop-store.cjs` cubre el equivalente local y su restauración desde respaldo.

La automatización visual de esta entrega no estuvo disponible: el conector de interfaz devolvió `failed to write kernel assets` antes de exponer una superficie. La prueba de arranque aislada de la compilación tampoco pudo tomar el bloqueo de instancia mientras había una instancia normal activa; no se cerró ni se modificó esa instancia. La validación de interfaz pendiente es visual/manual sobre el instalador entregado.
