# Cambios de AVGUST CARE 360

## En desarrollo

### 1.5.35

- En Inicio, el recuadro Vencidos de «Hoy en campo» cuenta igual que el KPI Compromisos vencidos: solo hallazgos con respuesta No, en un capítulo incluido, pendientes o en proceso y con fecha límite anterior a hoy. versionCode 83.

### 1.5.34

- En Métricas, el gráfico de Evolución queda más bajo en escritorio para leer juntos el periodo, el veredicto, la comparación y Qué atender, sin que la gráfica ocupe toda la ventana. versionCode 82.

### 1.5.33

- La directiva maestra de UX queda en `docs/UX_DIRECTIVA.md`. En la capa de presentación: un solo botón primario en el editor de visita, estados de guardado (guardando, sin guardar, error y hora), punto amarillo en Visitas, confirmaciones que nombran la consecuencia, estados vacíos y de carga, y avisos sin códigos técnicos. versionCode 81.

### 1.5.32

- En escritorio (≥1024 px) las ventanas de todos los módulos quedan más compactas: menos relleno, títulos más bajos y el contenido en rejilla (Inicio en tres columnas, formularios de visita y fichas de finca, métricas y seguimiento) para ver más sin recorrer espacios vacíos. El teléfono no cambia. versionCode 80.

### 1.5.31

- Windows queda a la par de la APK `1.5.31` (versionCode 79): misma capa `enhance` (métricas por capítulos y subcapítulos, importación de informes, experiencia y presentación). El entregable es `AVGUST-CARE-360-1.5.31-Windows-x64-portable.exe`.

### 1.5.14

- Cancelar informe elimina la versión documental y deja la visita. Borrar visita, informe, solicitud o finca ya persiste en Windows y en el APK local.

### 1.5.13

- Windows queda a la par de la APK definitiva `1.5.13`: misma interfaz local más la capa `enhance` (experiencia, operaciones, importación, métricas y presentación).
- El entregable de Windows es el ejecutable portable `AVGUST-CARE-360-1.5.13-Windows-x64-portable.exe`.

### Windows 1.1.0-rc.5

- Windows 1.1.0-rc.5 incluye las mismas mejoras que el APK: tema claro/oscuro, hasta 60 fotografías de 8 MB y el contador en el registro fotográfico. En este entorno NSIS no pudo ejecutar el desinstalador temporal; `npm run desktop:installer` genera entonces el ejecutable portable.

### Campo: atrás, teclado y más fotos

- En Android, Atrás recorre Informe → Fotos → Evaluación → Datos → lista → Inicio, y solo entonces sale de la aplicación.
- Al escribir, el teclado reduce la ventana y el campo queda a la vista.
- Un informe admite hasta 60 fotografías de 8 MB. El tamaño por foto no cambió.

### Barra del teléfono

- El APK reserva la franja de batería, señal y notificaciones. Antes el contenido se dibujaba encima en Android 15.

### Experiencia de uso en el teléfono

- El APK y Windows ofrecen **Oscuro / Claro** en la barra superior. La elección se conserva en el dispositivo.
- En pantallas pequeñas la navegación pasa a la parte inferior, con nombres cortos y área táctil mayor. El botón de guardar de la visita queda encima, sin tapar los criterios.
- En el teléfono se oculta Imprimir/PDF, que no funciona en Android, y se deja Descargar Word.

### Android local, igual que Windows

- El APK dejó de abrir el sitio de ChatGPT. Empaqueta la misma interfaz local que el instalador de Windows: sin cuentas, sin conexión, fincas y visitas en el dispositivo, respaldo `.care360` desde Inicio.
- Las fotografías, el Word y el Excel siguen saliendo por el menú de compartir de Android.
- `npm run android:apk` construye `desktop/ui` y lo copia al APK. La versión del paquete es `1.1.0-rc.2` (`versionCode` 3).

### Preparación del lanzamiento piloto en web y Android

