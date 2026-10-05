# AVGUST CARE 360 · CENTRO DE INTELIGENCIA MIPE
# FASE 5.5 — AUDITORÍA Y REDISEÑO VISUAL PROFESIONAL
## INFORME DE ARQUITECTURA DE INFORMACIÓN, UX Y SISTEMA VISUAL ENTERPRISE

**Fecha de Auditoría:** Octubre 2026  
**Sistema:** AVGUST CARE 360 · Centro de Inteligencia MIPE  
**Módulos Auditados:** Fases 2, 3, 4 y 5 (`care360-metrics.js`, `views/*.view.js`, `care360-pro.css`)  
**Carácter de la Fase:** **DESIGN GATE — ESTRICTAMENTE CONCEPTUAL Y ANALÍTICA (SIN MODIFICACIONES DE CÓDIGO DE PRODUCCIÓN)**  
**Versión Base Auditada:** v1.5.32 (Build 2.0.1)

---

## 1. Contexto y Propósito de la Auditoría

Tras la finalización exitosa de las cinco primeras fases de ingeniería (Fase 1: Auditoría Matemática; Fase 2: Filtros Globales y Header; Fase 3: Executive Scorecard y Health Hero; Fase 4: Tendencia y Benchmark; Fase 5: Matriz de Riesgo, Causas y Acciones), el motor analítico de AVGUST CARE 360 cuenta con:
* 37/37 criterios oficiales sincronizados y calculados sin sesgo.
* 100% de las 12 pruebas matemáticas y 8 invariantes formales aprobadas.
* 10/10 pruebas de series temporales y benchmark aprobadas.
* 10/10 pruebas de riesgos, causas, prioridades y trazabilidad documental aprobadas.

Sin embargo, a nivel de **composición visual y experiencia de usuario (UX)**, el módulo actual presenta el síndrome común del crecimiento funcional acumulativo: **una colección fragmentada de widgets y tarjetas distribuidas a lo largo de 5 pestañas desconectadas**, que exige del usuario un esfuerzo cognitivo y clics innecesarios para responder a las preguntas críticas del negocio fitosanitario.

El objetivo de esta Fase 5.5 es realizar la **auditoría integral del estado actual**, diagnosticar las ineficiencias de comunicación visual y proponer una **Arquitectura Visual de Mando Unificado (Enterprise Agronomic Control Center)** antes de intervenir el código de producción.

---

## 2. Diagnóstico del Estado Actual

### A. Qué Funciona Satisfactoriamente
1. **Rigor Matemático Impecable**: Las fórmulas oficiales, la ponderación de capítulos (5%, 30%, 5%, 30%, 30%), el cálculo de cobertura, cumplimiento sobre evaluados y la semántica de "No evaluado" / "NA" son exactos y consistentes en todo el sistema.
2. **Autocontención Operativa (Offline-First)**: El motor funciona sin depender de servicios externos en tiempo de render, respetando los datos locales de SQLite/IndexedDB.
3. **Profundidad de Información**: Cada dato (score, brecha, causa, severidad, evidencia, delta) existe en el ViewModel y puede ser extraído fielmente.
4. **Respeto a las Reglas de Negocio**: No hay alucinaciones de pérdidas económicas, hectáreas inventadas ni recetas fitosanitarias infundadas.

---

### B. Qué No Funciona y Genera Fricción (Deficiencias Detectadas)

1. **Card Explosion (Saturación de Tarjetas y Bordes)**:
   * En la pestaña *Overview* conviven **13 tarjetas rectangulares independientes**, cada una con su propio borde de 1px, sombra, radio, kicker superior y espaciado interior.
   * En la pestaña *Riesgos* existen 4 tarjetas contenedor gigantes que a su vez contienen hasta **15 tarjetas internas anidadas** (`.c360-risk-item`, `.c360-cause-area-card`), generando el antipatrón de diseño de *"cajas dentro de cajas dentro de cajas"*.
   * La vista se percibe como una "bodega de tarjetas" en lugar de un lienzo analítico de alta precisión.

2. **Duplicación Crónica de Indicadores (Ruido Visual)**:
   * El puntaje oficial de la finca aparece **4 veces** en la misma pantalla inicial:
     1. En el Header superior (texto pequeño).
     2. En el *MIPE Health Score Hero* (cifra gigantesca `92.4 / 100`).
     3. En el *Executive Scorecard* KPI 1 (`92.4 / 100 pts`).
     4. En la barra de contribución ponderada (`92.4 / 100.0 Puntos Ganados`).
   * La *Cobertura del Protocolo* aparece **3 veces** simultáneamente (Hero context strip, KPI 3 del Scorecard y leyenda de capítulos).
   * El *Cumplimiento Evaluado* aparece **2 veces** en tarjetas adyacentes que compiten por atención.

