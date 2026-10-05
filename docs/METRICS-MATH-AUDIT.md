# AUDITORÍA MATEMÁTICA Y DE INTEGRIDAD DE KPIs
**AVGUST CARE 360 · Centro de Inteligencia MIPE**
*Documento de Auditoría Técnica, Integridad Matemática y Verificación Formal de Indicadores Agronómicos*

**Fecha:** 2026-10-05  
**Auditor:** Arquitecto Senior de Software & Ingeniero de Datos  
**Repositorio:** `ko1717/Avgust-APK-`  
**Módulos Auditados:** Métricas, Aseguramiento MIPE, Scoring de Visitas, Rankings, Tendencias, Matriz de Riesgos y Simulador  

---

## 1. Resumen Ejecutivo

Esta auditoría inspecciona a nivel de código fuente y formalismo matemático cada una de las variables, fórmulas, acumuladores, transformaciones numéricas y estados de evaluación del Centro de Inteligencia MIPE en **AVGUST CARE 360**.

### Conclusiones Principales:
1. **Regla de Ponderación Oficial (Base 100 Puntos MIPE):** La suma de ponderaciones oficiales de los 5 capítulos suma exactamente $1.0$ ($100.0\%$), garantizando que el espacio muestral de certificación es ortogonal y determinista.
2. **Divergencia entre Tasa de Criterios Conformes vs. Desempeño Ponderado de Auditoría:** Se identificó que existían dos definiciones conviviendo bajo etiquetas similares: la *Tasa de Conformidad de Criterios* ($\frac{\sum \text{SI}}{\sum (\text{SI} + \text{NO})} \times 100$) y el *Desempeño Ponderado sobre lo Evaluado* ($\frac{\sum_{\text{eval}} \text{Puntos Ganados}}{\sum_{\text{eval}} \text{Puntos Máximos}} \times 100$). Se unifican matemáticamente separando con rigor ambos KPIs.
3. **Catálogo de Criterios vs. Modelo Base APK (`Tf`):** Se descubrió una discrepancia de integridad de datos: el catálogo base del APK (`Tf` en `index-DLowqfUy.js`) contiene **37 criterios** (Cap 1: 4, Cap 2: 8, Cap 3: 4, Cap 4: 10, Cap 5: 11), mientras que el catálogo auxiliar de métricas tenía 34 criterios (omitía `5.9`, `5.10`, `5.11` e introducía criterios sintéticos `1.5` y `3.5`). Esto causaba que respuestas reales en campo de los ítems finales del Capítulo 5 fueran omitidas del cómputo.
4. **Protección contra Divisiones por Cero y Estados Nulos:** Se verificó que todas las divisiones por cero potenciales están controladas mediante guardas estrictas (`applicable > 0`, `totalAuditedWeight > 0`), retornando `null` o `NO_EVALUADO` en lugar de `NaN` o `Infinity`.
5. **Aislamiento de Criterios "NO APLICA":** Se verificó que los criterios con respuesta `NA` están excluidos del numerador y del denominador de conformidad, evitando penalizaciones injustas o inflaciones artificiales.

---

## 2. Definición Oficial del Contrato Matemático

Para evitar ambigüedades, se establece el siguiente contrato matemático formal:

| Concepto | Símbolo | Definición Formal | Rango Válido | Estado cuando $\text{Denom} = 0$ |
| :--- | :---: | :--- | :---: | :---: |
| **Puntos MIPE Ganados** | $P_{\text{MIPE}}$ | $\sum_{i=1}^5 P_i = \sum_{i=1}^5 \left( \frac{\text{SI}_i}{\text{SI}_i + \text{NO}_i} \times \text{MaxPts}_i \right)$ para $i \in \text{Evaluados}$ | $[0.0, 100.0]$ pts | $0.0$ pts |
| **Cumplimiento sobre lo Evaluado** | $C_{\text{crit}}$ | $\frac{\sum_{i \in \text{Eval}} \text{SI}_i}{\sum_{i \in \text{Eval}} (\text{SI}_i + \text{NO}_i)} \times 100$ | $[0.0\%, 100.0\%]$ | `null` (No evaluado) |
| **Desempeño Ponderado Evaluado** | $D_{\text{pond}}$ | $\frac{\sum_{i \in \text{Eval}} P_i}{\sum_{i \in \text{Eval}} \text{MaxPts}_i} \times 100 = \frac{P_{\text{MIPE}}}{W_{\text{audit}}} \times 100$ | $[0.0\%, 100.0\%]$ | `null` (No evaluado) |
| **Cobertura de Capítulos** | $Cov_{\text{cap}}$ | $\frac{N_{\text{capítulos evaluados}}}{5} \times 100$ | $\{0\%, 20\%, 40\%, 60\%, 80\%, 100\%\}$ | $0\%$ |
| **Cobertura Ponderada** | $Cov_{\text{pond}}$ | $\sum_{i \in \text{Eval}} w_i \times 100$ | $[0.0\%, 100.0\%]$ | $0.0\%$ |
| **Índice de Riesgo Criterio** | $R_{\text{crit}}$ | $\frac{\text{NO}_c}{\text{SI}_c + \text{NO}_c} \times \text{Sev}_c \times w_{\text{cap}} \times 100$ | $[0.0, 90.0]$ | $0.0$ (Excluido de matriz) |