- `capacitor.config.ts` autoriza la navegación al proveedor de identidad de ChatGPT y su retorno al sitio. Antes, la pantalla de inicio de sesión salía al navegador del sistema y la sesión no llegaba al APK.
- El registro fotográfico ofrece **Tomar foto** y **Elegir de la galería**. La captura usa la aplicación de cámara del sistema; no se declara el permiso `CAMERA` y el APK no solicita permisos nuevos. `AndroidManifest.xml` declara la consulta del intento de captura que exige la visibilidad de paquetes de Android 11.
- Word, Excel, CSV y el respaldo del formulario se guardan en Android a través de un puente que escribe el archivo en el almacenamiento privado de la aplicación y abre el menú del sistema para guardarlo o compartirlo. La descarga del navegador no cambia. La impresión a PDF avisa que no está disponible en el APK.
- El editor de visita muestra una barra fija de guardado y opciones de respuesta de mayor área táctil en pantallas pequeñas. No se modificó la identidad visual ni la estructura del formulario.
- `npm run desktop:installer` vuelve a producir el instalador. La descarga del empaquetador NSIS fallaba con `unable to verify the first certificate` cuando un antivirus inspecciona HTTPS, porque Node usa su propio almacén de raíces; ahora se ejecuta con `--use-system-ca`.
- La prueba de arranque de la edición de Windows exigía seis funciones en la navegación y desde la incorporación de **Seguimiento** hay siete, de modo que fallaba siempre con `Interfaz incompleta`. Ahora comprueba la lista de funciones esperadas e informa cuál falta, el logotipo y la ausencia de inicio de sesión. Se ejecuta con `npm run desktop:smoke`.
- `npm run android:toolchain` prepara el JDK 21 y el SDK de Android 35 dentro de `.android-build`, sin instalar nada en el sistema, y confía en el JDK local la raíz de un antivirus que inspeccione HTTPS, que de otro modo impide descargar el SDK y Gradle. `npm run android:apk` usa esa cadena de herramientas cuando existe y el JDK del sistema cuando no.
- `docs/PILOT.md` reúne el alcance del piloto, la preparación de accesos, esquema y respaldo, la construcción del APK, los límites conocidos y el guion de verificación con sesión real. Queda como documento técnico del canal Android y remite a `PILOT_RUNBOOK.md`, que conserva la conducción del piloto; el runbook recoge los dos canales y remite a su vez a `PILOT.md`.
- `docs/PILOT.md` advierte que el sitio debe publicarse antes de repartir el APK, porque el APK no contiene la interfaz y carga la versión publicada en cada arranque.
- `docs/BACKUP_AND_RESTORE.md` indicaba crear el respaldo de Windows desde un menú **Archivo** que no existe. El respaldo y la restauración están en el panel «Datos de este equipo» de la función Inicio.
- No se modificaron el esquema, las rutas, el modelo `Visit` ni el cálculo del indicador.

### Fase 6 — métricas históricas y comparación entre visitas

- Se agregó Evolución dentro de Consulta de finca: historial paginado por finca, métrica y rango de fechas, gráfica lineal de puntos reales, tabla trazable y apertura de la visita original.
- El catálogo central distingue cumplimiento, pH, dureza, presión, volumen, tiempo y equipo de aplicación; las lecturas no numéricas no se convierten de forma arbitraria.
- Se agregó comparación protegida de dos visitas revisadas de la misma finca, con diferencia absoluta, puntos porcentuales para cumplimiento, cambio relativo seguro y comparación textual.
- Las variaciones se expresan de forma neutral como aumentó, disminuyó, estable o datos insuficientes. No se añadieron diagnósticos ni reglas agronómicas.
- Windows reutiliza la misma definición de métricas sobre SQLite local, sin sincronización ni tablas nuevas.

### Fase 5 — ciclo documental de informes

- Se agregó el historial `draft → in_review → approved → published` sobre las visitas existentes.
- El envío a revisión congela una captura editorial sin duplicar fotos ni crear otra visita; se detecta si la fuente cambia antes de aprobar.
- Coordinación aprueba/publica, trabajo de campo prepara/envía y consulta puede leer/exportar.
- El expediente identifica las versiones formales y mantiene los informes técnicos revisados anteriores como registros históricos.
- Windows conserva el ciclo y sus eventos locales dentro de los respaldos `.care360`.

