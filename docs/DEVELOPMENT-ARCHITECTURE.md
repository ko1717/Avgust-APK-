# AVGUST CARE 360 — Arquitectura de desarrollo Windows

## Estado real al 05-10-2026

Se recuperó e integró el proyecto fuente de `D:\WILSON\avgust-care`, versión 1.5.35. Este checkout contiene ahora `app/`, `lib/`, `db/`, `android/`, `desktop/`, `public/`, `tests/` y el pipeline de Capacitor/Electron.

La integración recupera la fuente y ya se validó con build web, pruebas principales, smoke de Windows y APK Android debug desde este checkout. Todavía no certifica un release: faltan resolver avisos de dependencias y lint, comparar con la APK 1.5.32 y verificar una firma/versionCode de producción.

El flujo anterior (`tools/base/capacitor-seed.apk`, `build.js`, `tools/build-apk.sh` y `enhance/src/`) se conserva por compatibilidad y comparación. No es la arquitectura principal ni debe usarse para desarrollar nuevas funcionalidades.

## Regla de ingeniería

> El código fuente es la fuente de verdad. El APK es un artefacto de salida.

Por tanto:

- No implementar nuevas funcionalidades editando un APK.
- Usar `app/`, `lib/` y los adaptadores de `android/` y `desktop/` como fuente principal.
- Mantener `enhance/src` como referencia hasta comparar y migrar sus mejoras relevantes a la aplicación fuente.
- Mantener la APK 1.5.32 como referencia de regresión hasta que la nueva compilación sea equivalente.
- No tocar claves de firma ni versionCode de producción sin una decisión explícita de release.

## Arquitectura actual

```
app/                       # UI, features y rutas web
lib/                       # modelo, validación, persistencia y exportación
db/ drizzle/               # esquema y migraciones
android/                   # wrapper Capacitor
desktop/                   # aplicación Electron para Windows
public/                    # recursos locales y enhancements cargados por la UI
tests/
tools/
docs/
```

La separación de responsabilidades objetivo es:

1. **Core**: reglas MIPE, modelos y cálculos.
2. **Features**: módulos funcionales.
3. **UI**: componentes y diseño responsive.
4. **Storage**: persistencia offline/sincronización.
5. **Platform**: Android/Windows/PWA.
6. **Tests**: pruebas unitarias, integración y E2E.
7. **Build**: una única tubería reproducible que produzca APK/PWA.

## KPI / Centro de Inteligencia MIPE

El rediseño de métricas ya tiene piezas reutilizables en `enhance/src/metrics/`. La migración debe conservar las matemáticas oficiales y mejorar la presentación, no alterar ponderaciones sin auditoría.

La capa ejecutiva debe priorizar:

- MIPE Health Score.
- Cumplimiento y cobertura.
- Tendencia y delta vs periodo anterior.
- Brecha contra meta.
- Riesgo por severidad × impacto.
- Acciones prioritarias.
- Benchmark entre fincas cuando exista una base comparable.
- Calidad/confiabilidad del dato.

## Windows como estación principal

El proyecto fuente requiere Node 22.16 o posterior, versión necesaria para la API de respaldo SQLite de la edición Windows. Los comandos documentados son:

```powershell
npm ci
npm run desktop:build
npm run dev
```

La APK se genera con `npm run android:apk`, únicamente después de ejecutar las pruebas y verificar la identidad de firma y el versionCode de release.

## Criterio de finalización de la migración

La fuente principal ya está presente. La migración se considera completa para release cuando:

- una instalación limpia compila desde este checkout sin depender de un APK seed;
- las pruebas unitarias, integración y smoke pasan contra esa compilación;
- se compara funcionalmente contra 1.5.32;
- se verifica la firma, el versionCode y el artefacto Android;
- las mejoras relevantes de `enhance/src` están portadas o descartadas con justificación.

La validación se ejecuta con un Node 22.16 aislado en este entorno. El resultado y los pendientes de calidad están detallados en `SOURCE-RECOVERY-AUDIT.md`.
