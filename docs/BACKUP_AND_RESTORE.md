# Respaldo y restauración de AVGUST CARE 360

## Alcance y regla de seguridad

AVGUST CARE 360 tiene dos almacenamientos que **no se sincronizan entre sí**:

1. **Windows local:** `care360.sqlite`, creado por el instalador en el equipo de cada usuario.
2. **Servicio central:** visitas y fincas en Cloudflare D1; fotografías en Cloudflare R2.

Un respaldo se prueba en un entorno aislado antes de aplicarlo a datos reales. Nunca ejecutar `--remote`, borrar objetos ni importar SQL contra producción como parte de una prueba automática.

## Windows: respaldo completo local

En la aplicación de Windows, abrir la función **Inicio** y usar **Crear respaldo completo** en el panel «Datos de este equipo». El resultado es un archivo `.care360` de SQLite que incluye fincas, contactos, solicitudes, visitas, borradores, versiones de informe, trazabilidad local y fotografías locales.

Para restaurar, usar **Restaurar respaldo** en ese mismo panel y elegir el archivo `.care360`. La restauración exige que no haya una visita en edición sin guardar. Antes de sustituir la base activa, la aplicación comprueba que:

- el identificador y la versión del esquema pertenecen a AVGUST CARE 360;
- `PRAGMA quick_check` no reporta daños;
- la estructura coincide con la instalación;
- cada visita del respaldo conserva un `Visit` válido.

También crea una copia de seguridad automática llamada `antes-de-restaurar-<fecha>.care360` junto a la base local. Conservarla hasta revisar la restauración.

La prueba `npm run desktop:test` crea una finca, contacto, solicitud, visita y versiones de informe, genera el respaldo, modifica un borrador, restaura el archivo y comprueba que la visita, las versiones, los participantes y el contacto original vuelven a estar íntegros.

## Servicio central: respaldo por cuenta

En la aplicación web, abrir **Inicio → Respaldo y restauración**:

- **Exportar respaldo .care360** crea un SQLite con el formato de AVGUST CARE 360 (`application=avgust-care-desktop`, esquema 1), incluyendo las fincas a las que pertenece la cuenta, contactos, visitas autorizadas, solicitudes, versiones de informe y fotografías.
- **Importar y combinar** acepta el `.care360` SQLite generado por la aplicación local y los JSON de respaldo web de la versión anterior. Valida integridad/esquema, restaura las fotografías y agrega únicamente registros faltantes. Un ID en conflicto se conserva como está y se reporta como omitido; no se reemplazan visitas, solicitudes, contactos ni versiones existentes.
- El archivo está ligado a la misma cuenta que lo generó. Las fincas que ya no están vinculadas se restauran únicamente si la cuenta era su creadora. En fincas compartidas se requiere permiso de edición para restaurar visitas; contactos e informes requieren permiso de coordinación. No se exportan ni restauran miembros, asignaciones de personas, permisos, invitaciones o auditoría.
- No se puede iniciar la operación mientras haya una visita en edición sin guardar. El límite del archivo es 16 MB y cada foto puede pesar hasta 8 MB; la exportación por partes aún no está disponible. Por privacidad, las solicitudes se exportan sin IDs de participantes y quedan en estado «solicitada» si antes estaban programadas; después de restaurar, coordina de nuevo el equipo y las fechas. Si una importación se interrumpe, vuelve a importarse el mismo archivo: los registros ya agregados no se sobrescriben y los duplicados se omiten. El servidor informa si alcanzó a agregar registros antes de una interrupción.

Este respaldo ayuda a recuperar los datos de una cuenta, pero no reemplaza la copia administrativa completa del servicio central ni ofrece restauración de una cuenta diferente.

## Servicio central: copia administrativa completa

Una copia ante pérdida del servicio requiere dos copias coordinadas:

- una exportación SQL de D1;
- una copia de cada objeto R2 de fotografías, manteniendo su clave y metadatos necesarios.

El administrador autorizado debe guardar ambas en un almacenamiento corporativo con acceso restringido y conservar la misma fecha/hora de corte. El respaldo por cuenta no incluye invitaciones, auditoría, membresías ni datos de fincas ajenas, por lo que no sustituye esta copia administrativa.

### Exportación remota manual, solo con autorización administrativa

Desde una sesión de Cloudflare autorizada, usar los nombres y bindings aprobados para el entorno de producción. Nunca copiar literalmente esta instrucción contra otro entorno sin revisarla primero:

```powershell
npx wrangler d1 export <base-D1-produccion> --remote --output <carpeta-segura>\d1-AAAA-MM-DD.sql
```

Para R2, crear un inventario fechado de claves y descargar cada objeto al mismo corte. Conservar la relación `photos.key` de D1 con el objeto de R2. La configuración actual del proyecto no incluye un procedimiento remoto automatizado de listado y copiado de objetos; debe definirse con las credenciales y la política corporativa antes de operar el servicio con datos de producción.

### Restauración remota

No hay una restauración remota automática en CARE 360. El proceso aprobado debe ser:

1. Restaurar primero el SQL y los objetos R2 en un entorno aislado.
2. Comparar conteos de fincas, visitas, solicitudes, contactos y metadatos de fotos.
3. Verificar una muestra de descargas de fotos contra su hash.
4. Validar permisos y abrir informes de muestra.
5. Solo después de aprobar la verificación, ejecutar el cambio de recuperación contra el entorno afectado con una copia de seguridad previa y ventana de mantenimiento.

Las credenciales, retención, cifrado, responsables y frecuencia de las copias deben ser definidos por Avgust antes de automatizar el paso remoto.

## Prueba verificable sin datos reales

Después de compilar el servicio, ejecutar:

```powershell
npm run build
npm run test:backup
```

`tests/backup-restore.ps1` crea un estado nuevo de Wrangler bajo `work/backup-restore/` para cada ejecución. Realiza esta secuencia:

1. Aplica las migraciones actuales a D1 local e inserta una visita de prueba.
2. Exporta D1 a `d1-backup.sql` y verifica que contiene esquema y visita.
3. Elimina esa visita en la fuente local y recupera el SQL en un estado local aislado.
4. Comprueba identidad, propietario, finca, fecha y revisión de la visita recuperada.
5. Sube un archivo de evidencia a R2 local, lo descarga como copia de respaldo y compara SHA-256.
6. Elimina el objeto, confirma que ya no se puede leer, lo restaura desde la copia y vuelve a comparar SHA-256.

La prueba no usa `--remote`, no lee `.wrangler/` de la aplicación y deja sus artefactos para inspección. Un resultado `PASS` demuestra el flujo de recuperación local de D1/R2 con el esquema vigente; no constituye una prueba contra Cloudflare remoto ni reemplaza la aprobación administrativa para restaurar producción.