### Fase 4 — consolidación profesional de compromisos y seguimiento

- Seguimiento web ahora consulta compromisos derivados de visitas en páginas por cursor, con secciones Hoy, Próximos, Vencidos y Completados, filtros operativos y apertura del registro original.
- Se añadieron los estados `cancelled`, fecha y actor de cierre, y fecha de reapertura dentro del plan de acción existente; `overdue` se calcula desde fecha objetivo y estados activos.
- `POST /api/commitments` aplica permisos de edición, revisión optimista y auditoría mínima para crear, reasignar, reprogramar, completar, reabrir o cancelar un compromiso.
- El expediente técnico muestra compromisos activos, vencidos y cierres recientes sin copiar datos de visitas.
- Windows conserva el modelo local y completa los metadatos de cierre con el responsable local.

### Fase 3 — expediente técnico unificado de finca

- Se añadió el expediente web por finca en `Consulta de finca`, construido a partir de solicitudes, visitas, fotos, informes revisados, métricas y compromisos existentes.
- `GET /api/farms/:id/dossier` entrega resumen, filtros por actividad y rango de fechas, y línea de tiempo paginada por cursor. La respuesta no duplica el contenido técnico de las visitas.
- Cada evento abre su registro original. `GET /api/visits/:id` exige identidad y la misma autorización por finca que el listado de visitas.
- Se agregó `0004_farm_dossier_indexes.sql` con índices por finca/fecha en visitas y por finca en fotografías.
- Las pruebas verifican cursor, filtros, conteos, consulta por `viewer`, bloqueo directo a terceros y la ruta HTTP local del expediente.

### Fase 2 — consolidación de permisos y trazabilidad

- Se comprobó que CARE 360 ya usa identidad externa de ChatGPT Sites y roles por finca (`manager`, `editor`, `viewer`) verificados desde las rutas API. No se creó un segundo sistema de usuarios, sesiones o RBAC global.
- Se añadió la migración `0003_audit_events.sql` y el esquema `audit_events` para la bitácora administrativa por finca.
- Coordinación puede consultar los últimos 200 eventos por finca mediante `GET /api/audit?farmId=<uuid>`; trabajo de campo y consulta reciben 403.
- La bitácora registra creación de finca, actualización de contactos, invitaciones y cambios de integrantes. Sus metadatos excluyen códigos de invitación, correos, teléfonos, respuestas, informes y archivos.
- La prueba de permisos ahora cubre el acceso prohibido directo a la bitácora y comprueba que la respuesta no filtra datos sensibles.

### Fase 1 — estabilización inicial

- Se auditó la arquitectura real y se documentaron backend, datos, seguridad, pruebas, deuda técnica y fases de evolución en `CARE360_ARCHITECTURE_AUDIT.md`.
- Se documentó el contrato actual de D1, R2, visitas y migraciones en `DATABASE.md`.
- Se documentó el procedimiento reproducible de pruebas locales en `TESTING.md` y se aclaró el uso de `vinext dev` para la sesión de integración simulada.
- Se documentaron respaldo y restauración para SQLite local, D1 y R2 en `BACKUP_AND_RESTORE.md`, con límites explícitos para producción.
- Se añadió `npm run test:backup`, que prueba de forma aislada D1 local (exportación, eliminación y recuperación) y R2 local (respaldo, eliminación y restauración con SHA-256).
- `npm run lint` pasa con cero errores mediante una política por módulo en `LINT_POLICY.md`; las excepciones de CommonJS, Vinext, controles compuestos y pruebas están limitadas y justificadas.
- La validación de visitas ahora rechaza valores no textuales para `serviceKind`, evitando coerción implícita.
- La importación histórica ordena capítulos de forma numérica y el exportador Excel acepta texto explícito.

### Pendiente de este corte

- No se modificaron tablas centrales ni se aplicaron migraciones nuevas.
- La exportación y restauración remota de D1/R2 sigue requiriendo autorización administrativa, credenciales corporativas y una prueba previa fuera de producción.
