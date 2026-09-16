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
| `CARE-360-1.4.8-sin-marca-Android.apk` | **Sin marca Avgust.** Equipo e implementos de aplicación se escriben a mano. Instalable en Samsung. |
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

## Versión 1.4.8 sin marca Avgust

Esta versión **no incluye logos de Avgust ni el nombre Avgust**. El programa se
presenta como **CARE 360**. Las mediciones de campo van organizadas por el
protocolo MIPE **en el formulario y en el informe** (vista previa, Word y PDF):

- **Cap. 4 · 4.6** calidad del agua: pH, dureza y conductividad.
- **Cap. 5 · 5.1** presión de salida de la bomba.
- **Anexo** equipo de aplicación e implementos de aplicación, escritos a mano.
- **Cap. 5 · 5.6** volumen y tiempo por cama.

**[CARE-360-1.4.8-sin-marca-Android.apk](./CARE-360-1.4.8-sin-marca-Android.apk)**

Se instala encima de la 1.4.2 a la 1.4.7 (misma firma).

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
  tools/build-apk.sh tools/base/AVGUST-CARE-360-1.1.0-rc.5-Android.apk 1.4.8 20
```

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