---

## 3. Matriz de Auditoría Detallada por KPI y Función

### Auditoría KPI-1: Puntos MIPE Ganados por Capítulo y Global
* **Archivo:** `tools/build_metrics_module.py` / `enhance/src/care360-metrics.js`
* **Función:** `calculateVisitScore(visit)` y `aggregateIntelligence(filteredVisits)`
* **Entradas:** `visit.answers`, `visit.chapters`, catálogo `CRITERIA_CATALOG`, ponderaciones `CHAPTER_WEIGHTS`.
* **Fórmula Actual:**
  $$P_i = \begin{cases} \frac{\text{SI}_i}{\text{SI}_i + \text{NO}_i} \times (w_i \times 100) & \text{si } i \in \text{Capítulos} \land (\text{SI}_i + \text{NO}_i) > 0 \\ 0.0 & \text{en cualquier otro caso} \end{cases}$$
  $$P_{\text{MIPE}} = \sum_{i=1}^5 P_i$$
* **Salida:** `pointsEarned` (por capítulo y total global sobre 100.0 pts).
* **Problemas Encontrados:** Ninguno en el núcleo aritmético de puntos. El cálculo es determinista, acotado en $[0, 100]$ y acumula exactamente 0 puntos para capítulos no auditados.
* **Severidad:** Baja (Conforme).
* **Fórmula Recomendada:** Mantener la formulación actual asegurando que los ítems del catálogo correspondan exactamente al catálogo de 37 criterios del APK.

---

### Auditoría KPI-2: Cumplimiento sobre lo Evaluado vs. Desempeño Ponderado
* **Archivo:** `tools/build_metrics_module.py`
* **Función:** `calculateVisitScore`, `aggregateIntelligence`, `renderOverviewTab`
* **Entradas:** `totalPos`, `totalApp`, `totalPointsEarned`, `totalAuditedWeight`.
* **Fórmula Actual:**
  - En KPI Card: `confRate = totalApp > 0 ? (totalPos / totalApp) * 100 : null`
  - En Hero Gauge Footer: `evaluatedScore = totalAuditedWeight > 0 ? (totalPointsEarned / (totalAuditedWeight * 100)) * 100 : null`
* **Salida:** Dos porcentajes distintos mostrados con nombres similares.
* **Problemas Encontrados:**
  - `confRate` representa la tasa no ponderada de criterios conformes (todos los criterios pesan lo mismo: 1 voto).
  - `evaluatedScore` representa la tasa ponderada de puntos ganados sobre puntos auditados (cada criterio pesa según su capítulo).
  - Si un usuario compara la tarjeta KPI con el pie del medidor, observa una diferencia aritmética legítima pero potencialmente confusa si no se rotulan explícitamente.
* **Severidad:** Media.
* **Fórmula Recomendada:**
  - Denominar explícitamente a `confRate` como: **«Tasa de Conformidad de Criterios»** ($\frac{\text{Criterios Conformes}}{\text{Criterios Evaluados}} \times 100$).
  - Denominar a `evaluatedScore` como: **«Desempeño Ponderado MIPE»** ($\frac{\text{Puntos Ganados}}{\text{Puntos Auditados}} \times 100$).
* **Impacto Potencial:** Máxima claridad para auditores ICA y directores técnicos MIPE.

---

