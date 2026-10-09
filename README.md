# AVGUST CARE 360

Aplicación para registrar visitas y preparar informes técnicos por finca. Permite completar los 37 criterios de los cinco capítulos, adjuntar fotos, consultar métricas históricas por finca y descargar Word editable o imprimir a PDF.

Los objetivos y la metodología provienen del protocolo Word suministrado. Las preguntas se extrajeron de las listas de chequeo sin cambiar sus criterios técnicos. El indicador usa respuestas “Sí” sobre criterios aplicables (“Sí” + “No”), excluye “No aplica” y pondera los capítulos así: 1 (5%), 2 (25%), 3 (10%), 4 (30%) y 5 (30%). Clasifica cada visita como Saludable (95–100%), Alerta (80–94%) o Vulnerable (menos de 80%). El diseño del Word es nuevo, conserva la estructura y el contenido institucional pero no reproduce exactamente la diagramación del original.

Este repositorio incluye el proyecto fuente (versión 1.5.35) para web, Windows y Android. El motor de métricas anterior basado en `enhance` ya no se carga: la puntuación, el estado y la evolución usan `lib/model.ts` y `lib/metric-analysis.ts`, y las vistas actuales viven en `app/metrics-panel.tsx` y `app/consolidated-metrics.tsx`. El resto de la capa `enhance/src` permanece para otras funciones de interfaz. La APK 1.5.32 se conserva como referencia; no se debe generar un release de producción con el flujo de APK semilla.

## Datos y acceso

Las visitas se guardan en D1 y las fotografías en R2. Todas las operaciones requieren autenticación. Las visitas personales se restringen a su autor; las compartidas se autorizan por pertenencia a la finca. La publicación inicial es privada para su propietario. El uso desde varios dispositivos requiere iniciar sesión con la misma cuenta. La aplicación incluye fincas compartidas con permisos por participante. La política de acceso del sitio sigue siendo privada: incorporar empleados requiere habilitar su acceso al sitio y después asignarlos a una finca.

Guardar es una acción explícita. Los cambios sin guardar muestran un aviso al salir. Al abrir otra visita se intenta guardar primero. La revisión técnica exige los campos principales, las respuestas de los capítulos seleccionados y hallazgo y recomendación para cada respuesta No. Un cambio posterior retira el estado revisado. La versión de cada registro evita sobrescrituras entre dispositivos.

El respaldo JSON conserva campos y referencias a fotos, no los bytes de las fotos. El Word sí incorpora las fotos. La vista de impresión permite guardar PDF a través del navegador. Requiere conexión para guardar, recuperar fotos y generar exportaciones desde visitas guardadas.

## Desarrollo

Node 22.16 o posterior. Se requiere esta versión para la API de respaldo de SQLite que usa la edición Windows. `npm ci`, `npm run dev`, `npm run build`. `npm run db:generate` genera migraciones de Drizzle; no se crean tablas desde rutas de aplicación. El entorno local simula el inicio de sesión mediante `/signin-with-chatgpt`.

Para preparar una base local nueva tras generar y construir, ejecutar las migraciones de `drizzle/` en orden numérico. Si la base local ya existía, aplicar solamente cada migración pendiente antes de iniciar `npm run dev`; por ejemplo: `npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_farm_dossier_indexes.sql`. Utilizar una ruta absoluta para `persist-to` si Wrangler resuelve la ruta desde `dist/server`. Nunca añadir `--remote` a este procedimiento sin una autorización y un entorno de prueba explícitos.

Validación: `npx tsc --noEmit`, `node tests/model.mjs`, `node tests/team.mjs` y `tests/integration.ps1`. Para la integración, iniciar primero `npm run dev` y ejecutar el script con PowerShell 7 (`pwsh -File tests/integration.ps1`); este modo proporciona la identidad local simulada de Sites. `wrangler dev --config dist/server/wrangler.json` sirve el Worker compilado, pero no expone `/signin-with-chatgpt` y por tanto no sirve para ese script. Las pruebas de integración crean registros de prueba en la base local. El archivo `.wrangler/cleanup-test.sql` elimina los metadatos de la última ejecución. Nunca ejecutar estas pruebas contra producción.

