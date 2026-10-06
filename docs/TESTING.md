# Pruebas de AVGUST CARE 360

## Regla de seguridad

Las pruebas locales crean y modifican datos de prueba. Nunca apuntarlas a la base D1 o el bucket R2 de producción.

## Requisitos

- Node.js 22.16 o posterior. La edición Windows usa la API de respaldo de `node:sqlite` disponible desde esta versión.
- PowerShell 7 para la integración HTTP en Windows.
- Dependencias instaladas con `npm ci` o `npm install`.

## Comandos de validación

| Objetivo | Comando | Cobertura |
| --- | --- | --- |
| Tipos | `npx tsc --noEmit` | Contratos TypeScript. |
| Modelo | `node tests/model.mjs` | Visitas, criterios, lecturas estrictas, puntos porcentuales, tendencia neutral, gráfica lineal, compromisos, importación, exportaciones y el puente de archivos de Android con su reserva de descarga en el navegador. |
| Permisos, expediente y trazabilidad | `node tests/team.mjs` | Migraciones, cursor del expediente y métricas, comparación de visitas, otra finca bloqueada, invitaciones, roles, bitácora solo para coordinación, fotos privadas y conflictos. |
| Web compilada | `npm run build` | Build de cliente, RSC y rutas. |
| Escritorio | `npm run desktop:test` | SQLite local, solicitudes, visitas y respaldo/restauración. |
| Arranque de Windows | `npm run desktop:smoke` | Abre la aplicación sin mostrar la ventana y comprueba las funciones de la navegación, el logotipo, los datos locales, el puente de respaldo y que no aparezca inicio de sesión. |
| Recuperación central aislada | `npm run test:backup` | D1 local: exportación, eliminación y recuperación; R2 local: respaldo, eliminación y restauración comprobada por SHA-256. |
| Integración HTTP | Ver procedimiento siguiente | Autenticación local, auditoría, expediente y métricas paginadas, comparación, acceso directo a visita, conflicto, origen, fotos y acciones. |

## Integración HTTP local

1. En una terminal, ejecutar `npm run dev`.
2. Esperar el mensaje `Sites local sign-in` y la URL local.
3. En otra terminal, ejecutar:

   ```powershell
   pwsh -File tests/integration.ps1
   ```

`vinext dev` provee la ruta de inicio de sesión simulada. No usar `wrangler dev --config dist/server/wrangler.json` para este script: sirve el Worker compilado, pero no incluye `/signin-with-chatgpt`.

Si `.wrangler/state` ya existía antes de una migración, aplique el SQL pendiente antes de iniciar `npm run dev`. El comando exacto y la regla para una base local nueva están en `DATABASE.md`; de otro modo una ruta que use una tabla recién migrada fallará aunque el código compile.

## Verificación móvil y de Android

Con `npm run dev` en marcha se comprobó, con sesión iniciada y un lienzo de 412 × 915, que el editor de visita queda en una columna, que la barra de guardado se fija al borde inferior sin duplicar el botón del panel lateral, que las opciones Sí, No y No aplica miden 46 px de alto, que **Tomar foto** declara `accept="image/*"` con `capture="environment"` y **Elegir de la galería** conserva la lista restringida, y que la impresión a PDF queda bloqueada con su aviso cuando el puente nativo está presente.

`node tests/model.mjs` cubre el troceado en base64, el reensamblado exacto del archivo, el descarte por error de escritura, la falta de espacio y el fallo al abrir el menú del sistema.

El APK se compila con `npm run android:apk`, apoyado en la cadena de herramientas local que prepara `npm run android:toolchain`. El manifiesto del paquete generado se revisó con `apkanalyzer`: declara solo `INTERNET`, incluye la consulta del intento de captura y no declara `CAMERA`.

Queda pendiente y es obligatorio antes de repartir el APK: ejecutar el guion de `PILOT.md` en un teléfono real con cuenta autorizada. La emulación no prueba la aplicación de cámara del dispositivo, el menú de compartir de Android ni el retorno del proveedor de identidad al WebView.

## Criterio para cambios de fase

Todo cambio de lógica debe ejecutar al menos tipos, la prueba de modelo relacionada y la de permisos si toca rutas o datos compartidos. Un cambio de esquema debe ejecutar las pruebas de equipo porque cargan las migraciones reales en SQLite en memoria. Para cambios visuales críticos, añadir una comprobación manual en escritorio, tablet y móvil antes de declarar la fase completada.

## Estado conocido del lint

`npm run lint` pasa con cero errores. Las excepciones inevitables de Electron CommonJS, Vinext, controles compuestos y el doble de prueba están limitadas por archivo y justificadas en `docs/LINT_POLICY.md`; no hay desactivaciones globales.

## Respaldo y restauración

El procedimiento operativo, el alcance de cada modalidad y la prueba local aislada están en `docs/BACKUP_AND_RESTORE.md`. La prueba automática nunca ejecuta operaciones remotas de Cloudflare.

## Compromisos y seguimiento

Después de cambiar el flujo de seguimiento, ejecutar `node tests/team.mjs`. La prueba carga todas las migraciones en SQLite en memoria y comprueba cursor, acceso por finca, cierre sin evidencia obligatoria, actor y fecha de cierre, reapertura, cancelación y eventos de auditoría. Como no hay cambio de esquema, `npm run test:backup` confirma que los payloads ampliados siguen pasando por el respaldo existente.

## Métricas históricas

Después de cambiar el historial o comparador, ejecutar `node tests/model.mjs`, `node tests/team.mjs`, `pwsh -NoProfile -File tests/integration.ps1` y `npm run desktop:test`. La prueba de permisos usa 180 visitas de prueba para medir una página de historial; no reemplaza una medición autorizada sobre D1 remoto. El contrato, límites y revisión visual pendiente están en `docs/PHASE6_METRICS_AND_COMPARISON.md`.
