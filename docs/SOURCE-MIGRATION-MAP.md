# Mapa de migración source-first — AVGUST CARE 360

## Objetivo

Convertir la aplicación actual en una arquitectura mantenible donde el código fuente sea la única fuente de verdad. La APK pasa a ser únicamente un artefacto de release.

## Componentes identificados

| Componente actual | Función | Destino |
|---|---|---|
| `enhance/src/care360-metrics.js` | Centro de Inteligencia MIPE, catálogo oficial y cálculo de indicadores | `src/features/metrics/` |
| `enhance/src/care360-experience.js` | Back Android/Cordova, navegación, cambios sin guardar, conectividad y recuperación | `src/platform/mobile/` + `src/app/` |
| `enhance/src/care360-ops.js` | Evaluación operativa de auditorías y respuestas SI/NO/NA | `src/features/audits/` |
| `enhance/src/care360-pro.js` | Capa profesional, estados y validaciones de UX | `src/features/field/` |
| `enhance/src/care360-presentation.js` | Presentación y versionado de la interfaz | `src/app/presentation/` |
| `enhance/src/care360-import.js` | Importación de información | `src/features/import/` |
| `enhance/src/colombia-geo.js` | Catálogo/geografía de Colombia | `src/data/geo/` |
| `enhance/src/*.css` | Estilos de experiencia actuales | `src/styles/` por dominio |
| `tools/patch_*.py` | Parches sobre bundle compilado | Eliminar gradualmente; su lógica debe vivir en fuente |
| `tools/base/capacitor-seed.apk` | Semilla histórica | Eliminar del pipeline cuando exista build Android real |

## Arquitectura objetivo

```
src/
  app/
  components/
  features/
    audits/
    metrics/
    field/
    reports/
    followup/
    import/
  data/
    mipe/
    geo/
  platform/
    mobile/
    windows/
  services/
    api/
    offline/
  styles/
android/ o capacitor/
  ...
tests/
```

## Reglas de migración

1. No copiar el bundle minificado como si fuera fuente original.
2. Migrar primero lógica determinista y testeable: catálogo MIPE, scoring, estados y validaciones.
3. Separar presentación de cálculo.
4. El cálculo MIPE debe tener pruebas unitarias independientes del DOM.
5. La capa móvil no debe depender de selectores CSS de una aplicación compilada.
6. La persistencia offline debe tener un adaptador explícito.
7. La API/Firebase debe consumirse mediante servicios tipados, no desde componentes.
8. Ningún KPI nuevo puede alterar silenciosamente el indicador oficial de 100 puntos; los KPIs gerenciales deben ser una capa complementaria.
9. El build Android final no debe extraer `capacitor-seed.apk`.

## Orden de ejecución

### Etapa A — núcleo
- Recuperar o reconstruir el contrato de datos.
- Extraer catálogo MIPE y ponderaciones a módulos puros.
- Crear pruebas unitarias para 37 criterios y 5 capítulos.
- Separar score oficial de KPIs gerenciales.

### Etapa B — aplicación
- Reconstruir navegación y módulos desde fuente.
- Integrar auditorías, visitas, seguimiento y reportes.
- Incorporar offline-first.

### Etapa C — plataforma
- Capacitor/Android desde proyecto fuente.
- Windows/PWA desde el mismo frontend.
- Back físico, ciclo de vida, recuperación y conectividad como adaptadores de plataforma.

### Etapa D — release
- Build reproducible.
- Tests E2E.
- Verificación de firma y versionCode.
- Generación de una única APK en `dist/`.

## Criterio de aceptación

La migración no se considera terminada mientras `tools/build-apk.sh` necesite extraer `capacitor-seed.apk` para producir la aplicación.
