# Política de lint

`npm run lint` es una puerta de calidad para código propio, accesibilidad, tipos y hooks. Las correcciones se hacen por módulo; no se usa una desactivación global para obtener un resultado verde.

## Excepciones limitadas

| Alcance | Regla | Motivo |
| --- | --- | --- |
| `desktop/**/*.cjs`, `tests/desktop-store.cjs` | `typescript/no-require-imports` | Electron se empaqueta con CommonJS (`main`, `preload`, almacén local y su prueba) y carga el almacén generado con `require`. Cambiar estos puntos a ESM alteraría el arranque de Windows sin beneficio funcional. |
| `enhance/src/**/*.js`, `public/enhance/**/*.js` | `no-var` | La capa de mejoras se conserva como JavaScript independiente del bundle principal. Cambiar en bloque sus variables `var` a `let` puede cambiar el alcance de funciones y cierres; los cambios nuevos se implementan en los módulos TypeScript de la aplicación. Las demás reglas siguen activas. |
| `app/**/*.tsx` | reglas `next/*` de imagen, enlace y variable `module` | CARE 360 usa Vinext/Vite, no el runtime ni los componentes `next/image` y `next/link`. Las imágenes se obtienen desde rutas privadas y el enlace de sesión apunta al proveedor de Sites. Las reglas permanecen activas fuera de esta capa. |
| `tests/model.mjs` | `typescript/no-deprecated` | El test instala un DOM mínimo para comprobar la generación de Word; no invoca una API de interfaz de producción. |
| `app/metrics-panel.tsx`, `app/followup.tsx`, `app/workspace.tsx` | asociación de `label` en selectores compuestos | Los `SelectTrigger` de Base UI reciben un nombre accesible explícito (`aria-label`); el linter no reconoce ese control compuesto como control etiquetable por el `label` visual. Los `label` que contienen `input` o `textarea` permanecen asociados de forma nativa. |
| `app/metrics-panel.tsx`, `app/consolidated-metrics.tsx`, `app/followup.tsx`, `app/workspace.tsx` | preferencia de etiqueta para `role=status` y tipos de payload de Recharts | Los avisos de carga conservan `role=status`, y los valores de Recharts se muestran solo como valores de gráfico. Son patrones semánticos válidos; la regla propone una etiqueta alternativa, no detecta una ausencia de anuncio. |
| `app/team-panel.tsx`, `app/workspace.tsx` | inicialización React | La carga inicial consulta persistencia externa una vez al montar. El código programa o captura esa carga; no deriva estado de otras variables de render ni crea un ciclo de actualización. |
| `app/workspace.tsx` | conversión de campos conocidos y orden actual de capítulos | Los campos que se presentan son escalares del `Visit`; los capítulos vigentes son 1–5. Esta excepción no se debe extender a datos nuevos: al añadir un capítulo de dos dígitos o un campo no escalar se corregirá la expresión y se retirará. |

Cada excepción está delimitada en `.oxlintrc.json`; todas las demás reglas siguen activas fuera del caso expresamente documentado.