Se expone la herramienta WebMCP de solo lectura `read_current_visit` cuando el navegador la soporta. Su contrato no se verificó en un contexto WebMCP compatible. Se verificaron las reglas, el guardado, los conflictos de edición, el rechazo de acceso anónimo, la carga/lectura de fotos y la generación de Word. No se realizó una prueba visual interactiva de navegador ni una revisión visual en Word.

## Seguimiento de hallazgos

Cada respuesta No en un capítulo seleccionado puede originar un plan de acción con responsable, fecha límite, estado, nota y evidencia opcional. El cierre exige responsable, fecha objetivo y comentario; la fotografía, si existe, debe pertenecer a la misma visita y capítulo. Los planes se conservan en el payload de D1 con control de revisión existente, sin migración de esquema. Los hallazgos sin plan se interpretan como recomendaciones propuestas, sin asignación. Un estado `pending` guardado previamente mantiene su significado operativo y se presenta como Aceptada.

El historial agrupa las visitas de una finca por su nombre normalizado, ignorando mayúsculas y espacios repetidos, para conservar juntas las visitas antiguas y las nuevas aunque no compartan un identificador interno. Cada informe revisado con criterios aplicables es una medición independiente. El indicador compara la primera y la última medición, muestra el cierre y promedio de cada año, el estado de cada capítulo en la última visita y los problemas abiertos. Un problema se marca como recurrente cuando sigue apareciendo en dos o más informes. La reevaluación no cierra compromisos anteriores. Las fechas de seguimiento pasadas son fechas programadas, no confirmaciones de una visita incumplida. El panel no envía notificaciones.

Consulta de finca incluye **Evolución** para revisar una métrica a la vez con su rango de fechas, puntos reales, historial tabular y comparación de dos visitas revisadas. El sistema conserva el valor original y solo calcula cuando la lectura es numérica estricta. Las variaciones son descriptivas: aumentó, disminuyó, estable o datos insuficientes; no interpretan una dirección como favorable ni producen diagnósticos. El cumplimiento se compara en puntos porcentuales y los cambios relativos no se calculan cuando el valor anterior es cero. El contrato técnico está en `docs/PHASE6_METRICS_AND_COMPARISON.md`.

El consolidado toma únicamente aseguramientos revisados: incluye visitas sin tipo de servicio y las marcadas como `assurance`; excluye capacitaciones, aforos y seguimientos que no aplican el cuestionario. Calcula el indicador global sobre todos los criterios aplicables, organiza el resultado por periodo, capítulo e ítem, y muestra los ítems con más respuestas No. La descarga de matriz crea un archivo `.xlsx` con cuatro hojas: resumen, capítulo, ítems críticos y matriz histórica por finca, fecha e informe.

Cada finca puede guardar hasta doce contactos con nombre, cargo, teléfono, correo y la marca de destinatario de informes. El botón Preparar correo abre el cliente de correo del dispositivo con esos destinatarios, asunto y texto del informe; el profesional adjunta el Word o PDF descargado y confirma el envío. No existe envío automático ni una cuenta de correo corporativa configurada dentro del programa.

Word y la impresión incluyen el plan de acción y la referencia a su fotografía de cierre. Cada foto puede clasificarse como evidencia general del capítulo o asociarse a un subcapítulo concreto; esa referencia se conserva al guardar y aparece en el informe y en Word. Las pruebas de modelo cubren compatibilidad, vencimientos, evidencia y comparación; las de integración verifican que estado y fotografía sobreviven al guardado y lectura. No se realizó una prueba visual interactiva del navegador en esta ampliación.


## Fincas, participantes y solicitudes

Cada finca tiene un creador con coordinación permanente. Coordinación administra participantes, genera códigos y asigna RTC y profesional ejecutor. Trabajo de campo crea y edita visitas y solicitudes de sus fincas. Consulta solo lee y descarga informes. La autorización se aplica a las rutas del servidor y a las fotografías; el creador de una visita compartida pierde acceso si es retirado de la finca, salvo que siga autorizado por otra pertenencia válida a esa misma finca. No hay administrador global ni acceso automático por dominio de correo.

Los códigos de invitación son secretos de un uso, expiran en 24 horas y se comparten manualmente. Quien tenga acceso al sitio y el código puede reclamarlo con su identidad autenticada. No se envían correos ni se modifica el acceso de Sites desde la aplicación. El creador de una finca no puede ser retirado ni degradado; los coordinadores no pueden cambiar sus propios permisos. Los permisos se aplican por finca.

