# Base de datos y contrato de datos

## Principio de compatibilidad

La base central de AVGUST CARE 360 es Cloudflare D1. No se modifican tablas desde rutas API ni se eliminan registros históricos en una migración. Todo cambio persistente se realiza como una migración SQL nueva en `drizzle/`, generada desde `db/schema.ts` cuando corresponda.

La aplicación de Windows usa `care360.sqlite` únicamente en el equipo donde fue instalada. Es una modalidad local y no sustituye ni replica automáticamente la base central.

## Esquema central actual

| Tabla | Finalidad | Integridad y consultas actuales |
| --- | --- | --- |
| `visits` | Encabezado y contenido JSON validado de una visita. | Clave `id`, revisión optimista y fecha; índices por propietario/fecha y finca/fecha. |
| `photos` | Metadatos de archivos R2. | Clave `id`; el binario no se guarda en D1; índice por finca. |
| `farms` | Finca compartida. | La finca tiene creador, zona y contacto principal. |
| `farm_members` | Permisos por finca. | Clave compuesta finca/usuario; índice por usuario. |
| `farm_invitations` | Invitación temporal de un solo uso. | Token, rol y vencimiento. |
| `service_requests` | Solicitud de servicio vinculada a finca. | Revisión optimista; índice por finca. |
| `farm_contacts` | Contactos y destinatarios de informe. | Índice por finca; máximo funcional de doce contactos. |
| `audit_events` | Bitácora administrativa no sensible por finca. | Índice compuesto por finca y fecha; no almacena tokens, contactos ni payloads técnicos. |
| `report_versions` | Estados e historial documental de un informe de visita. | Versión única por visita, revisión optimista e índices por finca/fecha y visita/estado; el snapshot se congela solo al enviar a revisión. |

## Contenido de una visita

`visits.payload` contiene un `Visit` validado por `lib/validate.ts`. Mantener esta forma es necesario para leer visitas ya guardadas.

- Identidad de visita: `id`, `revision`, `farm`, `farmId`, `date` y responsables.
- Evaluación: capítulos, respuestas Sí/No/No aplica, observaciones y recomendaciones.
- Seguimiento: `actions` por criterio con responsable, fecha límite, estado, cierre y referencias de fotos.
- Evidencia: referencias de fotografías; sus bytes permanecen en R2.
- Resultado: revisión técnica, mediciones, conclusión y vínculo opcional a una solicitud.

No se debe añadir un segundo objeto de visita ni usar un nuevo nombre para los mismos conceptos. Las entidades futuras que requieran consulta independiente, historial inmutable o autorización propia —por ejemplo alertas, eventos de auditoría y versiones de informe— deben tener tablas nuevas y relaciones explícitas.

## Migraciones

1. Actualizar `db/schema.ts` cuando el cambio afecte tablas o índices centrales.
2. Generar una migración nueva con `npm run db:generate`.
3. Revisar el SQL: debe ser aditivo o incluir un plan de migración compatible.
4. Ejecutar las pruebas de modelo y equipo con las migraciones reales.
5. Aplicar primero en un entorno de prueba; nunca usar las pruebas automáticas contra producción.
6. Registrar el cambio en `docs/CHANGELOG.md` cuando exista una entrega funcional.

Una base local creada antes de una migración no se actualiza sola al ejecutar `npm run dev`. Después de construir, aplique únicamente cada archivo pendiente al estado local antes de iniciar el servidor. Por ejemplo, para esta entrega:

```powershell
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_farm_dossier_indexes.sql
```

En una base local nueva, ejecute los archivos de `drizzle/` en orden numérico. No reutilice estos comandos con `--remote` salvo que exista una autorización y un entorno de prueba explícitos.

Las métricas actuales son derivadas de visitas revisadas. No representan lecturas independientes persistidas. Antes de crear `MetricDefinition` o `MetricReading`, se debe acordar con el negocio qué indicadores son medidos directamente, su unidad, orientación y fuente.

La migración `0003_audit_events.sql` añade la bitácora administrativa de Fase 2. La migración `0004_farm_dossier_indexes.sql` añade los índices para el expediente paginado de Fase 3. La migración `0005_report_versions.sql` añade el ciclo documental de Fase 5. Deben aplicarse de forma aditiva junto a las anteriores; la prueba de permisos carga todas las migraciones SQL ordenadas antes de probar rutas.

## Fechas, archivo y borrado

Las fechas de visitas y compromisos se validan como `YYYY-MM-DD`. No hay borrado de fincas ni visitas expuesto por las rutas actuales. Antes de añadirlo se definirá archivado, retención, autorización y restauración.

## Consulta paginada por finca

El expediente usa el índice de visitas por `farm_id` y fecha, y responde con cursor para evitar cargar todo el historial. Las métricas y seguimientos del resumen se derivan en servidor de los registros autorizados; no existe una tabla paralela de expediente.

## Compromisos derivados

Los compromisos permanecen en `visits.payload.actions`; no hay migración ni tabla adicional en Fase 4. Los campos de cierre `completedAt`, `completedBy` y `reopenedAt` son compatibles con payloads históricos que aún no los poseen. Los vencimientos se derivan con fecha objetivo y estado activo, por lo que tampoco se persisten. La consulta web limita primero las visitas por autorización y finca, y deriva los planes en servidor antes de paginar.
