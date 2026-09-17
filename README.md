# AVGUST CARE 360

Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en
fincas de flores. Registra la visita técnica, evalúa los criterios por capítulo,
documenta los hallazgos con fotografías, emite el informe técnico en Word o PDF
y hace seguimiento a los compromisos hasta cerrarlos.

Desarrollado por **Kevin Villamizar**.
Este programa fue creado con la ayuda de **Wilson Castro**.

---

## Qué hay en este repositorio

| Ruta | Contenido |
| --- | --- |
| `CARE-360-1.5.0-sin-marca-Android.apk` | **Sin marca Avgust, edición profesional.** Identidad CARE 360 en verde agro, buscadores en listas, espejo de guardado, informe con membrete, modo sol y accesibilidad reforzada. Incluye la capa operativa 1.4.35 (briefing, calidad de visita, filtros). |
| `AVGUST-CARE-360-1.4.2-Android.apk` | Versión con marca Avgust (la de campo). |
| `enhance/src/` | Código de la capa de mejoras (CSS y JavaScript). |
| `tools/` | Guiones de compilación, vista previa, paquete base y firma. |
| `tests/` | Prueba de extremo a extremo del contenido web. |

El APK base no incluye el código fuente de la aplicación web: su interfaz viaja
compilada dentro de `assets/public`. Por eso las mejoras se entregan como una
capa que se carga **después** de la hoja de estilos y del paquete de la
aplicación, sin tocar el código compilado. Así se añade comportamiento nuevo sin
riesgo de romper ninguna función existente.

---

## Versión 1.5.0 sin marca Avgust — edición profesional de campo

Incluye la capa operativa 1.4.35 y sube el nivel profesional sin tocar el código compilado (capas aditivas):

**Capa operativa (1.4.35):**

- **Inicio:** briefing del día con borradores, compromisos vencidos, agenda y estado del respaldo.
- **Visita:** panel de calidad con avance, pendientes y un botón para ir al siguiente criterio incompleto.
- **Visitas guardadas:** búsqueda y filtros Todas / Borradores / Revisadas, con indicador de estado.

**Capa profesional (1.5.0):**

- **Identidad CARE 360 profesional:** lockup con escudo hoja en la cabecera,
  píldora «MIPE · Campo», distintivo de versión Pro, favicon e icono en verde
  agro (`#14532d`) y tema verde en manifiesto y barra del sistema.
- **Productividad en campo:** buscador rápido con contador en las listas
  (fincas, visitas, informes, solicitudes, seguimiento, consulta), resaltado de
  campos obligatorios vacíos y píldora flotante de guardado («● Cambios sin
  guardar» / «✓ Guardado HH:MM»).
- **Informe técnico con membrete:** encabezado «CARE 360 · Informe técnico
  MIPE» en pantalla y membrete + pie impresos, tablas rayadas con encabezado
  repetido, fotos y secciones sin cortes de página y márgenes A4.
- **Accesibilidad de exteriores:** modo sol ☀ de alto contraste (persistente),
  foco visible reforzado, objetivos táctiles de 44 px y respeto por «reducir
  movimiento». Estado de conexión siempre visible («En línea» / «Sin
  conexión»).
- Todo defensivo: si una pantalla cambia, la capa simplemente no aplica ese
  pulido en lugar de romper la aplicación (`window.Care360Pro`).

**[CARE-360-1.5.0-sin-marca-Android.apk](./CARE-360-1.5.0-sin-marca-Android.apk)**

Se instala encima de la 1.4.2 a la 1.4.34 (misma firma, código 48).

## Versión 1.4.13 sin marca Avgust

Corrige la escritura en **calidad del agua** y **mezcla final** (y el resto de
mediciones del capítulo): los campos ya se pueden editar con normalidad.

**[CARE-360-1.4.13-sin-marca-Android.apk](./CARE-360-1.4.13-sin-marca-Android.apk)**

Se instala encima de la 1.4.2 a la 1.4.12 (misma firma).

## Versión 1.4.12 sin marca Avgust

Las **mediciones** ya no van en un paso aparte: aparecen **dentro del capítulo
de evaluación** que les corresponde (4.6 agua, **4.10 mezcla final**, 5.1
presión, 5.3 equipo, 5.6 volumen/tiempo). También en el informe.

**[CARE-360-1.4.12-sin-marca-Android.apk](./CARE-360-1.4.12-sin-marca-Android.apk)**

