# Runbook de piloto cerrado — AVGUST CARE 360

**Versión prevista:** `1.1.0-rc.1`

**Alcance:** 2–3 profesionales autorizados y 1–2 fincas de prueba.
**Modalidad:** servicio web central por dos canales sobre la misma base: el navegador para coordinación y el APK de Android para trabajo de campo. La edición de Windows es local, no sincroniza y no participa en el piloto.

Lo propio del canal Android —publicación previa del sitio, construcción del APK, cámara, entrega de archivos y guion de verificación técnica— está en `PILOT.md`.

## Antes de habilitar el piloto

1. La persona responsable de la plataforma confirma que el sitio privado de prueba está disponible y que D1, R2 y las migraciones `0000` a `0005` corresponden al release candidate etiquetado.
2. La persona responsable de datos realiza y registra una copia fechada y autorizada de D1 y R2 siguiendo `BACKUP_AND_RESTORE.md`. No se prueba una restauración sobre producción.
3. Coordinación define las fincas de prueba y únicamente los datos de contacto necesarios. No usar información clínica, financiera, credenciales ni fotografías ajenas al objetivo técnico.
4. Cada participante usa su propia cuenta autorizada. No se comparten cuentas ni contraseñas.

## Alta y roles

1. La persona responsable del sitio habilita el acceso de la cuenta del participante en el sitio privado.
2. Coordinación crea la finca o selecciona una existente de prueba.
3. Coordinación genera un código de invitación de un solo uso y lo comparte por un canal aprobado.
4. El participante inicia sesión y reclama el código.
5. Coordinación confirma el rol:
   - `manager`: administra finca/equipo y aprueba/publica informes.
   - `editor`: registra solicitudes, visitas, fotos y prepara informes; no aprueba ni publica.
   - `viewer`: consulta y exporta; no modifica.

## Flujo operativo de una visita

1. Iniciar sesión y abrir la finca asignada.
2. Crear o abrir una solicitud, si corresponde, y crear la visita.
3. Completar los capítulos aplicables. Toda respuesta **No** debe llevar hallazgo y recomendación.
4. Crear los compromisos que se hayan acordado, indicando responsable y fecha objetivo.
5. Adjuntar solo evidencia pertinente, autorizada y dentro del límite visible de la aplicación.
6. Guardar explícitamente y comprobar que la visita reaparece en el historial.
7. Al completar la revisión técnica, crear el borrador de informe, enviarlo a revisión, aprobarlo con `manager` y publicarlo con `manager`.
8. Descargar el Word. El PDF se guarda desde la vista de impresión en el navegador de un computador; en el teléfono esa opción no está disponible y el archivo descargado se entrega al menú del sistema para guardarlo o compartirlo. El correo se prepara en el cliente del dispositivo; no se envía automáticamente desde CARE 360.

## Incidencias y conexión

- Ante pérdida de red, no asumir que una visita quedó guardada. Conservar la información, restaurar la conexión, actualizar la vista y guardar de nuevo.
- `401`: la sesión o el acceso al sitio no es válido. Volver a iniciar sesión o pedir habilitación al responsable del sitio.
- `403`: la cuenta no tiene acceso a esa finca o acción. Coordinación debe revisar la pertenencia y el rol.
- `409`: otra sesión cambió la visita o el informe. Actualizar, comparar y volver a aplicar únicamente los cambios necesarios; no sobrescribir a ciegas.
- Para errores no clasificados, registrar fecha/hora, cuenta, finca, acción, mensaje y captura sin datos sensibles. Enviar el reporte al responsable técnico del piloto.

## Responsables y cierre

- **Responsable de plataforma:** habilita acceso al sitio, confirma el entorno de prueba y custodia los respaldos autorizados.
- **Coordinación de finca:** gestiona participantes, roles, códigos y asignaciones.
- **Responsable técnico:** recibe incidencias, conserva la evidencia de pruebas y decide correcciones fuera del piloto.
- **Cierre:** revocar accesos/códigos, exportar el material que la organización haya aprobado, confirmar custodia o eliminación según el acuerdo corporativo y elaborar el informe de cierre. No borrar datos o R2 sin autorización expresa.