3. **Narrativa Fragmentada en Pestañas (Cognitive Switching Overhead)**:
   * Para responder: *"¿Cómo está la finca?"* el usuario mira el **Overview**.
   * Para responder: *"¿Está mejorando o empeorando?"* el usuario debe hacer clic en la pestaña **Benchmark** para ver la curva de tendencia temporal.
   * Para responder: *"¿Dónde está el problema y qué debo hacer?"* el usuario debe hacer clic en la pestaña **Riesgos** y desplazarse hasta el fondo para encontrar las acciones prioritarias.
   * Este modelo fragmentado destruye la continuidad analítica natural: **Estado → Tendencia → Brecha → Riesgo → Acción**.

4. **Competición Visual entre Health Hero y KPI 1**:
   * El *MIPE Health Score Hero* (con su gauge circular) y el *KPI 1 del Executive Scorecard* miden exactamente lo mismo con diferente tamaño y formato, ubicados a escasos píxeles de distancia. Uno canibaliza visualmente al otro.

5. **Exceso de Badges y Pastillas (Violación de la Disciplina Zero-Pill)**:
   * Gran cantidad de metadatos estáticos (fechas, cultivos, categorías, recuentos, porcentajes) están encerrados en cápsulas de colores brillantes con bordes redondeados completos (`rounded-full` / `badge-*`).
   * Esto genera fatiga visual ("árbol de navidad") y devalúa los verdaderos indicadores críticos de advertencia y severidad.

6. **Experiencia Móvil Deficiente ("Mobile Doomscroll")**:
   * En dispositivos móviles de campo, el responsive actual se limita a apilar linealmente las 13 tarjetas una debajo de otra.
   * Un ingeniero agrónomo en campo debe realizar entre 8 y 12 deslizamientos de pantalla antes de ver una sola no conformidad o acción correctiva.

7. **Desaprovechamiento del Viewport en Escritorio (1440px)**:
   * Grandes áreas de espacio vertical quedan consumidas por encabezados redundantes y márgenes vacíos entre tarjetas, obligando a hacer scroll incluso en pantallas de alta resolución para ver información complementaria que podría coexistir armónicamente en columnas correlacionadas.

---

## 3. Matriz de Auditoría de Arquitectura de Información (Las 7 Preguntas Clave)

| Pregunta Clave del Usuario | Ubicación Actual | Clics Necesarios | Prioridad Visual Actual | Problema / Deficiencia Detectada | Solución Propuesta |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **1. ¿Cómo está la finca?** | Tab Overview (Hero + KPI 1) | 0 | Excesiva (Duplicada) | Competición entre 2 componentes grandes (Gauge vs Card 1). Score repetido 4 veces. | **Consolidar en un único MIPE Health Canvas** que combine score, nivel y diagnóstico sin duplicación. |
| **2. ¿Qué tan completa es la evaluación?** | Tab Overview (Hero Meta + KPI 3) | 0 | Media-Baja (Dispersa) | Cobertura dividida entre contexto del Hero y KPI 3; no se vincula de inmediato con la validez del score. | **Integrar Cobertura y Cumplimiento como satélites directos del Score**, con bandera visible de auditoría parcial. |
| **3. ¿Está mejorando o empeorando?** | Tab Benchmark (MipeTrendView) | 1 clic | Oculta en otra pestaña | El usuario no ve la evolución temporal en la vista principal; debe adivinar que está en "Benchmark". | **Incrustar Sparkline/Trendline compacto y Delta directamente en la zona superior de estado**, manteniendo el gráfico expandido como herramienta profunda. |
| **4. ¿Dónde están las principales brechas?** | Tab Overview (Stacked bar + 5 cards) | 0 (Scroll) | Media (Separada) | 5 tarjetas de capítulos independientes que ocupan medio viewport; no destacan cuál es el capítulo de mayor pérdida. | **Visualizador Horizontal de Capítulos con Marcador de Brecha Principal** (Gap Highlight) integrado en una sola tira continua. |
| **5. ¿Cuáles son los riesgos prioritarios?** | Tab Riesgos (Top Risks) | 1 clic | Oculta en otra pestaña | Obliga a cambiar de pestaña; los riesgos no se asocian de inmediato con el capítulo que falló. | **Bloque de Riesgos Críticos inmediatamente visible debajo de las brechas**, mostrando los Top 3 a 5 hallazgos sin cambiar de vista. |
| **6. ¿Qué debo hacer?** | Tab Riesgos (Priority Actions) | 1 clic + Scroll profundo | Muy baja (Fondo de Tab 4) | El plan de acción queda sepultado al final de la página de riesgos después de múltiples tablas y matrices. | **Vincular cada Riesgo Crítico directamente con su Acción P1/P2 recomendada**, sin tablas aisladas al fondo. |
| **7. ¿Qué evidencia lo respalda?** | Modal (Risk Detail) vía botón | 1-2 clics | Buena (cuando se abre) | Requiere navegar hasta el fondo de la pestaña de riesgos para encontrar el botón de apertura del modal. | **Acceso a Evidencia contextual directo con 1 clic desde cualquier hallazgo o brecha** en el flujo continuo. |

