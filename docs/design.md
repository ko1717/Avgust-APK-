# AVGUST CARE 360 · DESIGN SYSTEM & ARCHITECTURE SPECIFICATION (`design.md`)

> **Documento Oficial de Diseño, Arquitectura Visual y Principios UX/UI**  
> **Proyecto:** AVGUST CARE 360 — Sistema de Aseguramiento Fitosanitario y Control MIPE  
> **Identidad Corporativa:** Avgust Crop Protection (*"Juntos Crecemos Bien"*)  
> **Audiencia:** Desarrolladores, Diseñadores de Producto, Agrónomos e Interventores Técnicos  
> **Versión:** 2.4 (Revisión Integral de Métricas, Tarjetas y Principios Anti-Slop)

---

## 1. Visión y Propósito del Diseño

El propósito de la interfaz de **AVGUST CARE 360** es transformar auditorías agrícolas complejas en información técnica de alto valor, ejecutable y visualmente impecable para tomadores de decisiones (Directores Técnicos, Gerentes de Finca, Auditores GlobalGAP/Florverde/ICA y Técnicos Avgust).

### Principios Rectores:
1. **Claridad sobre Ruido (*Data Density with High Legibility*)**: No ocultamos la complejidad técnica; la estructuramos de manera jerárquica para que un agrónomo detecte en menos de 3 segundos el estado crítico de una finca.
2. **Cero "AI-Slop" y Cero Saturación de Cápsulas (*Zero-Pill Discipline*)**: Eliminamos cápsulas redundantes, etiquetas flotantes innecesarias y degradados genéricos morados/rosas. Los metadatos son limpios, con separadores tipográficos discretos (`·`, `/`).
3. **Identidad de Marca Avgust Auténtica**: Fuerte impronta agronómica e industrial que refleja la robustez científica de Avgust Crop Protection.
4. **Retroalimentación Interactiva Inmediata**: Cada componente clave (como las tarjetas KPI o los gráficos de dispersión) está conectado bidireccionalmente con el resto del tablero para permitir exploración analítica sin fricciones.

---

## 2. Paleta Cromática Institucional de Avgust

La paleta sigue las pautas oficiales de marca para el sector agroquímico y floricultor:

| Token / Variable CSS | Valor Hex | Rol Semántico en la Interfaz | Ejemplo de Uso |
| :--- | :--- | :--- | :--- |
| `--avgust-cyan` | `#007fa3` | **Primario Corporativo Avgust** | Bordes de acento principal, botones primarios, curva MIPE en gráficas. |
| `--avgust-cyan-dark` | `#005f7a` | **Cian Profundo** | Hover de botones, textos de alto contraste, línea de cobertura. |
| `--avgust-cyan-light` | `#00b5e2` | **Cian Fitosanitario / Agua** | Cumplimiento de criterios, gradientes de fondo sutiles, detalles analíticos. |
| `--avgust-green` | `#78be20` | **Verde Agro Avgust (Salud Vegetal)** | Cumplimiento Óptimo (≥ 95%), Dosificación (Cap 2), cero hallazgos. |
| `--avgust-green-dark` | `#15803d` / `#5c9914` | **Verde Bosque / Éxito** | Texto de estados óptimos y etiquetas de meta en gráficas. |
| `--avgust-gold` | `#f2a900` | **Oro Cosecha Avgust (Advertencia)** | Rango Aceptable (85-94%), Transporte (Cap 3), desviaciones no críticas. |
| `--avgust-gold-dark` | `#b45309` | **Ámbar / Alerta** | Texto de advertencias, líneas de umbral de 85%. |
| `--avgust-red` | `#dc2626` | **Riesgo Crítico / No Conformidad** | Puntuaciones < 85%, desviaciones recurrentes, respuestas "No". |
| `--avgust-slate-900` | `#0f172a` | **Neutro Primario / Títulos** | Títulos de tarjetas, cifras numéricas tabulares principales. |
| `--avgust-slate-500` | `#64748b` | **Neutro Secundario / Metadatos** | Subtítulos de contexto, etiquetas de ejes, textos descriptivos. |
| `--avgust-bg-surface` | `#ffffff` a `#fbfcfd` | **Superficie de Tarjeta** | Fondo limpio de tarjetas con micro-gradiente vertical. |

---

## 3. Tipografía y Estructura Numérica

