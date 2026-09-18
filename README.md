# AVGUST CARE 360

Programa de acompañamiento en campo para el aseguramiento del proceso MIPE en
fincas de flores. Registra la visita técnica, evalúa criterios por capítulo,
documenta hallazgos con fotos, emite el informe (Word/PDF/Excel) y hace
seguimiento a los compromisos.

Desarrollado por **Kevin Villamizar**. Creado con la ayuda de **Wilson Castro**.

---

## Entregable (v1.5.13)

| Ruta | Contenido |
| --- | --- |
| [`dist/AVGUST-CARE-360-1.5.13-Android.apk`](./dist/AVGUST-CARE-360-1.5.13-Android.apk) | **Única APK publicada** (marca Avgust). |
| `enhance/src/` | Capa de mejoras (CSS/JS) que se inyecta sobre el APK base. |
| `tools/` | Compilación, firma, parches y demos de importación. |
| `tests/` | Prueba e2e del contenido web. |

Se instala encima de 1.4.x–1.5.12 firmadas con la misma clave (`tools/signing/`).

### Destacados 1.5.13

- El panel **Calidad de la visita** se queda en su sitio (ya no tapa Departamento / Municipio al escribir).
- Modo oscuro y modo lector (☀) con mejor contraste en capítulos, selectores, pasos e informe.

### Destacados 1.5.12

- **Seguimiento** sin el muro de tarjetas de hallazgos: resumen compacto con KPIs; compromisos en la lista nativa (más clara en móvil).
- Al **borrar una solicitud**, desaparece de Agenda/Seguimiento de inmediato.
- Agenda rediseñada (fichas con fecha y estado).

### Destacados previos

- Agenda y revisión en vivo (visitas + solicitudes).
- Una sola APK en `dist/`; métricas Por finca sin mezclar.

---

## Estructura del repositorio

```
dist/                 ← una sola APK (versión actual)
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
# Con marca Avgust (por defecto → dist/AVGUST-CARE-360-1.5.13-Android.apk)
tools/build-apk.sh

# Sin marca Avgust (solo si se necesita; deja esa variante como única en dist/)
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

Ver `tools/demo/README.md`.
