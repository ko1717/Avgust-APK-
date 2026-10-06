# Auditoría de arquitectura — AVGUST CARE 360

Fecha de auditoría: 2026-09-13

## Alcance y conclusión

AVGUST CARE 360 ya es una aplicación funcional de registro técnico por finca. No debe reconstruirse. La evolución debe conservar su modelo `Visit`, sus rutas existentes, D1/R2 y el control de concurrencia por revisión. La finca compartida es el punto de unión correcto para continuar hacia el expediente técnico empresarial.

Existen dos modalidades deliberadamente separadas:

- **Web central:** visitas en Cloudflare D1, fotografías privadas en R2 y acceso mediante ChatGPT Sites.
- **Windows local:** Electron con SQLite local y respaldos `.care360`. No sincroniza con D1/R2.

La aplicación Android actual es un contenedor Capacitor del servicio web central; requiere conexión y el mismo acceso autorizado al sitio.

## Backend

| Área | Implementación actual |
| --- | --- |
| Lenguaje y framework | TypeScript, React 19 y Vinext/Vite en un Worker de Cloudflare. |
| Base de datos | Cloudflare D1 mediante Drizzle y consultas parametrizadas de D1. |
| Archivos | Cloudflare R2; las fotos se sirven únicamente desde una ruta autorizada. |
| Autenticación | Cabeceras de identidad de ChatGPT Sites consumidas por `app/chatgpt-auth.ts`. |
| Autorización | Roles por finca: `manager`, `editor`, `viewer`, verificados en las rutas. |
| Informes | Word generado en cliente con `docx`; PDF mediante impresión del navegador; estados y capturas inmutables en `report_versions`. |
| Trabajos en segundo plano | No existen. |
| Logs | `console.error` para fallos no previstos; bitácora administrativa por finca en `audit_events`. |

### Rutas actuales

| Ruta | Métodos | Función | Protección |
| --- | --- | --- | --- |
| `/api/visits` | GET, POST | Lista y guarda visitas; controla revisión para rechazar sobrescrituras. | Identidad, permiso por finca, origen en escrituras. |
| `/api/photos` | POST | Carga JPG, PNG o WebP de hasta 8 MB. | Identidad y permiso de edición de finca. |
| `/api/photos/:id` | GET | Lee una fotografía privada. | Identidad y pertenencia/propiedad. |
| `/api/team` | GET, POST | Fincas, participantes, contactos e invitaciones. | Identidad; gestión solo para coordinación. |
| `/api/requests` | GET, POST | Solicitudes de servicio vinculadas a una finca. | Identidad y permiso de edición. |
| `/api/audit` | GET | Bitácora administrativa por finca. | Identidad y rol `manager` de la finca. |
| `/api/farms/:id/dossier` | GET | Resumen y actividad paginada de una finca. | Identidad y pertenencia vigente. |
| `/api/farms/:id/metrics` | GET | Historial paginado de una métrica por finca. | Identidad y pertenencia vigente. |
| `/api/farms/:id/metrics/compare` | POST | Comparación neutral de dos visitas revisadas. | Identidad y pertenencia vigente. |
| `/api/commitments` | GET, POST | Consulta y actualización de compromisos derivados de visitas. | Lectura o edición por finca según operación. |
| `/api/reports` y `/api/reports/:id` | GET, POST | Ciclo y lectura de versiones formales de informe. | Roles por finca; aprobar/publicar solo `manager`. |
| `/api/visits/:id` | GET | Abre una visita individual. | Identidad y propiedad/pertenencia vigente. |

No hay API de búsqueda global, alertas, administración global ni healthcheck. La auditoría registra cambios administrativos y el ciclo formal de informes, pero no reemplaza una estrategia completa de auditoría empresarial.

## Frontend

La interfaz principal es `app/workspace.tsx`. Conserva estado al cambiar de módulo y llama a las rutas mediante un cliente `fetch` local. Los módulos actuales son:

- Inicio: resumen de visitas, fincas, informes por revisar y compromisos vencidos.
- Fincas y equipo: fincas compartidas, contactos, participantes e invitaciones.
- Consulta de finca: historial, situación actual, fotos comparables y nuevo informe desde la finca.
- Solicitudes: servicios, responsables y fechas.
- Visitas e informes: formulario por secciones, checklist, fotos, revisión y exportación.
- Métricas: evolución por finca y consolidado de aseguramientos.
- Seguimiento: acciones, vencimientos e historial.

Se usan componentes Shadcn/Base UI, CSS propio con identidad Avgust, Recharts para gráficas y paginación de ocho elementos en listas operativas. Hay soporte PWA y un contenedor Android Capacitor. El formulario ya se divide en datos, evaluación, fotografías e informe.

## Persistencia y modelo de dominio actual

### D1 y migraciones

