# AVGUST CARE 360

Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en
fincas de flores. Registra la visita técnica, evalúa criterios por capítulo,
documenta hallazgos con fotos, emite el informe (Word/PDF/Excel) y hace
seguimiento a los compromisos.

Desarrollado por **Kevin Villamizar**. Creado con la ayuda de **Wilson Castro**.

---

## Una sola APK

Este repositorio publica **una única APK**. Las versiones anteriores
(1.1.0-rc.5 hasta 1.5.30, y las variantes sin marca) están **retiradas**.
No se instalan ni se vuelven a subir.

| Instalar esto | No instalar esto |
| --- | --- |
| [`dist/AVGUST-CARE-360-1.5.31-Android.apk`](./dist/AVGUST-CARE-360-1.5.31-Android.apk) | Cualquier APK suelta en la raíz, `tools/base/`, u otra rama |

En la cabecera de la app debe verse **v1.5.31**. Se instala encima de 1.4.x–1.5.30
firmadas con la misma clave (`tools/signing/`).

`tools/base/capacitor-seed.apk` **no es una versión para campo**: es solo la
semilla Capacitor con la que se recompila. Nadie del equipo debe instalarla.

---

## Qué incluye 1.5.31

- El KPI **Mediciones y pesaje** solo usa respuestas SI/NO de **2.1–2.8**.
  El pH, la dureza, la presión y el 4.1 (pesar en campo) son del capítulo 4 o 5:
  alimentan **Mezclas**, no este recuadro. Si el periodo no tiene 2.x, el
  recuadro dice **Sin evaluar** (no un porcentaje inventado).
- «Nueva visita» deja marcado el capítulo 2 (el catálogo compilado sí tiene
  esos 8 criterios). Hay que responder Sí cumple / No cumple para que salga %.
  El capítulo 1 (almacén) sigue opcional. No se fuerzan los cinco capítulos.
- Incluye 1.5.30: si hay 2.x, se guardan sin rellenar 1–5 vacíos.
- Incluye 1.5.28–1.5.26: KPI de periodo, Primera vs Última visita y Word.

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
# Publica dist/AVGUST-CARE-360-1.5.31-Android.apk y retira cualquier otra
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
