# AUDITORÍA ADVERSARIAL DE MÉTRICAS MIPE
> **Auditoría histórica:** este documento evalúa el motor anterior de `enhance`, que ya no se carga. No describe la implementación vigente de métricas en `lib/model.ts` y `lib/metric-analysis.ts`.

**AVGUST CARE 360 · Centro de Inteligencia MIPE**
*Informe de Auditoría Independiente, Estrés Matemático y Análisis Adversarial*

**Fecha:** 2026-10-05  
**Tipo de Auditoría:** Adversarial de Caja Blanca (Solo Auditoría · Sin Modificaciones de Código)  
**Alcance:** `tools/build_metrics_module.py`, `enhance/src/care360-metrics.js`, `dist/assets/index-DLowqfUy.js`  
**Estado General:** **PASS WITH WARNINGS** (Fórmulas e invariantes aprobados; 2 observaciones menores de robustez defensiva identificadas para fase posterior)  

---

## 1. Resultado General

### **PASS WITH WARNINGS**
El motor matemático implementado en `tools/build_metrics_module.py` y `enhance/src/care360-metrics.js` **cumple con los principios de integridad agronómica y matemática**:
- Nunca otorga 100% a capítulos sin evaluar.
- Separa estrictamente los Puntos MIPE Ganados ($0.0$ a $100.0$ pts) del Cumplimiento de Criterios ($0.0\%$ a $100.0\%$).
- Excluye respuestas `NA` y preguntas sin respuesta del denominador.
- Prioriza auditorías completas en el ranking sobre auditorías parciales.
- No inventa datos en meses sin visitas.
- No muta el estado base durante simulaciones.

Se emiten advertencias técnicas menores (Warnings) relacionadas con:
1. **Deduplicación a nivel de array de visitas:** Si el backend o el servicio de sincronización entrega dos objetos idénticos con el mismo `id`, el conteo absoluto de hallazgos se duplica, aunque las proporciones porcentuales permanecen invariantes.
2. **Defensa contra inyección en Simulador:** Los sliders HTML tienen `min="0"` y `max="100"`, pero el cálculo aritmético interno de `renderSimulatorTab` asume implícitamente valores en $[0, 100]$ sin un clamp explícito `Math.max(0, Math.min(100, v))`.

---

## 2. Reconstrucción de Fórmulas desde el Código Fuente

A continuación se documentan las fórmulas extraídas directamente del código ejecutable (`enhance/src/care360-metrics.js`):

### 2.1 Puntos MIPE Ganados ($P_{\text{MIPE}}$)
* **Código:** `tools/build_metrics_module.py` (Líneas 163–175 y 298–315)
* **Variables:**
  - $w_i \in \{0.05, 0.30, 0.05, 0.30, 0.30\}$
  - $\text{MaxPts}_i = w_i \times 100 \in \{5.0, 30.0, 5.0, 30.0, 30.0\}$
  - $pos_i = \text{conteo}(\text{respuestas}_i = \text{"SI"})$
  - $app_i = \text{conteo}(\text{respuestas}_i \in \{\text{"SI"}, \text{"NO"}\})$
* **Fórmula Reconstruida:**
  $$P_i = \begin{cases} \left( \frac{pos_i}{app_i} \right) \times \text{MaxPts}_i & \text{si capítulo } i \text{ está incluido} \land app_i > 0 \\ 0.0 & \text{en cualquier otro caso} \end{cases}$$
  $$P_{\text{MIPE}} = \sum_{i=1}^5 P_i$$
* **Comportamiento:** Si $app_i = 0$, $P_i = 0.0$. La puntuación máxima teórica es $100.0$ pts.

### 2.2 Cumplimiento sobre lo Evaluado ($C_{\text{eval}}$)
* **Código:** `tools/build_metrics_module.py` (Líneas 321–324)
* **Variables:**
  - $totalEvaluatedApp = \sum_{i \in \text{Eval}} app_i$
  - $totalEvaluatedPos = \sum_{i \in \text{Eval}} pos_i$
* **Fórmula Reconstruida:**
  $$C_{\text{eval}} = \begin{cases} \frac{totalEvaluatedPos}{totalEvaluatedApp} \times 100 & \text{si } totalEvaluatedApp > 0 \\ \text{null (Sin evaluar)} & \text{si } totalEvaluatedApp = 0 \end{cases}$$
