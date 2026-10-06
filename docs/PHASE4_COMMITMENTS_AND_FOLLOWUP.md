# Fase 4 — compromisos y seguimiento

Fecha: 2026-09-11

## Modelo reutilizado

No se creó una tabla paralela de compromisos. Un compromiso sigue siendo el plan de acción de un hallazgo `No`, almacenado en `visits.payload.actions[criterio]`. La clave lógica es `visitaId:criterio`; la visita conserva la finca, el informe de origen, fotografías y control de revisión.

Cada acción contiene responsable en texto, fecha objetivo, estado, nota de seguimiento, fotografías opcionales de antes y cierre, y los metadatos de cierre `completedAt`, `completedBy` y `reopenedAt`. La fecha y el actor de cierre los fija el servidor web, no el navegador. Windows conserva el mismo formato y anota `Responsable local` al cerrar, porque esa modalidad no usa cuentas centrales.

No se añadió prioridad: no existía un campo fiable que reutilizar. Tampoco se creó una entidad de responsable separada; el responsable puede ser un contacto de finca o una persona externa al sistema, por lo que se conserva el campo operativo existente.

## Estados y vencimiento

| Estado persistido | Uso |
| --- | --- |
| `proposed` | Recomendación todavía no aceptada. |
| `pending` | Compromiso aceptado. |
| `progress` | Trabajo en curso. |
| `closed` | Completado, con responsable, fecha objetivo y comentario de cierre. |
| `cancelled` | Cancelado y excluido de pendientes. |

`overdue` no se guarda. Se deriva cuando el estado es `pending` o `progress`, existe fecha objetivo y esa fecha es anterior al día actual. El plazo de “próximo” se centraliza en `COMMITMENT_DUE_SOON_DAYS`, actualmente siete días.

Al cerrar, reabrir, cancelar, cambiar responsable o cambiar fecha, la web crea eventos de auditoría por finca. Los eventos contienen criterio, tipo de cambio y metadatos mínimos; no contienen la descripción del hallazgo, fotos, archivos, contactos ni códigos de invitación.

## API, permisos y rendimiento

- `GET /api/commitments` entrega una página de hasta 50 compromisos derivados de visitas autorizadas. Admite `farmId`, `responsible`, `technician`, `status`, `bucket`, `from`, `to`, `cursor` y `limit`.
- Las secciones son `today`, `upcoming`, `overdue` y `completed`. La respuesta incluye sus conteos calculados en servidor y un cursor opaco, de modo que el navegador no descarga todo el historial.
- `POST /api/commitments` actualiza una sola acción contra la revisión actual de su visita. Exige `manager` o `editor` por finca; `viewer` solo consulta. Una visita personal conserva la regla de propiedad existente.
- Conocer un identificador no concede acceso: tanto la consulta como el cierre vuelven a validar identidad y permiso en backend. Anónimo recibe 401 y un tercero sin acceso recibe 403 para una finca indicada o no ve las visitas compartidas en la consulta general.

La consulta usa una sola lectura de visitas autorizadas y deriva sus hallazgos en backend. No hay consulta N+1 ni carga completa hacia el navegador. No se añadió migración: los índices `visits(farm_id,date)` de Fase 3 siguen limitando el ámbito de finca antes de leer los payloads JSON.

## Expediente técnico

El expediente conserva su carácter agregado. Ahora muestra compromisos activos, vencidos y cierres de los últimos 30 días; sus eventos de seguimiento distinguen actividad, vencimiento y cierre. Cada elemento continúa abriendo la visita original. Las métricas, solicitudes y fotografías no se copian dentro del expediente.

## Pruebas y límites

`tests/team.mjs` verifica creación derivada, cursor, cierre sin foto obligatoria, fecha y actor de cierre, reapertura, cancelación, auditoría y bloqueo para un tercero. Las pruebas existentes siguen cubriendo validación del plan, vencimiento derivado, permisos de visita, expediente y revisión optimista.

La fase no agrega notificaciones externas, IA, predicciones ni alertas avanzadas. La prioridad queda pendiente hasta que el negocio defina una escala operativa. La bitácora remota y las cuentas solo aplican a la versión web central; Windows funciona localmente y no sincroniza datos por esta fase.