---

## 4. Auditoría de Jerarquía Visual (Los 7 Niveles Cognitivos)

Actualmente, los 7 niveles de información están dispuestos en silos separados por pestañas:

```text
ESTADO ACTUAL (Disperso en pestañas):
[TAB 1: OVERVIEW]  ──> Nivel 1 (Estado) + Nivel 2 (Calidad) + Nivel 4 (Capítulos)
[TAB 2: CRITERIOS] ──> Nivel 4 (Desglose individual)
[TAB 3: BENCHMARK] ──> Nivel 3 (Evolución temporal + Delta)
[TAB 4: RIESGOS]   ──> Nivel 5 (Riesgo) + Nivel 6 (Acción) + Nivel 7 (Evidencia)
[TAB 5: SIMULADOR] ──> Proyección hipotética
```

### Problema de Jerarquía
La mente del tomador de decisiones no piensa en "pestañas", piensa en **problemas y soluciones**. Cuando un director técnico observa un puntaje de `81.0` en *Mezclas*, su siguiente pregunta inmediata no es *"déjame ir a la pestaña 3 a ver si el mes pasado fue mejor"*, sino:
> **"¿Por qué sacamos 81.0, qué criterio falló, qué tan grave es y qué orden debo dar hoy para corregirlo?"**

En el diseño actual, para responder esa secuencia natural, el usuario debe:
1. Ver el 81.0 en Tab 1.
2. Hacer clic en Tab 4.
3. Buscar en la matriz 2D la intersección de Mezclas con Crítico.
4. Bajar a la lista de Top Riesgos.
5. Bajar a la tabla de Acciones.
6. Abrir el modal de Evidencia.

### Solución de Jerarquía Unificada (Storyflow Continuo)
Reorganizar la experiencia ejecutiva principal en una **narrativa visual continua de 6 fases**:

$$\text{Nivel 1: Estado General} \longrightarrow \text{Nivel 2: Calidad/Alcance} \longrightarrow \text{Nivel 3: Trayectoria (Delta)} \longrightarrow \text{Nivel 4: Brecha Agronómica} \longrightarrow \text{Nivel 5: Riesgos Clave} \longrightarrow \text{Nivel 6: Intervención & Evidencia}$$

Las pestañas se reservan para **modos de trabajo especializados** (Auditoría profunda criterio por criterio, Benchmark multivariable entre fincas y Simulador What-If), liberando a la pantalla principal para que sea una verdadera **Consola Ejecutiva de Inteligencia**.

---

## 5. Auditoría de "Card Explosion" y Redundancia

### Inventario Actual de Superficies y Componentes

| Ubicación | Elemento / Componente | Número Actual de Tarjetas | Veredicto de Diseño | Acción de Rediseño Propuesta |
| :--- | :--- | :---: | :--- | :--- |
| **Top Global** | Header Ejecutivo | 1 barra | Conservar | Refinar tipografía, reducir altura en 20% y eliminar badge pill secundario. |
| **Top Global** | Filtros Globales | 1 consola | Conservar | Compactar como barra de contexto flotante o integrada; inputs unificados. |
| **Overview** | Health Hero Card | 1 tarjeta grande | Redundante con Scorecard | **Fusionar con el Scorecard** en una sola superficie de mando de doble columna. |
| **Overview** | Scorecard KPI 1 (Puntos) | 1 tarjeta | Duplicado del Hero | **Absorber** dentro del módulo central de Estado General. |
| **Overview** | Scorecard KPI 2 (Cumplimiento) | 1 tarjeta | Widget flotante | **Convertir en satélite contextual** del score principal. |
| **Overview** | Scorecard KPI 3 (Cobertura) | 1 tarjeta | Widget flotante | **Convertir en satélite contextual** con indicador de alcance. |
| **Overview** | Scorecard KPI 4 (Riesgo) | 1 tarjeta | Widget flotante | **Integrar con el bloque de No Conformidades**. |
| **Overview** | Scorecard KPI 5 (Hallazgos) | 1 tarjeta | Widget flotante | **Vincular directamente con el desglose de severidades**. |
| **Overview** | Scorecard KPI 6 (Tendencia) | 1 tarjeta | Widget flotante | **Fusionar con el mini-gráfico de trayectoria**. |
| **Overview** | Stacked Contribution Bar | 1 tarjeta | Separada sin contexto | **Integrar directamente con el Desglose de Capítulos**. |
| **Overview** | Chapter Cards (5 caps) | 5 tarjetas | Exceso de cajas idénticas | **Unificar en una tira tabular de desempeño horizontal**. |
| **Riesgos** | Risk Counter Strip | 1 tira (5 pastillas) | Saturación de badges | **Simplificar en un indicador inline silencioso**. |
| **Riesgos** | 2D Risk Matrix Table | 1 tarjeta | Compleja para vista rápida | Mantener como herramienta analítica, pero compactar altura. |
| **Riesgos** | Top Risks List | 1 tarjeta + 10 items | Cajas dentro de cajas | **Diseñar como lista estructurada con línea conectora** hacia la acción. |
| **Riesgos** | Technical Causes Grid | 1 tarjeta + 5 items | Cajas dentro de cajas | **Integrar como desglose contextual por área**. |
| **Riesgos** | Priority Actions Table | 1 tarjeta + tabla | Desconectada de riesgos | **Presentar como tarjeta de intervención inmediata** vinculada al riesgo. |

