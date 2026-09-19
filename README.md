# AVGUST CARE 360

Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en
fincas de flores. Registra la visita técnica, evalúa criterios por capítulo,
documenta hallazgos con fotos, emite el informe (Word/PDF/Excel) y hace
seguimiento a los compromisos.

Desarrollado por **Kevin Villamizar**. Creado con la ayuda de **Wilson Castro**.

---

## Una sola APK

Este repositorio publica **una única APK**. Las versiones anteriores
(1.1.0-rc.5 hasta 1.5.14, y las variantes sin marca) están **retiradas**.
No se instalan ni se vuelven a subir.

| Instalar esto | No instalar esto |
| --- | --- |
| [`dist/AVGUST-CARE-360-1.5.15-Android.apk`](./dist/AVGUST-CARE-360-1.5.15-Android.apk) | Cualquier APK suelta en la raíz, `tools/base/`, u otra rama |

En la cabecera de la app debe verse **v1.5.15**. Se instala encima de 1.4.x–1.5.14
firmadas con la misma clave (`tools/signing/`).

`tools/base/capacitor-seed.apk` **no es una versión para campo**: es solo la
semilla Capacitor con la que se recompila. Nadie del equipo debe instalarla.

---

## Qué incluye 1.5.15

- Métricas: los **5 capítulos MIPE** en una sola gráfica de barras, con leyenda (Saludable / Aceptable / Crítico / Sin medición / Meta 80%).
- Al tocar un capítulo se ve el catálogo completo de subcapítulos, con la misma barra.
- Informe Word y vista previa: tablas de mediciones debajo de 4.6, 5.1, 5.3 y 5.6.
- **Borrar visita**, **versión de informe**, **solicitud** y **finca**.
- Panel **Calidad de la visita** fijo, modo oscuro y modo lector (☀).
- Seguimiento compacto, agenda en vivo y métricas Por finca sin mezclar.

---

## Estructura

```
dist/                 ← única APK instalable (versión actual)
enhance/src/          ← capa de interfaz y experiencia
tools/
  base/               ← semilla de compilación (no instalar)
  signing/            ← keystore de release
  demo/               ← CSV/Word de ejemplo + scripts de captura
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
# Publica dist/AVGUST-CARE-360-1.5.15-Android.apk y retira cualquier otra
tools/build-apk.sh
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

### Demos de importación

Ver `tools/demo/README.md`.
