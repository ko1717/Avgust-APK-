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

En la cabecera de la app debe verse **v1.5.32**. Se instala encima de 1.4.x–1.5.31
firmadas con la misma clave (`tools/signing/`).

La 1.5.13 (versionCode 61) **no se puede instalar** sobre un teléfono que ya
tiene la 1.5.31 (versionCode 79): Android la rechaza como downgrade. Esta
1.5.32 usa el código y los recursos de esa 1.5.31, con versionCode 80.

`tools/base/capacitor-seed.apk` **no es una versión para campo**: es solo la
semilla Capacitor con la que se recompila. Nadie del equipo debe instalarla.

---

## Qué incluye 1.5.32

- El mismo programa que la APK **1.5.31** ya instalada en el teléfono
  (código y recursos de ese paquete, no el árbol 1.5.13).
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
APKs sueltas en la raíz.

---

## Generar la APK

Requisitos: `zipalign`, `apksigner`, `keytool`, `python3`, `zip`, `unzip`.

```bash
# La APK de campo 1.5.32 no sale de la semilla: se empaquetó desde la
# 1.5.31 instalada. Este guion recompila el árbol de la semilla (1.5.13)
# y no debe sustituir dist/AVGUST-CARE-360-1.5.32-Android.apk.
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