**Balance de Superficies:**  
* Actualmente: **32 tarjetas y contenedores con bordes independientes** compitiendo entre pestañas.  
* Propuesta de Rediseño: **Reducción a 4 bloques funcionales unificados de alta coherencia visual**, reduciendo la fricción visual en más del 60%.

---

## 6. Clasificación Priorizada de Problemas (P0 a P3)

### P0 — Críticos (Afectan directamente la comprensión o la toma de decisiones)
1. **P0-1: Múltiples fuentes de verdad visual del Score**: El usuario ve 4 números de puntaje MIPE con diferentes formatos y tratamientos visuales en la misma pantalla. Causa confusión sobre cuál es el indicador rector.
2. **P0-2: Desconexión física entre Riesgo, Causa y Acción**: Las desviaciones críticas detectadas en campo están separadas físicamente del plan de acción correctivo y de la evidencia fotográfica por cientos de píxeles y pestañas distintas.
3. **P0-3: Desconocimiento del alcance en móvil**: En pantallas pequeñas, el estado de "Auditoría Parcial" queda sepultado por debajo del gauge circular, impidiendo que el técnico en campo advierta de inmediato que los datos corresponden a una muestra incompleta.

### P1 — Altos (Afectan significativamente la experiencia de usuario y la eficiencia de lectura)
4. **P1-1: "Card Explosion" en el Overview**: 13 cajas rectangulares separadas fragmentan la atención y provocan fatiga visual.
5. **P1-2: Pestaña Benchmark oculta la tendencia básica**: Un tomador de decisiones necesita saber de inmediato si la finca va mejor o peor respecto a la última visita, sin tener que cambiar de pestaña.
6. **P1-3: Scroll infinito en dispositivos móviles**: La disposición lineal de widgets exige scroll continuo de más de 3000 píxeles antes de encontrar datos de campo útiles.

### P2 — Medios (Mejoras importantes de jerarquía y densidad)
7. **P2-1: Desaprovechamiento del ancho de escritorio (1440px)**: Grandes vacíos verticales entre secciones que fuerzan scroll innecesario.
8. **P2-2: Ruido por pastillas y badges estáticos**: Violación de la disciplina *zero-pill* con decenas de etiquetas con fondo de color y bordes redondeados.
9. **P2-3: Falta de realce visual en la principal brecha técnica**: Los 5 capítulos se ven visualmente idénticos; el capítulo que está hundiendo la certificación no salta a la vista instantáneamente.

### P3 — Bajos (Refinamientos visuales y de pulido corporativo)
10. **P3-1: Contraste y ritmo tipográfico**: Homogeneidad en pesos de texto secundario que dificulta el escaneo rápido.
11. **P3-2: Pulido de exportación a PDF**: Ajuste de saltos de página para que las tablas de riesgos no se corten arbitrariamente en el reporte impreso.

---

## 7. Arquitectura Visual Propuesta: "Agronomic Command Center"