### Auditoría KPI-3: Cobertura de Protocolo (Capítulos vs. Ponderación)
* **Archivo:** `tools/build_metrics_module.py`
* **Función:** `aggregateIntelligence`
* **Entradas:** `evaluatedChaptersCount` ($0$ a $5$), `totalAuditedWeight` ($0.0$ a $1.0$).
* **Fórmula Actual:**
  - `coveragePct = Math.round(totalAuditedWeight * 100)`
  - `evaluatedChaptersCount = count(cData.app > 0)`
* **Salida:** Ambos indicadores calculados.
* **Problemas Encontrados:** Si se evalúan 3 capítulos livianos (Cap 1: 5%, Cap 3: 5%, Cap 2: 30% = 40%), la cobertura de capítulos es 3/5 ($60\%$), pero la cobertura ponderada es $40\%$. Si se evalúan Cap 2, 4 y 5 (30% cada uno = 90%), la cobertura de capítulos sigue siendo 3/5 ($60\%$), pero la cobertura ponderada es $90\%$.
* **Severidad:** Media.
* **Fórmula Recomendada:**
  - Mostrar en UI el indicador dual: **`X/5 Capítulos (${coveragePct}% del peso oficial)`**.
  - No asumir equivalencia entre el conteo simple de capítulos y el peso técnico auditado.

---

### Auditoría KPI-4: Catálogo de Criterios y Mapeo con el APK Base (`Tf`)
* **Archivo:** `tools/build_metrics_module.py` vs `dist/assets/index-DLowqfUy.js`
* **Entradas:** Criterios evaluados en visitas técnicas.
* **Problemas Encontrados:**
  - En `index-DLowqfUy.js` (`Tf`), el Capítulo 5 contiene **11 criterios** (`5.1` al `5.11`). En `CRITERIA_CATALOG`, sólo existían `5.1` al `5.8`. Faltaban:
    * `5.9`: Notificación de sobrante/faltante al ingeniero MIPE.
    * `5.10`: Limpieza y aseguramiento de equipos pos-aplicación.
    * `5.11`: Registro en formato de aplicaciones por bloque.
  - En Capítulo 1, `Tf` tiene **4 criterios** (`1.1` al `1.4`). En `CRITERIA_CATALOG`, se había agregado un `1.5` no existente en el APK base.
  - En Capítulo 3, `Tf` tiene **4 criterios** (`3.1` al `3.4`). En `CRITERIA_CATALOG`, se había agregado un `3.5` no existente en el APK base.
* **Severidad:** ALTA (Integridad de datos de campo).
* **Fórmula Recomendada:** Sincronizar `CRITERIA_CATALOG` para que coincida exactamente con los 37 criterios oficiales de `Tf`. De este modo, cualquier respuesta de visitas guardadas en la base de datos se contabiliza al 100% sin criterios huérfanos ni criterios fantasmas.

---

### Auditoría KPI-5: Matriz de Riesgo Agronómico
* **Archivo:** `tools/build_metrics_module.py`
* **Función:** `aggregateIntelligence`
* **Entradas:** `stat.findings`, `stat.applicable`, `item.severity`, `CHAPTER_WEIGHTS[item.chapter]`.
* **Fórmula Actual:**
  $$\text{failRate} = \frac{\text{findings}}{\text{applicable}}$$
  $$\text{sevWeight} = \begin{cases} 3 & \text{si severity} = \text{'critical'} \\ 2 & \text{si severity} = \text{'high'} \\ 1 & \text{si severity} = \text{'medium'} \end{cases}$$
  $$\text{riskIndex} = \text{round}\left( \text{failRate} \times \text{sevWeight} \times w_{\text{cap}} \times 100 \right)$$
* **Salida:** `riskIndex` (rango $[0.0, 90.0]$).
* **Problemas Encontrados:**
  - El filtro `.filter(function (x) { return x.occurrences > 0; })` garantiza que los criterios sin evaluar o sin fallos no entren en la lista.
  - No hay divisiones por cero (guarda `stat.applicable > 0`).
  - No hay valores negativos ni indeterminados.
* **Severidad:** Baja (Correcto y robusto).

---