* **Comportamiento:** Excluye criterios no evaluados y criterios `NA`. Mide estrictamente el porcentaje de éxito en las preguntas auditadas.

### 2.3 Desempeño Ponderado sobre lo Evaluado ($D_{\text{pond}}$)
* **Código:** `tools/build_metrics_module.py` (Líneas 326–329)
* **Variables:**
  - $totalPointsEarned = P_{\text{MIPE}}$
  - $totalAuditedWeight = \sum_{i \in \text{Eval}} w_i$
* **Fórmula Reconstruida:**
  $$D_{\text{pond}} = \begin{cases} \frac{totalPointsEarned}{totalAuditedWeight} & \text{si } totalAuditedWeight > 0 \\ \text{null (Sin evaluar)} & \text{si } totalAuditedWeight = 0 \end{cases}$$
* **Comportamiento:** Mide la fracción ponderada alcanzada dentro de la porción auditada del protocolo.

### 2.4 Cobertura de Capítulos ($Cov_{\text{cap}}$)
* **Código:** `tools/build_metrics_module.py` (Líneas 312 y 549)
* **Fórmula Reconstruida:**
  $$Cov_{\text{cap}} = \text{evaluatedChaptersCount} \quad (0 \le N \le 5)$$
  Visualizado como: `$N/5\text{ Caps}$`.

### 2.5 Cobertura Ponderada del Protocolo ($Cov_{\text{pond}}$)
* **Código:** `tools/build_metrics_module.py` (Líneas 331 y 550)
* **Fórmula Reconstruida:**
  $$Cov_{\text{pond}} = \left( \sum_{i \in \text{Eval}} w_i \right) \times 100$$
  Visualizado como: `${coveragePct}\% \text{ del peso oficial auditado}$`.

### 2.6 Índice de Riesgo de Criterio ($R_{\text{crit}}$)
* **Código:** `tools/build_metrics_module.py` (Líneas 333–345)
* **Variables:**
  - $\text{failRate} = \frac{\text{findings}}{\text{applicable}}$
  - $\text{sevWeight} \in \{1, 2, 3\}$ (Medium: 1, High: 2, Critical: 3)
  - $w_{\text{cap}} \in \{0.05, 0.30\}$
* **Fórmula Reconstruida:**
  $$R_{\text{crit}} = \text{round}\left( \text{failRate} \times \text{sevWeight} \times w_{\text{cap}} \times 100 \right)$$
* **Filtro:** Excluye criterios donde $\text{occurrences} = 0$. Rango acotado: $[0.0, 90.0]$.

### 2.7 Ranking Comparativo de Fincas
* **Código:** `tools/build_metrics_module.py` (Líneas 386–402)
* **Algoritmo de Orden:**
  1. Clave primaria: `isFullyEvaluated` (boolean: $5/5$ capítulos antes que auditorías parciales).
  2. Clave secundaria: `globalPoints` descendente ($P_{\text{MIPE}}$ acumulado).
  3. Clave terciaria: `criteriaCompliance` descendente ($C_{\text{eval}}$).
  4. Desempate determinista: `a.farm.localeCompare(b.farm, "es")` (alfabético).

### 2.8 Tendencia Temporal (Timeline)
* **Código:** `tools/build_metrics_module.py` (Líneas 347–361)
* **Fórmula Reconstruida:**
  Para cada mes $m \in \text{Keys}(\text{monthlyMap})$:
  $$\text{score}_m = \frac{\sum_{v \in V_m} \text{criteriaCompliance}_v}{|V_m|}$$
* **Comportamiento:** Solo incluye meses con auditorías evaluadas. Meses sin datos no se registran (no se inyecta 0% ni 100%).

### 2.9 Simulador de Impacto (What-If)
* **Código:** `tools/build_metrics_module.py` (Líneas 1115–1123)
* **Fórmula Reconstruida:**
  $$S_{\text{sim}} = \sum_{i=1}^5 \left( \text{simValues}_i \times w_i \right)$$
  $$\Delta_{\text{impacto}} = S_{\text{sim}} - P_{\text{MIPE}}$$

---

## 3. Auditoría de los 100 Puntos Oficiales