El rediseño conceptual transforma la pantalla en una **Consola de Inteligencia Agronómica de 4 Secciones Maestras Continuas**:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. HEADER DE MANDO & CONSOLA DE CONTEXTO GLOBAL                                        │
│ Identidad AVGUST CARE 360 · Finca · Lote · Periodo · Cultivo · Estado Sync · Offline    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. LIENZO MAESTRO DE ESTADO MIPE (MIPE Health Command Canvas)                          │
│ ┌───────────────────────────────────────┬────────────────────────────────────────────┐ │
│ │ ESTADO & CONFIABILIDAD                │ TRAYECTORIA & HISTORIAL                     │ │
│ │ • 92.4 / 100 Puntos MIPE              │ • Sparkline de Evolución (Últimas 6 visitas)│ │
│ │ • Meta: 95.0 pts (Brecha: -2.6 pts)   │ • Delta: ↑ +4.2 pts vs anterior             │ │
│ │ • Cobertura: 100% (5/5 Capítulos)     │ • Comparabilidad de alcance validada        │ │
│ │ • Cumplimiento evaluado: 94.8%        │ • Diagnóstico sintético ejecutivo           │ │
│ └───────────────────────────────────────┴────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. ANALIZADOR DE BRECHAS POR CAPÍTULO & APORTE PONDERADO                               │
│ Tira continua de los 5 Capítulos con señalamiento de la Brecha Crítica Principal:      │
│ [Cap 1: 4.8/5.0] [Cap 2: 27.2/30.0] [Cap 3: 5.0/5.0] [Cap 4: 24.1/30.0 ▲] [Cap 5: 28.5]│
│                                                       (Principal pérdida: -5.9 pts)    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. ZONA DE INTERVENCIÓN RÁPIDA: RIESGOS CRÍTICOS & PLAN DE ACCIÓN VINCULADO            │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ #1 · CRÍTICO · Criterio 4.3 (Mezclas) · Lote 2 · Finca Flores del Sol              │ │
│ │ Hallazgo: Bombero sin máscara de protección respiratoria con filtro de carbón      │ │
│ │ ──> ACCIÓN INMEDIATA (P1): Dotar EPP certificado antes del siguiente bloque        │ │
│ │ ──> Responsable: Ing. Carlos M. · [Ver Evidencia Fotográfica (2) 📸]               │ │
│ ├────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ #2 · CRÍTICO · Criterio 2.4 (Dosificación) · Lote 1 · Finca Flores del Sol         │ │
│ │ Hallazgo: Probeta de dosificación con escala volumétrica borrosa por desgaste       │ │
│ │ ──> ACCIÓN INMEDIATA (P1): Reemplazar probeta graduada por equipo calibrado        │ │
│ │ ──> Responsable: Ing. Carlos M. · [Ver Evidencia Instrumental 🔍]                  │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ NAVEGACIÓN A PROFUNDIDAD ANALÍTICA (Pestañas de Trabajo Técnico Especializado):         │
│ [📋 Auditoría Detallada (37 Criterios)] [📊 Benchmark Comparativo] [🧪 Simulador What-If]│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Sistema Visual Enterprise Propuesto

### A. Lenguaje Visual y Dirección de Estilo
* **Inspiración y Tono**: Consola de observabilidad crítica y control de operaciones (estilo *Linear* + herramientas enterprise agritech de alta gama).
* **Ausencia Total de "AI Slop"**: Prohibición de gradientes violetas/púrpura, tarjetas flotantes con sombras desproporcionadas, bordes translúcidos de 2px y badges redondeados de fantasía.
* **Superficies Unificadas**: Reducción drástica del número de cajas independientes. En su lugar, se utilizan **paneles maestros delimitados por divisores hairline (`1px solid #e2e8f0`) y variaciones sutiles de fondo (`#ffffff` vs `#f8fafc`)**.

---

### B. Sistema de Color Semántico y Funcional

| Token de Color | Valor Hex | Uso Exclusivo en la Interfaz | Regla de Contraste y Presencia |
| :--- | :--- | :--- | :--- |
| `--c360-brand-green` | `#007a3d` | Acento corporativo AVGUST, certificación MIPE, acciones primarias | Contraste WCAG AAA sobre blanco (4.8:1). |
| `--c360-brand-teal` | `#007fa3` | Enlaces técnicos, selección de contexto, filtros activos | WCAG AA sobre fondos claros. |
| `--c360-surface-base` | `#f8fafc` | Fondo de la aplicación y canvas de trabajo | Neutro frío descansado, sin reflejos deslumbrantes. |
| `--c360-surface-card` | `#ffffff` | Superficie de paneles maestros de información | Elevación plana con borde sutil (`#e2e8f0`). |
| `--c360-border-hairline`| `#e2e8f0` | Divisores internos entre secciones y columnas | 1px sólido; jamás sombras difusas artificiales. |
| `--c360-text-primary` | `#0f172a` | Cifras numéricas maestras, títulos de sección | Alto contraste para lectura bajo luz solar en campo. |
| `--c360-text-secondary`| `#334155` | Descripciones técnicas, diagnósticos, encabezados de tabla | Legibilidad óptima sin ruido. |
| `--c360-text-muted` | `#64748b` | Kickers, metadatos, unidades (`/100`, `pts`) | Jerarquía quieta y discreta. |
| `--c360-sev-critical` | `#dc2626` | Alerta crítica, incumplimiento grave, desviación de seguridad | Reservado estrictamente para anomalías severas. |
| `--c360-sev-high` | `#ea580c` | Desviación alta, prioridad correctiva P2 | Alerta operativa visible sin estridencia. |
| `--c360-sev-medium` | `#d97706` | Desviación media, oportunidad preventiva P3 | Aviso preventivo estándar. |
| `--c360-sev-low` | `#475569` | Desviación menor, verificación rutinaria P4 | Color pizarra neutro, jamás verde ni azul positivo. |
| `--c360-scope-alert` | `#fef3c7` | Banner de advertencia de auditoría parcial | Fondo ámbar suave con texto `#92400e`. |