- **Familia Tipográfica:** Inter / System UI, optimizada para legibilidad tabular con `font-feature-settings: "cv02", "cv03", "cv04", "cv11"`.
- **Figuras Tabulares (`tabular-nums`):** Obligatorio en todos los porcentajes, puntajes (ej. `88.5%`, `28.0 / 30 pts`), deltas y fechas para evitar oscilaciones de ancho en listas y tablas.
- **Escala Jerárquica de Tarjetas KPI:**
  - **Kicker / Categoría:** `10px - 11px`, `font-weight: 800`, `letter-spacing: 0.08em`, en mayúsculas, acompañado de icono lineal monocromático (12px).
  - **Título del KPI:** `12px - 13px`, `font-weight: 700`, color neutro oscuro (`#0f172a`).
  - **Métrica / Valor Principal:** `28px - 32px`, `font-weight: 800`, `line-height: 1.05`, tabular.
  - **Subtítulo de Soporte:** `11.5px - 12px`, `font-weight: 600`, color slate balanceado.
  - **Sparkline Integrado:** Altura estándar de `36px - 40px`, curva suavizada con gradiente de llenado semitransparente.
  - **Texto de Interpretación Ejecutiva (*Executive Copy*):** `11px - 12px`, `font-weight: 500`, interlineado relajado (`line-height: 1.45`), redactado en español técnico con referencia directa a las normas técnicas.

---

## 4. Anatomía de las Tarjetas de Métricas Rediseñadas

Las 5 tarjetas maestras del módulo de métricas se estructuran según los siguientes requerimientos:

```
┌─────────────────────────────────────────────────────────────┐
│ [Icono] CATEGORÍA MIPE (10px)          ESTADO (Badge sutil) │
│ Título del Indicador (12px)                                 │
│ Subtítulo de contexto inmediato                             │
├─────────────────────────────────────────────────────────────┤
│ 94.5%   (94.5 / 100 pts oficiales)                          │
├─────────────────────────────────────────────────────────────┤
│ ~~~~~~~ SPARKLINE INTERACTIVO (Recharts Area/Line) ~~~~~~~~ │
├─────────────────────────────────────────────────────────────┤
│ Interpretación Ejecutiva:                                   │
│ "Nivel Aceptable (85-94%): finca bajo control operativo;   │
│ subsanar desviaciones abiertas para consolidar el 95%."     │
├─────────────────────────────────────────────────────────────┤
│ ━━━━━━━ Barra de progreso con marcas de umbral (85% y 95%) ━│
└─────────────────────────────────────────────────────────────┘
```

### Detalle de Contenido por Tarjeta:

1. **Tarjeta 1: Índice MIPE Ponderado (Programa Oficial MIPE)**
   - *Categoría:* `PROGRAMA OFICIAL MIPE` (Color: Cian `#007fa3`, Icono: `ShieldCheck`).
   - *Valor Principal:* Porcentaje global ponderado (ej. `92.0%`) y desglose `(puntos ganados / 100 pts oficiales)`.
   - *Sparkline:* Histórico temporal del score por visita.
   - *Interpretación:* Clasificación normativa clara (Óptimo $\ge$ 95%, Aceptable 85-94%, Crítico < 85%).
   - *Interacción:* Clic enfoca la gráfica principal en `score`.

2. **Tarjeta 2: Trayectoria Temporal (Variación vs Línea Base)**
   - *Categoría:* `TRAYECTORIA HISTÓRICA` (Color: Verde `#78be20`, Icono: `TrendingUp`).
   - *Valor Principal:* Delta acumulado vs primera visita registrada (ej. `+14.0 pts`).
   - *Contexto:* Delta vs visita inmediatamente anterior (ej. `+2.0 pts vs previa`).
   - *Sparkline:* Curva de deltas acumulados.
   - *Interpretación:* Análisis de tendencia (sostenida, retroceso o desempeño estable).
   - *Interacción:* Clic activa la vista comparativa `both` en la gráfica.

3. **Tarjeta 3: Tasa de Conformidad (37 Criterios Técnicos)**
   - *Categoría:* `37 CRITERIOS TÉCNICOS` (Color: Cian `#00b5e2`, Icono: `CheckCircle2`).
   - *Valor Principal:* Porcentaje de aprobación aritmética directa (ej. `88.5%`).
   - *Contexto:* Conteo de criterios conformes (ej. `26/29 conformes`).
   - *Aclaración Metodológica:* Exclusión estricta de ítems "No Aplica" sin penalizar el puntaje.
   - *Interacción:* Clic enfoca la gráfica en `compliance`.

4. **Tarjeta 4: Hallazgos Abiertos (Desviaciones y Riesgos)**
   - *Categoría:* `DESVIACIONES Y RIESGOS` (Color: Rojo `#dc2626` / Verde `#78be20`, Icono: `AlertTriangle` / `CheckCircle2`).
   - *Valor Principal:* Número de respuestas "No" activas.
   - *Contexto:* Desglose entre hallazgos *recurrentes* y *nuevas desviaciones*.
   - *Sparkline:* Evolución del número de fallas en el tiempo.
   - *Interacción:* Clic enfoca la vista de `findings`.

