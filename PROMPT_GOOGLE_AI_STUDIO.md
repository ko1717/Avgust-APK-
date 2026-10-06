# Prompt para Google AI Studio - AVGUST CARE 360 Métricas Visuales

## Contexto del Proyecto

Estoy trabajando en **AVGUST CARE 360**, una aplicación web B2B de auditoría agrícola que evalúa fincas según la matriz MIPE normativa (5 capítulos, 37 criterios, 100 puntos máximo). La aplicación usa:

- **Stack:** React 19 + TypeScript + Recharts (gráficos) + Tailwind CSS + SQL.js (offline)
- **Almacenamiento:** SQLite (binario .care360, importación/exportación)
- **Responsabilidad:** Técnicos de campo evalúan fincas en visitas. Los administradores visualizan métricas consolidadas.

---

## Mejoras Visuales Implementadas

He actualizado la rama `feat/avgust-metrics-95` con estos cambios **solo de interfaz** (sin alterar fórmulas MIPE ni estados):

### 1. **Meta Visual AVGUST: 95%**
   - Constante visual en `app/metric-display.ts`: `АВГУСТ_COMPLIANCE_TARGET = 95`
   - Aparece en 3 dashboards:
     - **Métricas por finca** (`app/metrics-panel.tsx`): meta en KPI, línea de referencia en gráfica
     - **Consolidado** (`app/consolidated-metrics.tsx`): meta en KPI, línea en línea temporal
     - **Detalles de capítulo** (`app/metric-chapter-details.tsx`): meta en tarjeta de resumen
   - En gráficos de hallazgos (% "No"), la meta equivalente es máximo **5% de "No"** (100 - 95)

### 2. **Colores АВГУСТ**
   - **Verde:** `#78be20` (meta АВГУСТ, saludable)
   - **Cian:** `#007fa3` (primario, cuerpo, highlight)
   - **Grafito:** `#333f48` (texto oscuro)
   - **Dorado:** `#f2a900` (acentos secundarios)

### 3. **Evidencia Expandible de Falencias**
   - En tabla consolidada: cada criterio con hallazgos ("No") tiene un `<details>` expandible
   - Muestra: **finca**, **fecha**, **responsable**, **observación registrada**, **recomendación**
   - Datos consumidos de `ConsolidatedMetricAnalysis.matrix` (ya disponible)
   - Estilos: `.b2b-finding-evidence`, `.b2b-evidence-list` en `app/b2b-metrics.css`

### 4. **Indicadores de Estado de Meta**
   - Badges `.b2b-target-status` con dos estados:
     - `.met`: fondo verde claro `#eff8e6`, texto `#456c11`
     - `.below`: fondo ámbar claro `#fff6df`, texto `#8a5a00`
   - Responsivo y compatible con modo oscuro

### 5. **Descripción de Hallazgos Mejorada**
   - Cambio de "Recurrente en X informes consecutivos" → "Registrado en X informes del periodo"
   - Muestra observación registrada: `data.latest?.visit.answers[problem.id]?.observation`
   - Muestra recomendación: `problem.recommendation`

---

## Cambios Técnicos Clave

| Archivo | Cambios | Razón |
|---------|---------|-------|
| `app/metric-display.ts` | ✨ NUEVO | Constante visual `АВГУСТ_COMPLIANCE_TARGET` (separada de lógica MIPE) |
| `app/metrics-panel.tsx` | + meta en KPI, línea 95%, refs en leyenda | Dashboard por finca |
| `app/consolidated-metrics.tsx` | + meta en KPI, línea 95%, evidencia expandible, badges | Dashboard consolidado |
| `app/metric-chapter-details.tsx` | + meta en tarjeta, línea 95%, línea 5% "No" | Detalles por capítulo |
| `app/b2b-metrics.css` | + 166 líneas estilos | Colores АВГУСТ, badges, evidencia, modo oscuro |
| `lib/model.ts` | ⛔ NO tocado | Las fórmulas MIPE quedan intactas |
| `lib/metric-analysis.ts` | ⛔ NO tocado | El análisis matemático sin cambios |

---

## Cómo Proseguir en Google AI Studio

### Tarea 1: Validación Multiplataforma
**Objetivo:** Asegurar que la UI funciona en desktop, tablet y móvil, y en modo claro/oscuro.

**Pasos:**
1. Revisar `app/b2b-metrics.css` para media queries (max-width: 768px, 480px)
2. Verificar que los colores АВГУСТ contrastan según WCAG AA (razón 4.5:1 para texto)
3. Probar `.b2b-evidence-list` en viewport móvil: ancho máximo 70vw
4. Comprobar que modo oscuro (`html.dark .b2b-*`) invierte colores correctamente