Las solicitudes separan tipo de servicio, motivo, fecha, RTC, profesional y estado. Se pueden convertir en informes vinculados sin marcarlas realizadas automáticamente. Capacitaciones, aforos y seguimientos pueden documentarse con resultados y mediciones sin checklist; el aseguramiento mantiene sus criterios. La coordinación puede actualizar las asignaciones. Los conflictos de revisión de solicitudes y visitas se rechazan.

Vincular una visita personal comparte su contenido y sus fotos con la finca seleccionada. Una visita compartida no puede moverse a otra finca ni convertirse en personal. Los registros previos no se vinculan automáticamente. La migración 0001 agrega tablas de fincas, participantes, invitaciones y solicitudes, y columnas farm_id opcionales a visitas y fotos, sin backfill ni borrado de registros.

Validación adicional: node tests/team.mjs ejecuta las rutas contra SQLite en memoria con identidades confiables simuladas y las migraciones reales. Cubre invitaciones, permisos por finca, asignaciones, fotos compartidas, revocación y conflictos de versión. Requiere Node 22.16 o superior con node:sqlite disponible. No reemplaza la validación del acceso de Sites para los empleados reales.

## Navegación e identidad visual

La interfaz se organiza en Inicio, Fincas y equipo, Solicitudes, Visitas e informes, Métricas y Seguimiento. Las pantallas conservan su estado durante la navegación; cambiar de función no equivale a guardar. Métricas ofrece dos vistas: **Por finca**, con filtro anual, gráfica por fecha, tendencia, estado, problemas recurrentes y estado por capítulo; y **Consolidado de aseguramientos**, con tendencia global, hallazgos por capítulo, priorización de ítems y matriz Excel. Desde Métricas se genera un informe Word por finca o PDF con la gráfica mediante la impresión del sistema. El listado de visitas se separa del editor, y Seguimiento incluye pestañas para compromisos, agenda e historial. Las listas de visitas, solicitudes y compromisos usan páginas de ocho registros.

Para revisar una entrega sin instalarla ni afectar los datos operativos, el ejecutable admite `--preview`. Esta modalidad usa una carpeta local separada y se identifica como Vista previa.

El logo y la tipografía Manrope se obtuvieron de https://avgust.com.co/ (logo: /wp-content/uploads/2020/02/Logotipo.svg; fuente: /wp-content/uploads/elementor/google-fonts/fonts/manrope-xn7gyhe41ni1adirggexsg.woff2). La paleta toma las variables del tema oficial: celeste #00B5E2, verde #78BE20, amarillo #F2A900 y gris #333F48; los botones usan un azul más oscuro para mantener legibilidad. Ambos recursos se sirven localmente desde public. Validación: TypeScript, build y respuesta HTTP local correctos; sin prueba visual interactiva solicitada.

## Compromisos y seguimiento

La web muestra compromisos por finca en las secciones Hoy, Próximos siete días, Vencidos y Completados. Los filtros incluyen finca, responsable, técnico, estado y rango de fechas; la respuesta se pagina desde backend. Un compromiso proviene del hallazgo de una visita y abre ese registro original. Completar, reabrir o cancelar conserva el plan dentro de la visita, registra fecha y actor de cierre cuando existen cuentas centrales, y deja un evento de auditoría no sensible. La evidencia fotográfica sigue disponible, pero no bloquea un cierre cuando no corresponde. La edición Windows conserva el mismo historial local y marca los cierres con el responsable local. El detalle del contrato está en `docs/PHASE4_COMMITMENTS_AND_FOLLOWUP.md`.

## Aplicación de Android

El APK es la misma edición local que Windows: sin cuentas, sin ChatGPT y sin conexión. Fincas, visitas y fotografías se guardan en el teléfono. El respaldo `.care360` está en Inicio, igual que en el computador. Word, Excel y CSV se entregan al menú del sistema para guardarlos o compartirlos. La impresión a PDF no está disponible en el teléfono.

`npm run android:apk` construye la interfaz local, la empaqueta y genera `android/app/build/outputs/apk/debug/app-debug.apk`.