5. **Tarjeta 5: Cobertura Normativa (Alcance Auditado)**
   - *Categoría:* `ALCANCE AUDITADO` (Color: Cian Profundo `#005f7a`, Icono: `Layers`).
   - *Valor Principal:* Capítulos evaluados sobre el total (ej. `5/5 procesos` o `3/5`).
   - *Contexto:* Porcentaje de peso ponderado evaluado (ej. `100% peso` o `40% peso`).
   - *Aclaración:* Distinción explícita entre auditoría integral completa y auditoría focalizada.
   - *Interacción:* Clic enfoca la vista en `coverage`.

---

## 5. Arquitectura del Gráfico Central de Evolución

El gráfico interactivo (`AreaChart` con Recharts) es el corazón del análisis longitudinal:

- **Ejes Limpios y Asépticos:** Eje X sin líneas superfluas (`tickLine={false}`, `axisLine={false}`), etiquetas de fecha formateadas en español (`dd/mmm/aaaa`).
- **Líneas de Referencia Normativa Fijas:**
  - `Meta Óptima Oficial MIPE (≥ 95%)`: Línea segmentada en verde oscuro (`#16a34a`), grosor 2px, texto superior derecho.
  - `Umbral Aceptable (85%)`: Línea segmentada en ámbar (`#d97706`), grosor 1.5px, texto inferior derecho.
- **Selector de Rango Rápido Segmentado:** Botones de cambio de vista (*Ambos Índices, Solo Índice MIPE, 5 Procesos MIPE, Solo Conformidad, Hallazgos, Cobertura*) con estado activo en blanco puro y sombra suave.
- **Tooltip Técnico Contextual (`CustomTooltip`):**
  - Fondo oscuro de alto contraste (`#0f172a`).
  - Muestra la fecha exacta, estado general con insignia de color, Índice MIPE, Puntos Ganados, Cumplimiento de Criterios, Cobertura y Hallazgos.
  - Si está en vista de *5 Procesos*, muestra el desglose exacto de cada capítulo con sus pesos:
    - 1. Almacén (5%)
    - 2. Dosificación (30%)
    - 3. Transporte (5%)
    - 4. Mezclas (30%)
    - 5. Aplicación (30%)

---

## 6. Banner de Oportunidad de Mayor Impacto (*Bottleneck Insight*)

Ubicado inmediatamente debajo de los KPIs, detecta de forma algorítmica qué capítulo generó la mayor pérdida de puntos oficiales en la última visita:
- **Iconografía:** `Target` en contenedor ámbar.
- **Texto:** Identifica el capítulo, la brecha de puntos perdidos y los hallazgos específicos que la causaron.
- **Botón de Acción Rápida:** *"Revisar Desglose de Capítulos →"* que conmuta automáticamente la gráfica a la vista de los 5 procesos.

---

## 7. Módulo de Alertas Técnicas y Hallazgos Críticos

Clasificación jerárquica de problemas detectados:
1. **Recurrente Crítico (`isRecurrent`):** Falla presente en visitas consecutivas sin subsanar. Borde rojo `#dc2626`, fondo rosado claro, icono `ShieldAlert`.
2. **Reincidente Histórico (`isReincident`):** Falla que había cerrado o desaparecido pero reaparece en la última auditoría. Borde ámbar `#f2a900`, icono `AlertTriangle`.
3. **Nueva Desviación (`isNew`):** Detectada por primera vez en el informe actual. Borde azul grisáceo, icono `Info`.

---

## 8. Especificación Técnica de Accesibilidad y Modo Oscuro

- **Contraste Mínimo:** Todos los textos cumplen la pauta WCAG AA (ratio mínimo 4.5:1 frente a su fondo respectivo).
- **Modo Oscuro Soportado:** 
  - Fondos mutan a `#0f172a` y bordes a `#1e293b`.
  - Los colores corporativos de Avgust se adaptan con variantes más luminosas (`#38bdf8` para cian, `#a3e635` para verde, `#fcd34d` para oro).
- **Impresión / Reporte PDF (`@media print`):**
  - Ocultamiento de controles de filtro (`no-print`).
  - Membrete institucional con logotipo de Avgust y leyenda oficial de negocio.
  - Despliegue en fondos blancos limpios sin desperdicio de tinta.

---

## 9. Próximas Mejoras Recomendadas (Roadmap UX)

1. **Modo Comparativa Lado a Lado (Finca vs Promedio de Flota):** Incorporar en la tarjeta del Índice MIPE un indicador que muestre la distancia frente a la media nacional de fincas auditadas.
2. **Simulador de Impacto Correctivo (*What-If Scenario*):** Permitir al agrónomo marcar una desviación como "subsanada" para ver en tiempo real cómo subiría el puntaje antes del próximo informe oficial.
3. **Exportación Modular:** Permitir copiar cada tarjeta KPI como imagen o gráfico vectorizado para presentaciones a gerencia.