### Tarea 2: Mejoras de Accesibilidad
**Objetivo:** Hacer navegable con teclado y lector de pantalla.

**Puntos:**
- Los `<details>` expandibles son nativamente accesibles (`<summary>` + `<ul>`)
- Verificar que los colores en badges no dependen solo de color (incluir símbolo ✓/✗ o icono)
- Etiquetas ARIA en ReferenceLine (Recharts), o tooltip accesible
- Orden de tabulación en tabla consolidada

### Tarea 3: Perfeccionamiento de Detalles
**Objetivo:** Pulir la experiencia final.

**Sugerencias:**
1. Añadir animación al expandir/cerrar evidencia (`transition: max-height 0.2s`)
2. Mostrar total de hallazgos en encabezado consolidado (ej: "12 criterios con "No" en últimas visitas")
3. Botón "Exportar evidencia a CSV" con columnas: finca, fecha, criterio, observación, recomendación
4. Gráfico de tendencia de meta 95%: línea adicional que muestre si la finca ha estado arriba/abajo del 95% en últimas 6 visitas

### Tarea 4: Documentación y Entrenamiento
**Objetivo:** Hacer clara la meta visual para usuarios finales.

**Incluir:**
1. Tooltip al pasar sobre "Meta АВГУСТ 95%": explicar qué significa
2. Pequeño ícono (info `ℹ`) junto a "Meta АВГУСТ" en KPI
3. Guía de lectura en encabezado del dashboard: "Los números verdes indican conformidad ≥95%; los naranjas muestran deficiencias."
4. En exportación Word, incluir página de introducción que explique la meta y los umbrales MIPE (80% saludable, 50% crítico)

---

## Estructura de Datos: `ConsolidatedMetricAnalysis`

```typescript
type ConsolidatedMetricAnalysis = {
  records: MetricRecord[]; // visitas revisadas
  farms: number; // total fincas
  applicable: number; // criterios evaluados
  findings: number; // respuestas "No" totales
  score: number | null; // % conformidad general
  status: MetricStatus; // 'healthy' | 'acceptable' | 'critical' | 'pending'
  timeline: []; // evolución temporal
  trend: 'improved' | 'declined' | 'stable' | 'pending'; // cambio
  chapters: []; // desglose por capítulo
  items: []; // criterios individuales con `findings`, `rate`, `applicable`
  matrix: [{
    farm: string;
    date: string;
    responsible: string;
    chapter: string; // "2. Título"
    item: string; // "2.1"
    text: string; // descripción del criterio
    answer: 'Sí' | 'No' | 'No aplica';
    observation: string; // observación registrada en la visita
    recommendation: string; // recomendación técnica
  }][];
};
```

---

## Preguntas Frecuentes

**¿Por qué 95% y no 100%?**
- Es una meta comercial АВГУСТ. No cambia los umbrales MIPE (80% saludable, 50% crítico) ni las fórmulas de puntuación. Es solo visual.

**¿Qué pasa si una finca nunca ha sido evaluada?**
- `score === null`. Los badges y referencias muestran "Sin medición", no comparación contra 95%.

**¿Se exporta la meta 95% a Word/PDF?**
- Sí, en pie de página o encabezado de reporte. Incluir: "Meta АВГУСТ de conformidad: 95%".

**¿Puedo cambiar el 95% a otro valor?**
- Sí, edita `app/metric-display.ts` en un lugar, se propaga a toda la UI.

---

## Checklist Final Antes de Merge

- [ ] Compilación sin errores TypeScript
- [ ] Lint limpio (oxlint) en archivos modificados
- [ ] Tests unitarios pasan (sin cambios en lógica MIPE)
- [ ] Responsive: probado en 1920×1080, 768×1024, 375×667
- [ ] Modo oscuro: verifica `html.dark` en CSS
- [ ] Contrastes accesibles: herramientas como WebAIM Contrast Checker
- [ ] Datos reales: prueba con backup `.care360` que incluya hallazgos
- [ ] Exportación Word actualizada (incluir meta 95% en portada)
- [ ] PR description clara: "Mejoras visuales АВГУСТ: meta 95%, colores B2B, evidencia expandible"

---

## Comando para Continuar Localmente

```bash
git fetch origin
git checkout feat/avgust-metrics-95
git pull origin main  # sincronizar si main avanzó
npm install
npm run build
npm run test:unit
npm run dev # abrir http://localhost:3000 en navegador
```

---

**Contacto/Notas Adicionales:**
- Branch actual: `feat/avgust-metrics-95`
- Cambios visuales: ~300 líneas CSS + UI React (sin tocar análisis)
- Datos y persistencia: intactos
- Compatibilidad: React 19, TypeScript 5.9, Node 22+