Se instala encima de la 1.4.2 a la 1.4.11 (misma firma).

## Versión 1.4.11 sin marca Avgust

En **Datos de la finca** (visita) puedes indicar el **tipo de cultivo**; queda en el
**encabezado del informe** (pantalla y Word), junto a finca y fecha.

Sigue el borrado de visitas/informes/solicitudes, responsable a mano y el
diccionario departamento → municipio.

**[CARE-360-1.4.11-sin-marca-Android.apk](./CARE-360-1.4.11-sin-marca-Android.apk)**

Se instala encima de la 1.4.2 a la 1.4.10 (misma firma).

## Versión 1.4.10 sin marca Avgust

Puedes **borrar** visitas (con sus informes), versiones de informe y solicitudes
desde la lista o el editor, con confirmación.

Sigue incluyendo responsable/profesional a mano en solicitudes y el diccionario
departamento → municipio al registrar fincas.

**[CARE-360-1.4.10-sin-marca-Android.apk](./CARE-360-1.4.10-sin-marca-Android.apk)**

Se instala encima de la 1.4.2 a la 1.4.9 (misma firma).

## Versión 1.4.9 sin marca Avgust

Esta versión **no incluye logos de Avgust ni el nombre Avgust**. El programa se
presenta como **CARE 360**.

- En **Solicitudes**, el representante y el profesional se escriben a mano (ya no
  queda fijo «Responsable local»).
- Al **registrar una finca**, departamento y municipio salen de un diccionario
  de Colombia; también se pide el nombre del responsable.

**[CARE-360-1.4.9-sin-marca-Android.apk](./CARE-360-1.4.9-sin-marca-Android.apk)**

Se instala encima de la 1.4.2 a la 1.4.8 (misma firma).

## Versión 1.4.8 sin marca Avgust

Las mediciones de campo van organizadas por el protocolo MIPE **en el formulario
y en el informe**, con equipo e implementos de aplicación escritos a mano.

**[CARE-360-1.4.8-sin-marca-Android.apk](./CARE-360-1.4.8-sin-marca-Android.apk)**

## Versión 1.4.2 (con marca Avgust)

Sigue disponible para quien necesite la interfaz con marca:

**[AVGUST-CARE-360-1.4.2-Android.apk](./AVGUST-CARE-360-1.4.2-Android.apk)**

### Presentación de bienvenida

Al abrir el programa por primera vez aparece una guía de siete secciones que
explica, en menos de un minuto:

1. Qué es AVGUST CARE 360 y que funciona sin conexión.
2. Para qué está hecho: evaluación MIPE, hallazgos, informe y compromisos.
3. Cómo se registra una visita: `01 Datos`, `02 Mediciones`, `03 Evaluación`, `04 Fotos`, `05 Informe`.
4. Qué hace cada uno de los siete módulos.
5. El ciclo de vida del informe: borrador, en revisión, aprobado y publicado.
6. Dónde viven los datos y cómo crear y restaurar un respaldo.
7. Los créditos: **Kevin Villamizar** como desarrollador y el agradecimiento a
   **Wilson Castro**.

Los créditos salen **solo en esa guía**. Se puede omitir, recorrer con los
botones o deslizando el dedo, y reabrir con el botón **Guía**.

### Interfaz

- **Barra de módulos arriba**, en los colores del modo claro (blanca, con la
  pestaña activa en el azul AVGUST). En modo oscuro se adapta sola.
- En el teléfono se puede **deslizar a izquierda y derecha** para pasar de una
  función a otra; dentro de una visita o sobre una foto ese gesto no se usa.
- Las fotografías, las pestañas internas (Seguimiento) y las tarjetas de
  **Consulta** (estado, comportamiento, fechas) caben en la pantalla: el texto
  no se sale ni se parte a mitad de la fecha.
- **Tabletas, ventanas medianas y teléfono en horizontal** usan las etiquetas
  cortas para que tampoco quede ningún módulo oculto.
- **Pasos de la visita siempre visibles.** La barra `01 · 02 · 03 · 04 · 05` queda
  fija bajo la cabecera mientras se llena el formulario. Las mediciones de campo
  (pH, dureza, conductividad, presión, equipo, implementos, volumen y tiempo) van en el paso **02**,
  agrupadas por capítulo MIPE: agua en 4.6, presión en 5.1, equipo e implementos
  de aplicación junto a la presión, cama en 5.6, aparte de la evaluación.
