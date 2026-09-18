# AVGUST CARE 360

Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en
fincas de flores. Registra la visita técnica, evalúa criterios por capítulo,
documenta hallazgos con fotos, emite el informe (Word/PDF/Excel) y hace
seguimiento a los compromisos.

Desarrollado por **Kevin Villamizar**. Creado con la ayuda de **Wilson Castro**.

---

## Entregables (v1.5.5)

| Ruta | Contenido |
| --- | --- |
| [`dist/AVGUST-CARE-360-1.5.5-Android.apk`](./dist/AVGUST-CARE-360-1.5.5-Android.apk) | **Con marca Avgust.** |
| [`dist/CARE-360-1.5.5-sin-marca-Android.apk`](./dist/CARE-360-1.5.5-sin-marca-Android.apk) | Sin marca Avgust. |
| `enhance/src/` | Capa de mejoras (CSS/JS) que se inyecta sobre el APK base. |
| `tools/` | Compilación, firma, parches y demos de importación. |
| `tests/` | Prueba e2e del contenido web. |

Se instala encima de 1.4.x–1.5.4 firmadas con la misma clave (`tools/signing/`).

### Destacados 1.5.5

- **Seguimiento**: las fechas de revisión agendadas en la visita aparecen en Agenda / resumen (panel local, no el vacío de `/api/commitments`).
- Tras **borrar una versión** de informe, el borrador local ya no se abre solo como «Nueva visita técnica»; se limpia el borrador y «Nueva visita» parte limpio.
- Confirmación de borrado con **Borrar / Conservar** (sin el Cancelar nativo confuso).
- Al borrar finca también se eliminan visitas huérfanas y Métricas se refresca (1.5.4).
- Panel Importar e informe sin ventana azul en pantalla (1.5.4).

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
