# Fase 2 — identidad, permisos y trazabilidad por finca

Fecha: 2026-09-10

## Decisión de diseño

CARE 360 ya cuenta con un modelo de permisos por finca. Esta fase lo conserva y no crea una segunda tabla de usuarios, un RBAC global ni sesiones propias. La identidad y la sesión provienen de ChatGPT Sites mediante `app/chatgpt-auth.ts`; el servidor recibe esa identidad confiable y decide el acceso a cada finca con `farm_members`.

La creación y desactivación de cuentas tampoco pertenece a CARE 360 mientras el acceso dependa de ese proveedor. La baja operativa de una persona de una finca se realiza al quitar su pertenencia en `farm_members`. No otorga ni retira acceso al sitio de Sites.

## Matriz comprobada en backend

| Capacidad por finca | Consulta | Trabajo de campo | Coordinación |
| --- | --- | --- | --- |
| Leer visitas, solicitudes, fotos, contactos y participantes autorizados | Sí | Sí | Sí |
| Crear o editar visitas y subir fotos | No | Sí | Sí |
| Crear o editar solicitudes sin cambiar asignaciones | No | Sí | Sí |
| Asignar RTC o profesional de una solicitud | No | No | Sí |
| Cambiar contactos, invitar, revocar o cambiar participantes | No | No | Sí |
| Consultar la bitácora de la finca | No | No | Sí |

`/api/visits`, `/api/photos`, `/api/photos/:id`, `/api/requests` y `/api/team` verifican la identidad y la pertenencia en servidor. Las métricas y los informes se derivan de las visitas que esa ruta ya filtró, por lo que no existe una ruta de métricas que pueda saltarse el permiso por finca. Las escrituras además validan el origen cuando la petición incluye `Origin`. Por ello, conocer una URL, ocultar un control en la interfaz o modificar una petición del navegador no concede acceso.

Las visitas personales continúan siendo accesibles solamente para quien las creó. Al asociar una visita a una finca, las visitas y fotografías pasan a estar autorizadas por la pertenencia vigente a esa finca. Retirar un integrante le quita el acceso posterior a ese contenido compartido.

## Bitácora incorporada

La migración `0003_audit_events.sql` añade `audit_events`, indexada por finca y fecha. Solo se registran decisiones de administración de la finca:

- creación de finca;
- actualización de contactos, con el número de contactos;
- creación y revocación de invitaciones;
- adhesión, cambio de rol y retiro de participantes.

La ruta `GET /api/audit?farmId=<uuid>` entrega hasta 200 eventos recientes y exige rol `manager`. Devuelve actor, momento, acción, sujeto y metadatos mínimos. No guarda ni expone códigos de invitación, teléfonos, correos, contenido de informes, respuestas de visitas, cabeceras de autenticación ni archivos R2.

La bitácora de contenido técnico —publicación inmutable de informe, versión, aprobación y cambios de compromisos— se reserva para la fase de estados y versiones de informe. Agregarla ahora dentro de `visits.payload` impediría una consulta confiable e independiente.

## Pruebas automáticas

`node tests/team.mjs` aplica todas las migraciones reales sobre SQLite en memoria y comprueba:

- una coordinación puede consultar eventos propios de la finca;
- trabajo de campo y consulta reciben 403 al intentar leer la bitácora directamente;
- creación, revocación, adhesión, cambio de rol y retiro de integrantes quedan registrados;
- invitados, roles, retiro de integrante y contenidos compartidos mantienen su restricción;
- la respuesta de auditoría no contiene correos ni códigos de invitación.

Estas pruebas validan el contrato de rutas y los permisos de CARE 360. No simulan ni modifican cuentas reales de ChatGPT Sites, D1 remoto, R2 remoto ni producción.

## Límites y siguiente fase

El creador de una finca no puede retirarse ni degradarse y no existe transferencia de propiedad. Esa regla conserva un responsable permanente, pero una futura política corporativa deberá definir el procedimiento de transferencia cuando una persona deje la empresa.

La siguiente fase puede construir el expediente técnico de finca sobre las entidades existentes: finca, contactos, solicitudes, visitas, fotos, informes derivados, métricas y compromisos. Antes de añadir tablas nuevas, deberá confirmar qué consulta no puede resolverse de manera paginada y autorizada con ese modelo.
