# AVGUST CARE 360 — Arquitectura de desarrollo Windows

## Estado real al 05-10-2026

La rama `main` contiene una capa de experiencia amplia y un Centro de Inteligencia MIPE, pero **no contiene el árbol fuente principal de la aplicación** (`src/`, `android/` o un proyecto Capacitor completo).

La aplicación actual se recompone mediante:

```
tools/base/capacitor-seed.apk
        ↓
build.js / tools/build-apk.sh
        ↓
enhance/src/*
        ↓
APK final
```

Esto es válido como mecanismo de compatibilidad/release, pero **no debe seguir siendo la arquitectura de desarrollo**.

## Regla de ingeniería

> El código fuente es la fuente de verdad. El APK es un artefacto de salida.

Por tanto:

- No implementar nuevas funcionalidades editando un APK.
- No usar `tools/base/capacitor-seed.apk` como sustituto del código fuente.
- Mantener `enhance/src` temporalmente como capa de transición.
- Recuperar/importar el proyecto fuente real que produjo la aplicación 1.5.x.
- Migrar progresivamente las funcionalidades de `enhance/src` al árbol fuente.
- Mantener la APK 1.5.32 como referencia de regresión hasta que la nueva compilación sea equivalente.
- No tocar claves de firma ni versionCode de producción sin una decisión explícita de release.

## Objetivo de arquitectura

```
app/
  src/
    core/
    features/
      visits/
      farms/
      metrics/
      followup/
      reports/
      import/
    ui/
    services/
    storage/
    platform/
  android/                 # proyecto nativo Capacitor
  public/

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

El desarrollo diario debe poder ejecutarse desde PowerShell con:

```powershell
npm install
npm run doctor
npm run dev
```

El APK se genera únicamente después de pasar pruebas y desde una fuente reproducible.

## Criterio de finalización de la migración

La arquitectura no se considera fuente-first hasta que:

- exista el árbol fuente principal;
- una instalación limpia pueda compilar sin depender de un APK seed;
- los tests E2E funcionen contra esa compilación;
- la APK resultante conserve identidad/firma cuando corresponda;
- se compare funcionalmente contra 1.5.32;
- se retire la dependencia de parches sobre bundle compilado.
