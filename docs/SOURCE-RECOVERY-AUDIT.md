# Auditoría de recuperación del código fuente

Fecha: 2026-10-05

## Resultado

El proyecto original se encontró en `D:\WILSON\avgust-care`. Contiene el código fuente de AVGUST CARE 360 1.5.35 para web, Electron/Windows y Capacitor/Android, junto con sus migraciones y pruebas.

Se integraron en este checkout los archivos fuente y las modificaciones locales presentes en esa carpeta. No se copiaron `node_modules`, builds generados, APKs ni el historial Git externo. La capa previa `enhance/src/` y sus pruebas se conservaron para comparar y migrar mejoras selectivamente.

La auditoría histórica del commit `0b02554499c1d9bd2d351ec8dc0a92d556807d6c` sigue describiendo correctamente el pipeline antiguo:

- `tools/base/capacitor-seed.apk` es el paquete Capacitor original.
- `tools/build-apk.sh` extrae `assets/public/*` desde esa semilla.
- `enhance/src/` se copia sobre el contenido extraído.
- Los `patch_*.py` modifican el bundle compilado.

Este pipeline queda como referencia histórica, no como build principal del código recuperado.

## Estado de validación

La fuente se validó en este checkout con Node 22.16:

- `npm ci`, `npx tsc --noEmit` y `npm run build` pasan.
- `tests/model.mjs`, `tests/team.mjs` y las 9 pruebas unitarias de scoring/KPIs pasan.
- La evolución por finca y el documento Word incluyen el puntaje ponderado heredado como complemento; la regresión comprueba que el indicador oficial sigue en 33% cuando el ponderado es 14.3%.
- Las regresiones de matemáticas MIPE, benchmark, riesgos, acciones y command center pasan.
- `npm run desktop:test` y `npm run desktop:smoke` pasan.
- `npm run android:apk` genera correctamente un APK **debug** desde el proyecto fuente.
- Oxlint pasa para la aplicación TypeScript (`app`, `components`, `lib`, `db`, `desktop`) y las pruebas principales.

Quedan pendientes antes de afirmar que el programa está listo al 100% o publicar una versión:

- El lint completo todavía reporta 145 errores en scripts JS heredados y pruebas antiguas, sobre todo variables sin uso y promesas sin manejar.
- Las pruebas E2E de la capa antigua no se ejecutaron; requieren instalar Puppeteer y su servidor de vista previa.
- `npm audit --omit=dev` reporta 18 vulnerabilidades de dependencias de producción (1 crítica, 15 altas y 2 moderadas); no se aplicaron actualizaciones automáticas.
- Falta comparar la aplicación contra la APK 1.5.32, probar en dispositivos reales y verificar firma/versionCode de release.

El build web y el APK Android de depuración son reproducibles; esto no certifica aún equivalencia funcional ni una APK firmada para distribución.