Verificación directa en el código fuente de `CHAPTER_WEIGHTS`:
```javascript
var CHAPTER_WEIGHTS = {
  1: 0.05, // Cap 1: 5.0 pts
  2: 0.30, // Cap 2: 30.0 pts
  3: 0.05, // Cap 3: 5.0 pts
  4: 0.30, // Cap 4: 30.0 pts
  5: 0.30, // Cap 5: 30.0 pts
};
```
* **Cálculo de suma:**
  $$0.05 + 0.30 + 0.05 + 0.30 + 0.30 = 1.0000000000000000$$
* **Verificación de precisión IEEE 754:**
  `Object.values(CHAPTER_WEIGHTS).reduce((a, b) => a + b, 0) === 1.0` ➔ **TRUE**
* **Total Puntos Máximos:** Exactamente **100.0 puntos**.

---

## 4. Auditoría de los 37 Criterios Oficiales

Se verificó el catálogo `CRITERIA_CATALOG` contra el bundle oficial del APK (`Tf` en `dist/assets/index-DLowqfUy.js`):

| Capítulo | Título Oficial | Peso | Pts | Criterios en `CRITERIA_CATALOG` | Criterios en APK (`Tf`) | Coincidencia |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **Cap 1** | Almacén e inventarios de PPC | 5% | 5.0 | `1.1`, `1.2`, `1.3`, `1.4` (4) | `1.1`, `1.2`, `1.3`, `1.4` (4) | ✅ EXACTA |
| **Cap 2** | Medición y dosificación de PPC | 30% | 30.0 | `2.1` a `2.8` (8) | `2.1` a `2.8` (8) | ✅ EXACTA |
| **Cap 3** | Transporte interno de PPC | 5% | 5.0 | `3.1`, `3.2`, `3.3`, `3.4` (4) | `3.1`, `3.2`, `3.3`, `3.4` (4) | ✅ EXACTA |
| **Cap 4** | Preparación de mezclas | 30% | 30.0 | `4.1` a `4.10` (10) | `4.1` a `4.10` (10) | ✅ EXACTA |
| **Cap 5** | Aplicación de PPC en campo | 30% | 30.0 | `5.1` a `5.11` (11) | `5.1` a `5.11` (11) | ✅ EXACTA |
| **TOTAL** | **Protocolo MIPE Completo** | **100%** | **100.0** | **37 Criterios** | **37 Criterios** | ✅ **100% SINCRONIZADO** |

* No existen IDs sintéticos.
* No faltan IDs oficiales.
* No existen criterios huérfanos sin capítulo asignado.
* Cada criterio tiene severidad válida (`critical`, `high`, `medium`) y categoría asignada.

---

## 5. Resultados de Pruebas Adversariales de Estrés

### 5.1 Prueba Adversarial: Capítulo Vacío (Cap 1 Vacío, Caps 2–5 Todos SI)
* **Entrada:** Cap 1 sin respuestas; Caps 2, 3, 4 y 5 con 100% de respuestas `SI` (33 criterios `SI`).
* **Comportamiento observado:**
  - Cap 1 `isEvaluated`: `false`, `compliance`: `null`, `pointsEarned`: `0.0`.
  - Puntos MIPE ganados: **95.0 / 100.0 pts** (Cap 1 no aportó sus 5 pts).
  - Cumplimiento sobre lo evaluado: **100.0%** (33 de 33 criterios evaluados fueron conformes).
  - Cobertura de capítulos: **4/5 Caps** (80%).
  - Cobertura ponderada: **95%** del peso oficial.
  - Estado: **`Auditoría Parcial`** (`isFullyEvaluated: false`).
* **Conclusión:** **CORRECTO.** El capítulo vacío no se autocompleta con 100%, ni aporta puntos espurios, ni permite clasificar la auditoría como completa.

### 5.2 Prueba Adversarial: Todo Vacío (0 Criterios Evaluados)
* **Entrada:** Auditoría con `chapters: [1, 2, 3, 4, 5]`, pero `answers: {}`.
* **Comportamiento observado:**
  - Puntos MIPE: `0.0`.
  - `criteriaCompliance`: `null`.
  - `weightedScore`: `null`.
  - `coveragePct`: `0%`.
  - `evaluatedChaptersCount`: `0`.
  - `isFullyEvaluated`: `false`.
  - `totalFindings`: `0`.