| Migración | Efecto |
| --- | --- |
| `0000_rapid_spitfire.sql` | `visits` y `photos`; índice por propietario y fecha. |
| `0001_mighty_bill_hollister.sql` | `farms`, `farm_members`, `farm_invitations`, `service_requests`; agrega `farm_id` opcional a visitas y fotos. |
| `0002_farm_contacts.sql` | `farm_contacts` e índice por finca. |
| `0003_audit_events.sql` | `audit_events` e índice por finca y fecha. |
| `0004_farm_dossier_indexes.sql` | Índices de visitas y fotografías por finca para el expediente. |

Las tablas centrales son `visits`, `photos`, `farms`, `farm_members`, `farm_invitations`, `service_requests`, `farm_contacts` y `audit_events`. `Visit` se conserva como JSON validado dentro de `visits.payload`; concentra respuestas, observaciones, recomendaciones, mediciones, fotos, acciones, revisión y referencia a solicitud.

Las métricas son cálculos puros en `lib/metric-analysis.ts` sobre visitas revisadas. El indicador de aseguramiento se calcula con respuestas Sí sobre criterios aplicables, excluyendo No aplica. El consolidado se calcula actualmente en el navegador a partir de los registros que ya cargó.

La aplicación de Windows replica conceptos de finca, visita, solicitud y foto en `care360.sqlite` con WAL. Su respaldo es una copia SQLite validada antes de restaurar. Esta base no es una segunda base central: es almacenamiento local del ejecutable y debe seguir identificado como tal hasta diseñar una sincronización explícita.

### Correspondencia de dominio

| Concepto de negocio | Estado actual |
| --- | --- |
| Usuario | Identidad externa de ChatGPT Sites; no existe tabla de usuarios. |
| Rol | `manager`, `editor`, `viewer`, limitado a cada finca. |
| Finca | Tabla `farms`, participantes y hasta doce contactos. |
| Visita | `Visit` validado, persistido como JSON en `visits`. |
| Hallazgo / recomendación | Respuesta `NO` y campos de observación/recomendación de `Visit`. |
| Compromiso | `actions` dentro de `Visit`; admite responsable, fecha, cierre y foto. |
| Métrica | Derivada de respuestas; no hay `MetricDefinition` ni `MetricReading` persistidos. |
| Informe | `report_versions` conserva el ciclo documental, versiones y captura editorial inmutable; Word/PDF siguen derivándose en cliente. |
| Evidencia | `photos` en R2 y metadatos en `Visit`. |
| Solicitud | Tabla `service_requests`, enlazable desde una visita. |
| Alerta | No existe como entidad persistida. |
| Auditoría administrativa | `audit_events`; registra cambios de acceso y contactos, excluyendo datos sensibles. |

## Seguridad y privacidad observadas

- Las rutas rechazan peticiones sin identidad con 401.
- Los permisos se verifican en backend; ocultar un botón no es el único control.
- Las visitas y fotos personales son privadas; las compartidas requieren pertenencia a la finca.
- Las escrituras comprueban el origen cuando existe cabecera `Origin`.
- La carga limita tamaño, detecta cabeceras básicas de JPEG/PNG/WebP y usa UUID internos.
- Los errores conocidos se traducen a 400/401/403/404/409/413/422 y el usuario no recibe stack traces.
- Los contactos contienen correo y teléfono; hoy no existe política documentada de retención, archivado ni exportación por rol.

Limitaciones a resolver antes de uso empresarial ampliado:

1. La identidad depende de acceso a ChatGPT Sites; no hay onboarding corporativo, recuperación de cuenta ni SSO propio.
2. No hay rol administrador global ni matriz de permisos empresarial.
3. La auditoría de contenido técnico se concentra en el ciclo de informes; no existe una auditoría empresarial completa ni alertas persistidas.
4. La validación de archivos es por firma inicial; falta inspección más robusta de imagen y estrategia de retención.
5. La configuración privada del sitio impide entregar acceso a trabajadores hasta habilitar una política de acceso autorizada.

## Matriz de estado actual

| Módulo | Existe | Funciona en pruebas | Persistencia | API | UI | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| Inicio | Sí | Básica | Derivada de visitas | Sí | Sí | Indirectos |
| Fincas | Sí | Sí | D1/SQLite local | Sí | Sí | Equipo |
| Equipo | Sí, por finca | Sí | D1/SQLite local | Sí | Sí | Equipo |
| Consulta de finca / expediente | Sí | Sí | Derivada y paginada | API de expediente y visitas | Sí, web central | Equipo/integración |
| Solicitudes | Sí | Sí | D1/SQLite local | Sí | Sí | Equipo/escritorio |
| Visitas | Sí | Sí | D1/SQLite local | Sí | Sí | Modelo/integración parcial |
| Informes | Sí | Word, ciclo y snapshot cubiertos | `report_versions` + visita/fotos | Rutas de informes | Sí | Equipo/escritorio/integración |
| Métricas por finca | Sí | Sí | Derivada | Reutiliza visitas | Sí | Modelo |
| Métricas globales | Sí, cliente | Sí | Derivada | Reutiliza visitas | Sí | Modelo |
| Seguimiento | Sí | Sí | Dentro de visita | Rutas de compromisos | Sí | Equipo/integración |
| Usuarios globales | No | No aplica | No | No | No | No |
| Autenticación | Sí, externa | Anónimo rechazado | Proveedor de Sites | Sí | Sign-in del proveedor | Integración bloqueada localmente |
| Alertas | No | No aplica | No | No | No | No |
| Auditoría administrativa | Sí | Sí | D1 | Sí | Aún sin pantalla | Equipo |

