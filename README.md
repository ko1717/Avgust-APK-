# AVGUST CARE 360

Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en
fincas de flores. Registra la visita técnica, evalúa criterios por capítulo,
documenta hallazgos con fotos, emite el informe (Word/PDF/Excel) y hace
seguimiento a los compromisos.

Desarrollado por **Kevin Villamizar**. Creado con la ayuda de **Wilson Castro**.

---

## Una sola APK

Este repositorio publica **una única APK**. Las versiones anteriores
(1.1.0-rc.5 hasta 1.5.18, y las variantes sin marca) están **retiradas**.
No se instalan ni se vuelven a subir.

| Instalar esto | No instalar esto |
| --- | --- |
| [`dist/AVGUST-CARE-360-1.5.19-Android.apk`](./dist/AVGUST-CARE-360-1.5.19-Android.apk) | Cualquier APK suelta en la raíz, `tools/base/`, u otra rama |

En la cabecera de la app debe verse **v1.5.19**. Se instala encima de 1.4.x–1.5.18
firmadas con la misma clave (`tools/signing/`).

`tools/base/capacitor-seed.apk` **no es una versión para campo**: es solo la
semilla Capacitor con la que se recompila. Nadie del equipo debe instalarla.

---

## Qué incluye 1.5.19

- **Métricas · jerarquía más clara**: hero con Indicador + KPIs laterales; menos ruido de comparación duplicada; Qué atender más compacto; Evolución sigue en línea; Capítulos y subcapítulos con tipografía/espacio propios.
- **Capítulos vs Subcapítulos con significado distinto** cuando hay historial:
  - Capítulos = indicador del capítulo (última visita en Por finca; periodo ponderado en Todas).
  - Subcapítulos = promedio de cumplimiento **por criterio en todo el periodo**.
- Misma definición en el **informe**, peek y panel de detalle.
- Incluye lo de 1.5.18: Evolución en línea en informe y app, tabla Capítulos, borrar visita/solicitud/finca, modo oscuro/lector.

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
# Publica dist/AVGUST-CARE-360-1.5.19-Android.apk y retira cualquier otra
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
