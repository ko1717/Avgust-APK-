# AVGUST CARE 360

Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en
fincas de flores. Registra la visita técnica, evalúa criterios por capítulo,
documenta hallazgos con fotos, emite el informe (Word/PDF/Excel) y hace
seguimiento a los compromisos.

Desarrollado por **Kevin Villamizar**. Creado con la ayuda de **Wilson Castro**.

---

## Entregables (v1.5.6)

| Ruta | Contenido |
| --- | --- |
| [`dist/AVGUST-CARE-360-1.5.6-Android.apk`](./dist/AVGUST-CARE-360-1.5.6-Android.apk) | **Con marca Avgust.** |
| [`dist/CARE-360-1.5.6-sin-marca-Android.apk`](./dist/CARE-360-1.5.6-sin-marca-Android.apk) | Sin marca Avgust. |
| `enhance/src/` | Capa de mejoras (CSS/JS) que se inyecta sobre el APK base. |
| `tools/` | Compilación, firma, parches y demos de importación. |
| `tests/` | Prueba e2e del contenido web. |

Se instala encima de 1.4.x–1.5.5 firmadas con la misma clave (`tools/signing/`).

### Destacados 1.5.6

- **Métricas → Por finca**: solo datos de la finca seleccionada (filtro por nombre normalizado y `farmId`); se oculta el tablero nativo multi-finca.
- **Seguimiento** con agenda local y revisiones programadas (1.5.5).
- Borrador local ya no se abre solo tras borrar una versión; confirmación Borrar/Conservar (1.5.5).

---

## Estructura del repositorio

```
dist/                 ← APKs listos para instalar (solo la versión actual)
enhance/src/          ← capa de interfaz y experiencia
tools/
  base/               ← APK base Capacitor
  signing/            ← keystore de release
  demo/               ← CSV/Word de ejemplo + scripts de captura
  build-apk.sh        ← genera el APK
  patch_*.py          ← parches sobre el bundle compilado
tests/                ← e2e
```

Los APKs viven **solo en `dist/`** para no duplicar binarios en la raíz.

---

## Generar el APK

Requisitos: `zipalign`, `apksigner`, `keytool`, `python3`, `zip`, `unzip`.

```bash
# Con marca Avgust (por defecto → dist/AVGUST-CARE-360-1.5.2-Android.apk)
tools/build-apk.sh

# Sin marca Avgust
C360_DEBRAND=1 tools/build-apk.sh
```

Parámetros opcionales: `tools/build-apk.sh <apk-base> <version-name> <version-code>`.

### Vista previa sin instalar

```bash
tools/dev-preview.sh                 # http://localhost:8080
C360_DEBRAND=1 tools/dev-preview.sh  # sin marca
```

### Pruebas

```bash
cd tests && npm install && npm test   # requiere la vista previa en :8080
```

### Demos de importación

En `tools/demo/` hay CSV de 4 informes, el Word de Comercializadora Tucán y
scripts de verificación. Ver `tools/demo/README.md`.
