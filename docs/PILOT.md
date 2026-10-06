# Lanzamiento piloto — web y Android

## Alcance de esta modalidad

El piloto usa dos canales sobre **la misma base central**: el navegador para coordinación y el APK de Android para trabajo de campo. Ambos consumen el sitio protegido de ChatGPT Sites, con visitas en D1 y fotografías en R2.

La edición de Windows no participa. Su base `care360.sqlite` es local y no sincroniza; mezclar ambos canales en un mismo piloto produciría dos historiales sin relación. El procedimiento de esa modalidad sigue en `BACKUP_AND_RESTORE.md`.

Fuera de alcance: sincronización entre canales, búsqueda global, alertas, notificaciones, cuentas propias o SSO, y operación sin conexión.

La conducción del piloto —clasificación de incidencias por código, responsables de plataforma, coordinación y soporte técnico, y procedimiento de cierre— está en `PILOT_RUNBOOK.md`. Este documento cubre la parte técnica: preparación, construcción del APK, comportamiento del dispositivo, límites y verificación.

    10|## Preparación antes de repartir el APK

Estos pasos son manuales y requieren una sesión autorizada de Cloudflare y del proyecto de Sites. Nunca se ejecutan desde las pruebas automáticas y nunca con `--remote` fuera de una autorización explícita.

**Publicar primero en el sitio el build que se va a pilotar.** El APK no contiene la interfaz: es una ventana al sitio central y carga la versión publicada cada vez que arranca. Mientras el sitio sirva una versión anterior, el teléfono no mostrará la captura de fotografías, la barra de guardado fija ni la entrega de archivos al menú del sistema, aunque el APK se acabe de compilar. Conviene confirmarlo con una cuenta autorizada desde el navegador del teléfono: el editor de visita debe ofrecer **Tomar foto** y **Elegir de la galería**. Por la misma razón, una corrección de interfaz durante el piloto se publica en el sitio y llega al dispositivo al reabrir la aplicación, sin reinstalar el APK.

1. **Acceso al sitio.** Habilitar en Sites la cuenta de cada participante. La aplicación no puede dar de alta a nadie: sin acceso al sitio, el APK se queda en la pantalla de inicio de sesión y las rutas responden 401.
2. **Esquema.** Confirmar que el D1 del proyecto (`DB` en `.openai/hosting.json`) tiene aplicadas las migraciones `0000` a `0005` de `drizzle/`, en orden numérico. Una ruta que use una tabla sin migrar falla aunque el código compile.
3. **Copia de seguridad fechada.** Exportar D1 y copiar los objetos de R2 con la misma fecha y hora de corte, según `BACKUP_AND_RESTORE.md`. Es el único punto de retorno del piloto: no hay restauración remota automática.
4. **Finca piloto.** Crear la finca, registrar sus contactos y generar los códigos de invitación. Los códigos son de un solo uso, caducan en 24 horas y se entregan de forma manual.
5. **Roles.** Asignar un `manager` de coordinación antes de invitar a campo. El creador de la finca conserva coordinación permanente y no puede ser retirado.

    20|## Reparto de funciones

| Función | Rol por finca | Canal | Qué hace |
| --- | --- | --- | --- |
| Coordinación | `manager` | Navegador de escritorio | Fincas, contactos, participantes, invitaciones, asignaciones, aprobación y publicación de informes, consolidado y matriz Excel. |
| Trabajo de campo | `editor` | APK de Android | Visitas, checklist, mediciones, fotografías, compromisos y solicitudes de sus fincas. |
| Consulta | `viewer` | Navegador | Lectura y descarga. No modifica estados ni contenido. |

No hay administrador global ni acceso por dominio de correo. Cada permiso se concede por finca.

## Construcción e instalación del APK
    30|
```powershell
npm ci
npm run android:toolchain   # solo la primera vez
npm run build
npm run android:apk
```

`npm run android:toolchain` deja el JDK 21, el SDK de Android 35 y la caché de Gradle dentro de `.android-build`, que está fuera del control de versiones. No instala nada en el sistema ni cambia variables de entorno: para retirar todo basta con borrar esa carpeta. El script es repetible y no vuelve a descargar lo que ya está.

Si en el equipo hay un antivirus que inspecciona tráfico HTTPS, presenta su propia raíz de certificación. Windows la acepta, Java no, y tanto la descarga del SDK como la de Gradle fallan con un error `PKIX path building failed`. El script detecta ese caso y confía esa raíz únicamente en el almacén del JDK local; no modifica el antivirus ni el almacén de certificados de Windows.