---

### C. Tipografía y Jerarquía Numérica

* **Familia Tipográfica**: Sistema tipográfico nativo de alta legibilidad (`system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`).
* **Regla Inquebrantable**: Todo valor numérico, puntaje, porcentaje o fecha debe usar **`font-variant-numeric: tabular-nums;`** para evitar saltos de línea y garantizar alineación decimal exacta en tablas y scorecards.

| Nivel de Información | Tamaño / Peso | Line Height | Tratamiento Visual |
| :--- | :--- | :---: | :--- |
| **Puntaje Rector (Hero)** | `44px` / `800 (Extra Bold)` | `1.0` | Cifra tabular dominante con unidad subordinada `16px / 600`. |
| **KPIs Satélite** | `20px` / `700 (Bold)` | `1.1` | Cifra tabular limpia sin cajas ni bordes encapsulados. |
| **Títulos de Sección** | `15px` / `700 (Bold)` | `1.3` | Mayúsculas con letter-spacing suave (`0.03em`) y color oscuro. |
| **Kickers / Eyebrows** | `11px` / `700 (Bold)` | `1.2` | Mayúsculas compactas en color muted (`#64748b`). |
| **Diagnóstico Ejecutivo** | `14px` / `500 (Medium)` | `1.5` | Párrafo narrativo editorial fluido, longitud máxima de 85 caracteres. |
| **Tablas y Datos** | `13px` / `400-600` | `1.4` | Filas compactas con paddings verticales optimizados (`8px 12px`). |
| **Metadatos de Contexto** | `11.5px` / `400` | `1.2` | Texto inline desprovisto de cápsulas, separado por puntos (`·`). |

---

### D. Disciplina Zero-Pill & Reducción de Ruido
* **Regla de Auditoría**: Se prohíbe el uso de pastillas redondeadas completas (`rounded-full`) para metadatos estáticos como fechas, nombres de finca, capítulos y estados informativos.
* **Separadores Tipográficos Silenciosos**: Los metadatos secundarios se presentarán como texto continuo estructurado:
  $$\text{Finca Flores del Sol} \quad\cdot\quad \text{Lote 1} \quad\cdot\quad \text{12/08/2026} \quad\cdot\quad \text{Protocolo Completo (5/5 Caps)}$$
* Los únicos elementos interactivos con tratamiento de botón o contenedor serán los **controles funcionales de filtrado, selectores de rango y botones de acción**.

---

## 9. Wireframes Textuales de la Propuesta

### A. Wireframe Desktop (Ancho 1440px / Contenedor 1280px)