- **Objetivos táctiles de 46 px** en botones, campos y respuestas Sí / No /
  No aplica, pensados para trabajar con guantes.
- **Foco visible** en todos los controles, sombras y radios consistentes,
  transiciones suaves y respeto por «reducir movimiento».

### Experiencia de uso

- **Botón físico de atrás.** Cierra la presentación o el diálogo abierto,
  recorre la visita (`05 → 04 → 03 → 02 → 01`), cierra el editor, deshace las
  pestañas internas, vuelve a *Inicio* y sólo sale tras una segunda pulsación,
  avisando si hay cambios sin guardar.
- **Teclado en pantalla.** El campo que se está escribiendo queda por encima del
  teclado. En **Consulta**, el buscador de finca no se tapa: se compacta el
  encabezado y la página deja espacio para desplazarlo.
- **Aviso de cambios sin guardar** al cambiar de módulo con una visita a medias.
- **La barra de guardado de la visita** queda al pie de la pantalla, sin tapar la navegación de arriba.
- **Recuperación ante un error inesperado.** Si la aplicación dejara de
  responder, aparece una pantalla con la opción de reiniciar en lugar de una
  pantalla en blanco.
- **Aviso de conexión** al entrar y salir de cobertura.
- **Botón «volver arriba»** en las pantallas largas y desplazamiento al inicio al
  cambiar de módulo.
- **Caché del service worker con versión.** Antes el nombre de la caché era fijo,
  por lo que una actualización podía seguir sirviendo archivos antiguos.

---

## Generar el APK

Requisitos: `zipalign` y `apksigner` (Android build-tools), `keytool` (JDK),
`python3`, `zip` y `unzip`.

```bash
ANDROID_BUILD_TOOLS=/ruta/a/build-tools/34.0.0 tools/build-apk.sh
# o, si zipalign y apksigner ya están en el PATH:
tools/build-apk.sh
```

Parámetros opcionales: `tools/build-apk.sh <apk-base> <version-name> <version-code>`.

Para generar la APK **sin marca Avgust**:

```bash
C360_DEBRAND=1 ANDROID_BUILD_TOOLS=/ruta/a/build-tools/34.0.0 \
  tools/build-apk.sh tools/base/AVGUST-CARE-360-1.1.0-rc.5-Android.apk 1.5.0 48
```

Sin argumentos, la edición sin marca ya sale como 1.5.0 (código 48).

El guion extrae del paquete base sólo lo que va a cambiar, añade la capa de
mejoras, ajusta `versionName` y `versionCode` dentro del manifiesto binario,
rearma el APK, lo alinea y lo firma (esquemas v1, v2 y v3). El resultado queda en
`dist/`.

### Sobre la firma

El paquete original venía firmado con la clave de depuración del equipo donde se
compiló, que no está disponible aquí. El APK 1.4.2 se firma con la clave de
`tools/signing/`.

- **Si ya tiene una 1.2.x, 1.3.0 o 1.4.x firmada con esta misma clave:** puede
  instalar 1.4.2 encima.
- **Si tiene 1.1.0-rc.5:** hay que desinstalarla primero. Cree un respaldo
  completo desde *Inicio → Crear respaldo completo*, desinstale, instale
  `AVGUST-CARE-360-1.4.2-Android.apk` y restaure el respaldo.

Para publicar con otra clave:

```bash
CARE360_KEYSTORE=/ruta/mi.keystore \
CARE360_KEYSTORE_PASS=... \
CARE360_KEY_ALIAS=... \
tools/build-apk.sh
```

---

## Revisar los cambios sin instalar nada

```bash
tools/dev-preview.sh          # sirve la aplicación en http://localhost:8080
C360_DEBRAND=1 tools/dev-preview.sh   # igual, sin marca Avgust
```

Prepara una copia del contenido web del APK con la capa de mejoras aplicada. Es
la misma combinación que termina dentro del paquete.

## Pruebas

```bash
cd tests
npm install
npm test                      # requiere la vista previa corriendo en el 8080
```

Recorre la presentación completa, comprueba los créditos, abre los siete
módulos, crea una visita, responde criterios, genera la vista previa del
informe, la guarda, verifica que los datos sobreviven al reinicio, cambia el
tema, crea un respaldo y descarga el informe en Word.