* **Conclusión:** **CORRECTO.** No se produce `NaN`, ni `Infinity`, ni se asume 100% por falta de hallazgos.

### 5.3 Prueba Adversarial: Todos NO (37 Criterios = NO)
* **Entrada:** Los 37 criterios evaluados con `value: "NO"`.
* **Comportamiento observado:**
  - Puntos MIPE: `0.0`.
  - Cumplimiento de criterios: `0.0%` (NO es `null`, ya que hubo evaluación real).
  - Desempeño ponderado: `0.0%`.
  - Cobertura: `5/5 Caps` (100%).
  - Estado: **`Auditoría Completa`** (`isFullyEvaluated: true`).
  - Total Hallazgos: `37`.
* **Conclusión:** **CORRECTO.** Diferencia nítidamente `0.0%` (evaluado y no conforme) de `null` (no evaluado).

### 5.4 Prueba Adversarial: Solo NO APLICA (Todos los Criterios = NA)
* **Entrada:** Los 37 criterios con `value: "NA"`.
* **Comportamiento observado:**
  - Puntos MIPE: `0.0`.
  - Cumplimiento: `null` (No evaluado).
  - Capítulos evaluados: `0`.
  - Estado: `No evaluada`.
* **Conclusión:** **CORRECTO.** Las respuestas `NA` no inflan artificialmente el cumplimiento a 100%.

### 5.5 Prueba Adversarial: Mixto (8 SI, 2 NO, 5 NA, 22 No Evaluados)
* **Entrada:** Cap 4 con 8 `SI` y 2 `NO`; Cap 5 con 5 `NA` y 6 sin respuesta; Caps 1, 2, 3 sin respuesta.
* **Comportamiento observado:**
  - Cap 4: $8 / (8 + 2) \times 100 = 80.0\%$. Puntos Cap 4: $80\% \times 30.0 = 24.0$ pts.
  - Cap 5: Solo `NA` y sin respuesta ➔ `isEvaluated: false`, `pointsEarned: 0.0`.
  - Puntos MIPE totales: `24.0 / 100.0` pts.
  - Cumplimiento de criterios global: exactamente `80.0%` ($8 / 10$).
* **Conclusión:** **CORRECTO.** Los 5 `NA` y los 22 criterios no evaluados quedaron estrictamente excluidos del denominador.

### 5.6 Prueba Adversarial: Ranking con Muestras Asimétricas y Empates
* **Entrada:**
  - Finca A: 100% cumplimiento, pero solo 1 capítulo evaluado (5% cobertura, 5.0 pts).
  - Finca B: 97.3% cumplimiento, auditoría completa 5/5 capítulos (97.0 pts).
  - Finca C: 94.6% cumplimiento, auditoría completa 5/5 capítulos (94.3 pts).
  - Finca D: Empate exacto con Finca B (97.0 pts, 97.3% cumplimiento).
* **Ordenamiento resultante del código:**
  1. `#1: Finca B` (Completa, 97.0 pts)
  2. `#2: Finca D` (Completa, 97.0 pts — desempate alfabético)
  3. `#3: Finca C` (Completa, 94.3 pts)
  4. `#4: Finca A` (Parcial, 5.0 pts)
* **Conclusión:** **CORRECTO.** La Finca A con 100% sobre un solo capítulo queda al final de la tabla por ser parcial y acumular solo 5 puntos. El desempate entre B y D es completamente determinista.

---

## 6. Falsos Positivos Encontrados

* **Cero falsos positivos detectados en las fórmulas matemáticas.**
* Un capítulo no evaluado jamás figura con 100% ni con color verde de aprobación.
* Los filtros de criterios excluyen automáticamente ítems con `applicable === 0` de la vista de "Solo conformes".

---

## 7. Análisis de Fórmulas y Posibles Inconsistencias Semánticas

Se identificó la siguiente distinción técnica que debe ser comprendida por el usuario:
- **Tasa de Criterios Conformes ($C_{\text{eval}}$):** Es un promedio simple de criterios ($\frac{\text{SI}}{\text{SI}+\text{NO}}$).
- **Desempeño Ponderado de Auditoría ($D_{\text{pond}}$):** Es la fracción ponderada de puntos ganados sobre puntos auditados ($\frac{P_{\text{MIPE}}}{\sum w_i}$).
- Ambas métricas son matemáticamente correctas y responden a preguntas agronómicas diferentes. El motor actual las calcula de forma independiente y las rotula claramente en la interfaz.