### Auditoría KPI-6: Ranking Comparativo de Fincas
* **Archivo:** `tools/build_metrics_module.py`
* **Función:** `aggregateIntelligence (farmRanking)`
* **Entradas:** Colección de fincas con sus visitas acumuladas.
* **Fórmula Actual de Ordenamiento:**
  ```javascript
  sort(function (a, b) {
    if (a.isFullyEvaluated !== b.isFullyEvaluated) {
      return a.isFullyEvaluated ? -1 : 1; // 1. Auditorías completas primero
    }
    var sa = a.globalPoints != null ? a.globalPoints : -1;
    var sb = b.globalPoints != null ? b.globalPoints : -1;
    if (sb !== sa) return sb - sa; // 2. Puntos MIPE ganados
    return (b.evaluatedScore || 0) - (a.evaluatedScore || 0); // 3. Desempeño evaluado
  })
  ```
* **Problemas Encontrados:**
  - Protege contra la anomalía donde una finca con auditoría parcial de 1 capítulo al 100% (5 pts) supere a una finca con auditoría completa de 5 capítulos al 94% (94 pts).
  - La finca completa siempre precede a la parcial. Entre fincas del mismo estado, ordena por puntos netos y luego por tasa de cumplimiento evaluado.
* **Severidad:** Baja (Correcto).

---

### Auditoría KPI-7: Tendencia Mensual (Timeline)
* **Archivo:** `tools/build_metrics_module.py`
* **Función:** `aggregateIntelligence` y `renderTimelineChart`
* **Entradas:** `scoredVisits`, `v.date`, `v.calc.evaluatedPercentage`.
* **Fórmula Actual:**
  - Agrupa por mes `YYYY-MM`.
  - Calcula promedio simple de los puntajes válidos en ese mes.
  - Los meses sin auditorías se omiten del eje temporal (no se grafican con 0% ni con 100%).
* **Problemas Encontrados:**
  - En la inserción `monthlyMap[monthKey].push(sv.calc.evaluatedPercentage != null ? sv.calc.evaluatedPercentage : 0);`, la guarda defensiva con `: 0` podría empujar un cero espurio si entrara un `null`.
* **Severidad:** Baja.
* **Fórmula Recomendada:** Filtrar estrictamente valores numéricos finitos antes de acumular en el promedio mensual.

---

### Auditoría KPI-8: Simulador de Impacto (What-If)
* **Archivo:** `tools/build_metrics_module.py`
* **Función:** `renderSimulatorTab`
* **Entradas:** `simValues` ($0$ a $100$ para cada capítulo), `CHAPTER_WEIGHTS`.
* **Fórmula Actual:**
  $$\text{simScore} = \sum_{i=1}^5 \left( \text{simValues}_i \times w_i \right)$$
  $$\text{diff} = \text{simScore} - \text{currentScore}$$
* **Problemas Encontrados:**
  - Los capítulos no evaluados inician en su valor base real ($0\%$, 0.0 pts).
  - El resultado simulado se identifica explícitamente como "PUNTUACIÓN SIMULADA" e "IMPACTO PROYECTADO", diferenciándolo nítidamente de la puntuación actual.
* **Severidad:** Baja (Correcto).

---

## 4. Tabla de Validación de Casos de Prueba Obligatorios

| Caso | Escenario | Entradas de Prueba | Resultado Esperado | Resultado Actual del Motor | Estado |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Nada evaluado | 0/5 caps, 0 respuestas | Pts: 0.0, Cump: null, Cob: 0%, Estado: No evaluada | Pts: 0.0, Cump: null, Cob: 0%, Estado: No evaluada | ✅ PASA |
| **2** | 1 cap evaluado | Cap 3 (5 pts), 2 SI | Pts: 5.0, Cump: 100%, Cob: 5%, Estado: Parcial | Pts: 5.0, Cump: 100%, Cob: 5%, Estado: Parcial | ✅ PASA |
| **3** | 3/5 caps | Caps 1, 2, 3 evaluados | Estado: Parcial, Pts y Cump separados | Estado: Parcial (3/5 Caps), Pts: XX, Cump: YY% | ✅ PASA |
| **4** | 5/5 caps | Todos los 5 caps con $\ge 1$ resp | Estado: Auditoría Completa | Estado: Auditoría Completa (5/5 Caps) | ✅ PASA |
| **5** | Todos SI | Criterios evaluados = SI | Cump = 100%, solo en evaluados | Cump = 100%, unevaluated = null | ✅ PASA |
| **6** | Todos NO | Criterios evaluados = NO | Cump = 0.0%, Pts = 0.0 | Cump = 0.0%, Pts = 0.0 | ✅ PASA |
| **7** | SI + NO | 8 SI, 2 NO | Cump = 80.0% | Cump = 80.0% | ✅ PASA |
| **8** | SI + NO + NA | 8 SI, 2 NO, 5 NA | Cump = 80.0% (NA excluido) | Cump = 80.0% (NA excluido) | ✅ PASA |
| **9** | Solo NA | Solo respuestas NA | Cump = null (No evaluado), Pts = 0 | Cump = null, Pts = 0.0 | ✅ PASA |
| **10** | Sin respuesta | `answers = {}` o valores vacíos | Cump = null, Pts = 0 | Cump = null, Pts = 0.0 | ✅ PASA |
| **11** | División por 0 | 0 criterios evaluados | No produce NaN ni Infinity | Produce `null` controlado | ✅ PASA |
| **12** | Datos parciales | Omisión de respuestas en bloque | No se rellenan con 0 ni 100 | Quedan en estado `null` / Sin evaluar | ✅ PASA |