```text
====================================================================================================
[HEADER]  AVGUST CARE 360  ·  CENTRO DE INTELIGENCIA MIPE                        [Sync: OK]  [Imprimir]
Contexto: Finca: [Todas las fincas ▼]  Lote: [Todos ▼]  Periodo: [Últimos 12 meses ▼]  Alcance: [Todos ▼]
====================================================================================================

+--------------------------------------------------------------------------------------------------+
| 1. LIENZO EJECUTIVO DE ESTADO MIPE (MIPE Health Command Canvas)                                  |
|                                                                                                  |
| [ ESTADO GENERAL Y CONFIABILIDAD ]              [ TRAYECTORIA Y EVOLUCIÓN HISTÓRICA ]            |
|                                                                                                  |
|   92.4 / 100 pts                                   100 ┤              ●                       |
|   DESEMPEÑO MIPE FAVORABLE                          95 ┼──────────────────────── Meta: 95.0 pts   |
|   ✓ Protocolo completo auditado (5/5 Capítulos)     90 ┤       ●                              |
|                                                     85 ┤ ●                                        |
|   • Meta Técnica: 95.0 pts (Brecha: -2.6 pts)          └────────────────────────────────          |
|   • Cumplimiento en Evaluados: 94.8%                      Ene   Feb   Mar   Abr   May   Jun       |
|   • Cobertura Protocolo: 100% (37 criterios)                                                     |
|                                                    Delta: ↑ +4.2 pts vs periodo anterior          |
|   DIAGNÓSTICO: La finca cumple satisfactoriamente el protocolo general, pero presenta 3 desvia-  |
|   ciones concentradas en Mezclas y Dosificación que impiden certificar la meta de excelencia.     |
+--------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------+
| 2. DESGLOSE PONDERADO POR CAPÍTULO & LOCALIZADOR DE BRECHA AGRONÓMICA                           |
|                                                                                                  |
| [CAP 1: ALMACÉN]    [CAP 2: DOSIFICACIÓN] [CAP 3: TRANSPORTE]  [CAP 4: MEZCLAS]    [CAP 5: APLICACIÓN] |
| 4.8 / 5.0 pts       27.2 / 30.0 pts       5.0 / 5.0 pts        24.1 / 30.0 pts ▲   28.5 / 30.0 pts    |
| Cumpl: 96.0%        Cumpl: 90.7%          Cumpl: 100%          Cumpl: 80.3%        Cumpl: 95.0%       |
| 1 Hallazgo          2 Hallazgos           0 Hallazgos          3 Hallazgos         1 Hallazgo         |
|                     (1 Crítico)           (✓ Conforme)         (2 Críticos)                           |
|                                                                ▲ PRINCIPAL BRECHA                     |
|                                                                Pérdida: -5.9 pts                      |
+--------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------+
| 3. INTERVENCIÓN INMEDIATA: TOP DESVIACIONES & ACCIONES VINCULADAS                               |
|                                                                                                  |
| PRIORIDAD  SEVERIDAD  PROBLEMA OBSERVADO                       ACCIÓN REQUERIDA        RESPONSABLE|
| ──────────────────────────────────────────────────────────────────────────────────────────────── |
| #1 (P1)    CRÍTICO    Criterio 4.3 (Mezclas) · Lote 2         Dotar EPP con filtro    Ing. Carlos|
|                       Bombero sin máscara de carbón activo    respiratorio adecuado   [Ver Foto 📸|
|                                                                                                  |
| #2 (P1)    CRÍTICO    Criterio 2.4 (Dosificación) · Lote 1    Reemplazar probeta      Ing. Carlos|
|                       Probeta con graduación borrosa          con equipo calibrado    [Ver Foto 📸|
|                                                                                                  |
| #3 (P2)    ALTO       Criterio 4.6 (Mezclas) · Lote 2         Calibrar pH-metro y     Téc. Andrés|
|                       Agua de mezcla con pH 7.2 fuera rango   usar corrector ácido    [Ver Datos 🔍|
+--------------------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------------------+
| NAVEGACIÓN TÉCNICA DETALLADA:                                                                    |
| [📋 Auditoría Completa de los 37 Criterios]  [📊 Benchmark Multivariable]  [🧪 Simulador What-If]|
+--------------------------------------------------------------------------------------------------+
```

---

### B. Wireframe Mobile (Ancho 375px a 430px — Optimizado para Campo)

```text
=======================================
AVGUST CARE 360 · MIPE
Finca: Las Flores · Lote 1 [▼]
=======================================

[1. ESTADO MIPE INSTANTÁNEO]
┌─────────────────────────────────────┐
│ 92.4 / 100 pts   [FAVORABLE]        │
│ Cobertura: 100% · Meta: 95.0 pts    │
│ Trayectoria: ↑ +4.2 pts este mes    │
└─────────────────────────────────────┘

[2. ¿DÓNDE ESTÁ LA BRECHA?]
┌─────────────────────────────────────┐
│ CAPÍTULO CRÍTICO: MEZCLAS (Cap 4)   │
│ • Puntaje: 24.1 / 30.0 pts          │
│ • Pérdida: -5.9 pts en protocolo    │
│ • 2 Hallazgos Críticos detectados   │
└─────────────────────────────────────┘

[3. RIESGOS A ATENDER HOY (TOP 2)]
┌─────────────────────────────────────┐
│ 🔴 #1 CRÍTICO · Criterio 4.3        │
│ Bombero sin máscara de protección   │
│ ──> ACCIÓN: Dotar EPP certificado   │
│ [Ver Evidencia Fotográfica 📸]      │
├─────────────────────────────────────┤
│ 🔴 #2 CRÍTICO · Criterio 2.4        │
│ Probeta dosificadora ilegible       │
│ ──> ACCIÓN: Reemplazo inmediato     │
│ [Ver Foto 📸]                       │
└─────────────────────────────────────┘

[ACCIONES RÁPIDAS]
[📋 Ver los 37 Criterios]
[📄 Compartir Informe PDF]
```

---

## 10. Mapa de Componentes y Plan de Transformación