---

## 8. Problemas de Estado y Transformaciones de Tipos

Se auditó el uso de operadores JavaScript:
- `applicable > 0`: Protege divisiones por cero.
- `cData.pos / cData.app`: Solo se ejecuta cuando `cData.app > 0`.
- No hay conversiones peligrosas del tipo `value || 0` sobre variables que puedan ser legítimamente `0.0`.
- El valor `0.0` se preserva como número, mientras que la ausencia de evaluación se preserva como `null`.

---

## 9. Problemas de Precisión Numérica y Floating Point

- En JavaScript, sumas decimales repetidas pueden producir residuos como `0.30000000000000004`.
- El motor aplica `Math.round(val * 10) / 10` en todas las etapas de asignación de puntos y porcentajes, eliminando cualquier artefacto de punto flotante antes de la renderización y comparación.
- En pruebas con números periódicos ($1 / 3 = 0.3333...$), el motor redondea consistentemente a `33.3%` y a `1.7 pts` sin pérdida acumulada.

---

## 10. Problemas de Aislamiento y Mutabilidad

- **Aislamiento entre Fincas:** El filtrado `filterVisits(visits, farm, range, crop)` crea un nuevo array filtrado sin alterar el array maestro de visitas.
- **Aislamiento Temporal:** El filtro de rango de días calcula la diferencia en milisegundos contra `new Date()` sin mutar las fechas originales.
- **Inmutabilidad en Simulador:** `simValues` es un objeto reactivo en `state`. Modificar los deslizadores de simulación no altera los objetos de visita ni el objeto `intel` previamente calculado.

---

## 11. Advertencias Menores (Warnings de Robustez para Fases Posteriores)

1. **Warning W-01 (Deduplicación de Visitas):**
   * *Descripción:* Si el array de entrada contiene dos veces el mismo registro de visita con el mismo `id` y fecha, el motor suma ambos en `chapterTotals`. El porcentaje se conserva ($2/4 = 1/2$), pero el conteo de visitas y hallazgos absolutos se incrementa artificialmente.
   * *Recomendación:* En la capa de infraestructura/storage (Fase 5), deduplicar por `visit.id` antes de entregar el array a las métricas.
   * *Riesgo:* **Bajo** (en la base de datos real SQLite, `id` es `PRIMARY KEY`, lo que impide duplicados a nivel de almacenamiento).

2. **Warning W-02 (Defensa en Deslizadores de Simulación):**
   * *Descripción:* La función `renderSimulatorTab` asume que `sim[chId]` está en el rango $[0, 100]$. Si se alterara mediante consola o script externo a valores negativos o mayores a 100, la fórmula lineal no tiene un `Math.max(0, Math.min(100, v))` defensivo en el cálculo interno.
   * *Recomendación:* Aplicar un clamp defensivo en la función de cálculo del simulador cuando se refactorice el dominio.
   * *Riesgo:* **Bajo** (la UI restringe el valor mediante `min="0" max="100"`).

---

## 12. Archivos Revisados

1. `tools/build_metrics_module.py`
2. `enhance/src/care360-metrics.js`
3. `dist/assets/index-DLowqfUy.js`
4. `dist/assets/device-runtime-gNohLees.js`
5. `tests/metrics-math.mjs`
6. `docs/METRICS-MATH-AUDIT.md`

---

## 13. Archivos Modificados

### **NINGUNO**
*(Siguiendo estrictamente la regla de esta fase: auditoría adversarial pura de solo lectura, sin modificaciones de código ni regeneración de archivos).*

---

## 14. Conclusión Final

> **¿Podemos confiar en que AVGUST CARE 360 nunca presentará una métrica favorable cuando los datos reales no la justifican?**
>
> **SÍ.** El motor matemático actual previene de forma determinista cualquier falsificación de cumplimiento, aísla con exactitud los capítulos no evaluados, respeta la ponderación de 100 puntos oficiales y garantiza que una finca con auditoría incompleta jamás supere a una finca con auditoría completa.

### Veredicto:
```text
MATEMÁTICAS MIPE — VALIDACIÓN ADVERSARIAL APROBADA (PASS WITH WARNINGS)
```
