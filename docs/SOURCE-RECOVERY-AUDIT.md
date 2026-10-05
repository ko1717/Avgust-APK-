# Auditoría de recuperación del código fuente

Fecha: 2026-10-05

## Resultado

La rama principal contiene una aplicación web empaquetada dentro de un APK semilla y una capa de mejoras JavaScript/CSS aplicada posteriormente.

No se encontró en el historial consultable un árbol fuente convencional de la aplicación (por ejemplo `src/`, `android/`, `capacitor.config.*`, `vite.config.*` o un `package.json` de la aplicación).

La evidencia histórica más importante es el commit `0b02554499c1d9bd2d351ec8dc0a92d556807d6c`, donde se documenta explícitamente que:

- `tools/base/capacitor-seed.apk` es el paquete Capacitor original.
- `tools/build-apk.sh` extrae `assets/public/*` desde esa semilla.
- `enhance/src/` se copia sobre el contenido extraído.
- Los `patch_*.py` modifican el bundle compilado.

Por tanto, el APK compilado no debe declararse como “código fuente” y no se debe convertir silenciosamente un bundle minificado en una falsa aplicación source-first.

## Decisión de ingeniería

La migración source-first queda bloqueada hasta recuperar al menos uno de estos artefactos:

1. El proyecto fuente original que generó el bundle Capacitor.
2. Un backup/ZIP del proyecto fuente.
3. Un repositorio histórico alternativo que contenga ese proyecto.
4. Como último recurso, autorización explícita para reconstruir manualmente una nueva aplicación source-first a partir del comportamiento observable del bundle. Esa reconstrucción sería una migración nueva, no recuperación del código original.

## Lo que sí está preservado

- APK de campo actual.
- Clave de firma y continuidad de versionCode.
- Capa `enhance/src/`.
- Reglas y matemáticas MIPE existentes.
- Pruebas E2E.
- Scripts de build y parches.
- Quality gate y herramientas Windows de diagnóstico.

## Regla

Mientras este documento esté marcado como bloqueado, ningún cambio de funcionalidad debe afirmar que la aplicación ya es source-first.

La definición de terminado será:

- checkout limpio;
- fuente de aplicación presente;
- build web reproducible desde fuente;
- build Android reproducible desde fuente;
- sin extracción de `capacitor-seed.apk`;
- sin parchear el bundle compilado para implementar funcionalidades;
- APK final firmada y verificable;
- pruebas de regresión aprobadas.