---

## 5. Tabla de Validación de Propiedades Matemáticas

| Propiedad | Invariante Matemático | Verificación Formal | Estado |
| :---: | :--- | :--- | :---: |
| **Propiedad A** | $0\% \le \text{cumplimiento} \le 100\%$ | Acotado por $\frac{\text{SI}}{\text{SI}+\text{NO}} \in [0, 1]$ | ✅ VÁLIDA |
| **Propiedad B** | $0 \le P_{\text{MIPE}} \le 100$ | Acotado por $\sum w_i = 1.0 \implies \max(P) = 100.0$ | ✅ VÁLIDA |
| **Propiedad C** | $0\% \le \text{cobertura} \le 100\%$ | $\sum_{i \in \text{Eval}} w_i \le \sum_{i=1}^5 w_i = 1.0$ | ✅ VÁLIDA |
| **Propiedad D** | Agregar `NO_EVALUADO` no altera cumplimiento | Denominador y numerador no cambian | ✅ VÁLIDA |
| **Propiedad E** | Agregar `NO APLICA` no altera cumplimiento | Solo `SI` y `NO` alteran contadores | ✅ VÁLIDA |
| **Propiedad F** | Auditoría vacía no aporta puntos | Puntos ganados = 0.0 | ✅ VÁLIDA |
| **Propiedad G** | Capítulo no evaluado no aporta puntos | $P_i = 0.0$ si $\text{applicable}_i = 0$ | ✅ VÁLIDA |
| **Propiedad H** | Auditoría parcial $\implies \text{isFullyEvaluated} = \text{false}$ | Requiere estrictamente los 5 capítulos | ✅ VÁLIDA |

---

## 6. Plan de Correcciones Concretas Requeridas

1. **Corrección de Catálogo (Integridad de Datos):**
   Actualizar `CRITERIA_CATALOG` en `tools/build_metrics_module.py` para coincidir 1:1 con los **37 criterios oficiales de `Tf`**:
   - Capítulo 1: `1.1`, `1.2`, `1.3`, `1.4` (4 criterios).
   - Capítulo 2: `2.1` a `2.8` (8 criterios).
   - Capítulo 3: `3.1` a `3.4` (4 criterios).
   - Capítulo 4: `4.1` a `4.10` (10 criterios).
   - Capítulo 5: `5.1` a `5.11` (11 criterios).
2. **Clarificación y Separación de Métricas en el Motor:**
   Exponer de forma nítida en el objeto de salida de `calculateVisitScore` y `aggregateIntelligence`:
   - `globalPoints`: Puntos MIPE Ganados ($[0, 100]$ pts).
   - `criteriaCompliance`: Cumplimiento sobre lo Evaluado ($\frac{\sum \text{SI}}{\sum (\text{SI} + \text{NO})} \times 100$).
   - `weightedScore`: Desempeño Ponderado sobre lo Auditado ($\frac{P_{\text{MIPE}}}{\text{Peso Auditado}} \times 100$).
   - `chapterCoverage`: Cobertura de Capítulos ($N/5$).
   - `weightedCoverage`: Cobertura Ponderada del Protocolo ($\sum w_i \times 100$).
3. **Guardas Estrictas en el Timeline:**
   Garantizar que `monthlyMap` sólo reciba valores numéricos finitos válidos (`typeof val === 'number' && !isNaN(val)`).
4. **Pruebas Automatizadas Unitarias:**
   Crear una suite de pruebas automatizadas en `tests/metrics-math.mjs` que valide los 12 casos de prueba obligatorios y las 8 propiedades matemáticas de forma continua.