## Baseline de calidad de esta auditoría

| Comprobación | Resultado |
| --- | --- |
| `node tests/model.mjs` | Pasa. Cubre validación, historial, compromisos, evidencia, métricas e importación. |
| `node tests/team.mjs` | Pasa. Cubre migraciones, expediente paginado, invitaciones, roles, fotos, revocación y conflictos. |
| `npm run build` | Pasa. Advierte bundles cliente superiores a 500 kB. |
| `npm run desktop:test` | Pasa. Cubre datos locales, solicitud, visita, respaldo y restauración. |
| Prueba manual local | `/` devuelve 200 y `/api/visits` anónimo devuelve 401. |
| `tests/integration.ps1` | Pasa con `npm run dev` y PowerShell 7: autenticación simulada, auditoría, expediente, guardado, revisión, conflicto 409, origen, fotos y cierres. |
| `npm run lint` | Pasa con cero errores. Las excepciones limitadas por módulo están documentadas en `LINT_POLICY.md`. |

No se ejecutó una prueba visual exhaustiva de navegador, Word, Android físico ni la integración contra la base remota. No se modificó producción durante esta auditoría.

## Deuda técnica priorizada

1. **Crítica para la evolución:** fijar el contrato de ejecución de integración: debe usar `npm run dev` y PowerShell 7. El Worker compilado servido con `wrangler dev` no expone `/signin-with-chatgpt`, que es una ayuda exclusiva del entorno de desarrollo.
2. **Crítica para calidad:** mantener la política de lint por módulo y retirar cada excepción cuando el componente subyacente permita expresarla sin pérdida de semántica.
3. **Alta:** crear migraciones versionadas para entidades nuevas; no añadir campos empresariales permanentes dentro de JSON sin una decisión explícita.
4. **Alta:** mover agregaciones globales de gran volumen al backend/D1 antes de escalar datos; evitar cargar todas las visitas en el navegador.
5. **Alta:** separar con claridad en la interfaz qué datos pertenecen a la versión local de Windows y cuáles al historial central.
6. **Media:** dividir paquetes de cliente para reducir el bundle de escritorio y web.
7. **Media:** documentar backups/restore D1-R2 y una política de archivo/retención.

## Mapa de implementación adaptado al código real

| Fase | Alcance mínimo compatible | Archivos/zona principal | Condición de cierre |
| --- | --- | --- | --- |
| 0 | Auditoría y baseline | Este documento, pruebas existentes | Completada con hallazgos arriba. |
| 1 | Estabilización: integración local, lint propio, contrato de `Visit`, migraciones y recuperación | `tests/`, `app/chatgpt-auth.ts`, `lib/validate.ts`, `drizzle/`, `docs/` | Build, modelo, equipo, integración, recuperación aislada y lint acordado pasan. |
| 2 | Acceso empresarial y trazabilidad | Identidad externa, `farm_members`, `audit_events`, rutas API | Completada: matriz backend, bitácora de administración y pruebas 401/403. |
| 3 | Expediente técnico de finca | `farm-dossier.tsx`, rutas e índices paginados | Completada: resumen operativo, origen de cada dato, filtros y cursor. |
| 4 | Línea de tiempo avanzada | Comparación y eventos con fecha de creación propia | Mantener semántica histórica sin inventar eventos. |
| 5 | Compromisos como entidad trazable | Migración nueva, seguimiento, informes | Cierre con usuario, fecha, comentario y evidencia. |
| 6 | Estados y versiones de informe | Migración de informes/versiones | Publicado inmutable y aprobación auditada. |
| 7 | Búsqueda global segura | Nueva API parametrizada e índices | Resultados paginados por permiso. |
| 8–9 | Métricas históricas y comparador | Reglas puras + agregación backend | Toda cifra abre su visita de origen. |
| 10–11 | Reglas, alertas y panel coordinador | Tablas de reglas/alertas, API | Alertas configurables y resolubles. |
| 12–15 | Evidencias avanzadas, móvil, auditoría, backups | R2, Android/PWA, docs | Permisos, restore documentado y pruebas. |
| 16–18 | Piloto, resumen IA, offline | Solo después de base estable | Datos reales, revisión profesional y sincronización diseñada. |

## Primera intervención recomendada

La **Fase 1** quedó estabilizada con validación de integración local, contrato de datos, lint por módulo y recuperación aislada de D1/R2. La **Fase 2** confirmó el modelo existente de acceso por finca y añadió trazabilidad administrativa. La **Fase 3** reutiliza esas fuentes para el expediente técnico web paginado, sin copiar el contenido de solicitudes, visitas, fotos, informes, métricas o seguimiento.
