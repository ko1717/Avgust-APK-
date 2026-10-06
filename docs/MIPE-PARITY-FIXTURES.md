# MIPE Parity Fixtures

Estas pruebas congelan casos de referencia del motor oficial existente en `enhance/src/care360-metrics.js`.

## Casos protegidos
1. Los 37 criterios en SI producen 100 puntos.
2. Los 37 criterios en NO producen 0 puntos.
3. Una auditoría parcial de capítulos 2 y 5 normaliza el resultado únicamente sobre el peso auditado.
4. Los pesos oficiales permanecen 5/30/5/30/30.

## Resultado esperado del fixture parcial
Con capítulo 2 = 50% y capítulo 5 = 66,7%:
- puntos obtenidos: 35,0;
- peso auditado: 0,60;
- weightedScore normalizado: 58,3.

Estas pruebas protegen la aritmética antes de conectar el nuevo ViewModel a la UI productiva.

## Nota
La validación final de parity debe ejecutarse también contra fixtures reales exportados del flujo productivo. Este archivo protege los casos matemáticos canónicos y no reemplaza esa validación de integración.