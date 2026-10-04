# AVGUST CARE 360

Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en
fincas de flores. Registra la visita técnica, evalúa criterios por capítulo,
documenta hallazgos con fotos, emite el informe (Word/PDF/Excel) y hace
seguimiento a los compromisos.

Desarrollado por **Kevin Villamizar**. Creado con la ayuda de **Wilson Castro**.

---

## Una sola APK

Este repositorio publica **una única APK**. Las versiones anteriores
(1.1.0-rc.5 hasta 1.5.31, y las variantes sin marca) están **retiradas**
de `dist/`. No se instalan ni se vuelven a subir.

| Instalar esto | No instalar esto |
| --- | --- |
| [`dist/AVGUST-CARE-360-1.5.32-Android.apk`](./dist/AVGUST-CARE-360-1.5.32-Android.apk) | 1.5.13, cualquier APK suelta en la raíz, `tools/base/`, u otra rama |

En la cabecera de la app debe verse **v1.5.32**. La actualización está diseñada para conservar la identidad de firma y el versionCode ascendente; la compatibilidad real sobre cada versión instalada debe validarse en un dispositivo antes de distribuirla.

La 1.5.13 (versionCode 61) **no se puede instalar** sobre un teléfono que ya
tiene la 1.5.31 (versionCode 79): Android la rechaza como downgrade. Esta
1.5.32 usa el código y los recursos de esa 1.5.31, con versionCode 80.

`tools/base/capacitor-seed.apk` **no es una versión para campo**: es solo la
semilla Capacitor con la que se recompila. Nadie del equipo debe instalarla.

---

## Qué incluye 1.5.32

- El bundle web generado por la pipeline actual y empaquetado sobre la semilla Capacitor de `tools/base/`. No se debe afirmar que contiene el binario exacto de una APK 1.5.31 sin una prueba de extracción/identidad del artefacto.
- Interfaz de campo: cromo más bajo en pantalla estrecha, blancos de toque
  de 44px, un solo color Avgust, estado de guardado encima del teclado y
  guía solo si no hay una visita abierta.
- versionCode **80**, mayor que el 79 de la 1.5.31, para que la actualización
  entre sin desinstalar.
- Manifiesto de release: `debuggable=false` y `allowBackup=false`.
- La misma clave de firma que la 1.5.31.

---

## Estructura

```
dist/                 ← única APK instalable (versión actual)
enhance/src/          ← capa de interfaz y experiencia
tools/
  base/               ← semilla de compilación (no instalar)
  signing/            ← keystore de release
  build-apk.sh        ← genera la APK y borra las demás de dist/
  patch_*.py          ← parches sobre el bundle compilado
tests/                ← e2e
```

`tools/build-apk.sh` deja **exactamente un** `.apk` en `dist/` y no permite
APKs sueltas en la raíz. La versión y el código de Android se declaran en
`version.json`; no deben duplicarse como valores por defecto en scripts.

---

## Generar la APK

Requisitos: `zipalign`, `apksigner`, `keytool`, `python3`, `zip`, `unzip`.

```bash
# El build actual recompila desde la semilla Capacitor versionada en tools/base/.
# No sustituye una APK de campo ya validada hasta completar las pruebas de
# instalación/actualización y firma sobre un dispositivo real.
# Las contraseñas van por entorno; ver tools/signing/README.md.
CARE360_KEYSTORE_PASS=... CARE360_KEY_PASS=... tools/build-apk.sh
```

Parámetros opcionales: `tools/build-apk.sh <apk-semilla> <version-name> <version-code>`.

La variante sin marca (`C360_DEBRAND=1`) solo se usa si hace falta un paquete
neutro; en ese caso **esa** queda como la única APK en `dist/`. El flujo normal
de campo es la APK Avgust.

### Vista previa sin instalar

```bash
tools/dev-preview.sh                 # http://localhost:8080
```

### Pruebas

```bash
cd tests && npm install && npm test   # requiere la vista previa en :8080
```


## Reglas de desarrollo controlado

La aplicación está en transición desde un bundle legado hacia una arquitectura
source-first. Hasta completar esa migración:

1. `version.json` es la fuente única de versión, versionCode y caché.
2. Un fallo de cualquier transformador detiene el build.
3. `enhance/src/` es la capa editable principal para experiencia e interfaz.
4. Los `patch_*.py` solo deben conservar transformaciones que todavía no puedan
   expresarse de forma segura en código fuente.
5. No se modifica ni rota la clave de firma sin un plan de migración que preserve
   las actualizaciones sobre instalaciones existentes.
6. Una IA de desarrollo debe modificar solo archivos previamente autorizados,
   ejecutar `npm run verify:build` y ejecutar las pruebas afectadas.
7. Si necesita tocar otro archivo, debe detenerse y solicitar autorización.

La migración source-first se hará por módulos y con pruebas de regresión; no se
reemplazará toda la aplicación en una sola operación.