El resultado queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Es una compilación de depuración firmada con la clave de desarrollo: sirve para instalar de forma manual en los teléfonos del piloto, y el dispositivo pedirá autorizar la instalación desde origen desconocido. Una distribución por tienda o MDM requeriría una firma de publicación que este piloto no define.

Al preparar una entrega nueva, subir `versionName` en `android/app/build.gradle` para que en el teléfono se distinga de la anterior.

## Comportamiento propio de la aplicación de Android
    40|
| Tema | Comportamiento |
| --- | --- |
| Inicio de sesión | El APK abre el sitio y delega la identidad en ChatGPT. `capacitor.config.ts` autoriza la navegación al proveedor y su retorno a `/callback`. Si un participante inicia sesión con un proveedor cuyo host no está en `allowNavigation`, la pantalla se abre en el navegador del sistema y la sesión no llega a la aplicación: se agrega ese host y se recompila. |
| Fotografías | **Tomar foto** usa la cámara del sistema y **Elegir de la galería** el selector de archivos. No se declara el permiso `CAMERA` porque la captura la realiza la aplicación de cámara; por eso no aparece una solicitud de permisos. |
| Descarga de Word, Excel y CSV | Android ignora la descarga directa del navegador. El archivo se escribe en el almacenamiento privado de la aplicación y se abre el menú del sistema para guardarlo o compartirlo. Los archivos de ese almacén temporal se descartan pasadas seis horas. |
| Impresión a PDF | No disponible en el APK. La aplicación lo indica y el PDF se genera desde el computador con la vista de impresión. |
| Conexión | Obligatoria para guardar, leer fotografías y exportar. Sin red, la aplicación muestra el error y no crea registros locales. |

## Límites conocidos que conviene anunciar al equipo

- Guardar es una acción explícita. Al salir con cambios pendientes aparece un aviso.
    50|- Si la misma visita se edita en dos dispositivos, el segundo guardado se rechaza con un conflicto y hay que reabrir la visita. No se sobrescribe nada.
- Hasta 60 fotografías por informe y 8 MB por fotografía, en JPG, PNG o WebP.
- El listado de visitas se carga completo para el usuario autenticado. Con el volumen de un piloto es aceptable; si una finca con mucho historial se vuelve lenta, se mide ese caso antes de paginar.
- No existe borrado de fincas ni de visitas desde la aplicación.
- El panel de seguimiento no envía notificaciones ni correos. **Preparar correo** abre el cliente del dispositivo y el profesional adjunta el archivo descargado.
- Las fechas de seguimiento vencidas son fechas programadas, no incumplimientos confirmados.

## Verificación antes de declarar el piloto abierto

Las pruebas automáticas cubren modelo, permisos, expediente, métricas, respaldo e integración HTTP local; el procedimiento está en `TESTING.md`. Lo que falta es una pasada con sesión real y pantalla táctil, que debe hacerse sobre la entrega que se va a repartir.

    60|| # | Comprobación | Canal |
| --- | --- | --- |
| 1 | Iniciar sesión y llegar a Inicio. | APK y navegador |
| 2 | Coordinación crea la finca, registra contactos y genera un código. | Navegador |
| 3 | Campo reclama el código y ve la finca en su lista. | APK |
| 4 | Nueva visita vinculada a la finca, capítulos 3 a 5, una respuesta No con hallazgo, recomendación y plan de acción. | APK |
| 5 | Adjuntar una fotografía con **Tomar foto** y otra desde la galería; guardar y comprobar que se ven al reabrir. | APK |
| 6 | Reabrir la misma visita desde el navegador y confirmar los datos y las fotografías. | Navegador |
| 7 | Consulta no puede editar; campo no puede aprobar el informe. | Navegador |
| 8 | Coordinación envía a revisión, aprueba y descarga el Word. | Navegador |
    70|| 9 | Descargar el Word desde el teléfono y comprobar que el menú de guardar o compartir entrega el archivo. | APK |
| 10 | Activar el modo avión e intentar guardar: debe aparecer un error claro y ningún registro nuevo. | APK |

Registrar el resultado de cada punto con la fecha y el dispositivo. Un punto que falle se corrige antes de ampliar el número de participantes.

## Durante el piloto

- Conservar la copia previa hasta cerrar el piloto y revisar los datos.
- Anotar cada incidencia con finca, fecha, dispositivo y qué se esperaba.
- No aplicar migraciones nuevas ni cambios de esquema mientras el piloto esté abierto, salvo una corrección acordada con su propia copia de seguridad previa.