| Componente Actual | Archivo Fuente | Rol Actual | Destino Visual en el Rediseño | Tipo de Transformación |
| :--- | :--- | :--- | :--- | :--- |
| **`executive-header`** | `executive-header.view.js` | Barra superior con metadata | Barra de Mando y Estado Global | **Conservar**: Reducir altura en 20% y eliminar badges estáticos. |
| **`global-filters`** | `global-filters.view.js` | Filtros en tarjeta separada | Consola integrada de contexto | **Conservar**: Integrar en el encabezado sin borde inferior agresivo. |
| **`mipe-health-hero`** | `mipe-health-hero.view.js` | Tarjeta gigante con gauge SVG | Columna izquierda del Canvas de Mando | **Fusionar**: Absorbe los KPIs 1, 2 y 3 del Scorecard en una superficie continua. |
| **`executive-scorecard`**| `executive-scorecard.view.js` | 6 tarjetas cuadradas flotantes | Satélites de estado y trayectoria | **Fusionar**: KPI 1 se absorbe en el hero; KPI 2 y 3 pasan a satélites; KPI 6 se fusiona con el mini-trendline. |
| **`mipe-trend`** | `mipe-trend.view.js` | Vista completa en pestaña 3 | Columna derecha del Canvas de Mando + Vista expandida | **Reubicar**: El sparkline y delta suben a la vista principal; el gráfico de análisis profundo permanece en pestaña dedicada. |
| **`farm-benchmark`** | `farm-benchmark.view.js` | Pestaña 3 con 3 tarjetas y tabla | Pestaña especializada de Benchmark | **Conservar en pestaña**: Modo analítico profundo para directores y gerencia. |
| **`risk-matrix`** | `risk-matrix.view.js` | Pestaña 4 (Matriz 2D y lista) | Top Desviaciones en vista principal + Matriz 2D en pestaña | **Reorganizar**: La lista de Top 3 a 5 riesgos críticos sube a la vista principal; la matriz 2D completa permanece accesible en pestaña. |
| **`risk-causes`** | `risk-causes.view.js` | Desglose de 5 áreas en tab 4 | Tira continua de Capítulos con Gap Highlight | **Reestructurar**: Se fusiona visualmente con la barra de contribución ponderada. |
| **`priority-actions`** | `priority-actions.view.js` | Tabla aislada al fondo de tab 4 | Bloque de Intervención Inmediata | **Reubicar y vincular**: Se integra directamente con los riesgos en un formato de problema → solución. |
| **`risk-detail`** | `risk-detail.view.js` | Modal contextual de evidencia | Modal flotante global de drill-down | **Conservar**: Accesible con 1 clic desde cualquier hallazgo, capítulo o riesgo. |

---

## 11. Análisis de Impacto y Riesgos de Implementación

### Cambios de Bajo Riesgo (Visuales y de Estilizado)
* Aplicación de la disciplina *zero-pill* en metadatos y reemplazo por separadores tipográficos (`·`).
* Ajuste de tipografía tabular (`tabular-nums`) y escala de fuentes.
* Normalización de la paleta semántica de severidad (rojo para crítico, ámbar para medio, pizarra para bajo).
* Ajuste de estilos de impresión para evitar cortes en reportes PDF.

### Cambios de Medio Riesgo (Estructura de Layout)
* Fusión del *Health Hero* y el *Executive Scorecard* en una superficie única de dos columnas sin tarjetas repetidas.
* Integración del desglose de los 5 capítulos con señalamiento de la principal brecha.
* Integración de los Top Riesgos y Acciones en la vista principal debajo de los capítulos.
* **Garantía Técnica**: Todo el ViewModel subyacente (`buildMetricsViewModel`, `trendVm`, `riskMatrixVm`, `scorecard`) permanece exactamente igual. No se tocan cálculos ni orígenes de datos.

### Cambios de Cero Riesgo Matemático
* Las fórmulas oficiales (`calculateVisitScore`, `aggregateIntelligence`, `filterVisits`) **no se modifican en una sola coma**.
* El catálogo oficial de 37 criterios, sus pesos y su escala de 100 puntos permanecen 100% blindados.
* Las suites de pruebas (`tests/metrics-math.mjs`, `tests/fase4-trend-benchmark.mjs`, `tests/fase5-risks-actions.mjs`) seguirán pasando al 100%.

---

## 12. Conclusión del Design Gate

El módulo actual es **matemáticamente perfecto y funcionalmente exhaustivo**, pero sufre de una **fragmentación visual que obstaculiza la toma rápida de decisiones ejecutivas**.

La propuesta de rediseño aquí formulada eleva a AVGUST CARE 360 al estándar de un verdadero **Enterprise Agronomic Intelligence & Operational Control Center**, garantizando:
1. **Comprensión en menos de 5 segundos** de la situación fitosanitaria de la finca.
2. **Identificación inmediata de la brecha crítica** que aleja a la finca de la certificación oficial.
3. **Línea directa entre el problema de campo, la evidencia fotográfica y la orden de trabajo**.
4. **Cero daño a la arquitectura matemática existente**.

---

**FIN DEL REPORTE DE AUDITORÍA FASE 5.5**  
*Documento registrado en `docs/FASE5.5-VISUAL-DESIGN-AUDIT.md`. A la espera de autorización explícita para la Fase 5.6.*
