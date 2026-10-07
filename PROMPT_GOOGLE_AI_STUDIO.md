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
   - Constante visual en `app/metric-display.ts`: `AVGUST_COMPLIANCE_TARGET = 95`
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

### 6. **Accesibilidad y lectura visual**
   - Ayuda con foco de teclado explica que el 95% es una referencia y no altera MIPE.
   - Descripciones ARIA para gráficos, criterios expandibles y tarjetas de filtro.
   - Lista de las últimas seis visitas con texto e icono para indicar meta alcanzada o pendiente.
   - La tabla separa con claridad frecuencia de “No” y porcentaje de conformidad.
   - El total de criterios con hallazgos se anuncia al actualizar el periodo.
   - Foco visible, animación de expansión con soporte `prefers-reduced-motion`, tema oscuro y ajustes para móvil.

---

## Cambios Técnicos Clave

| Archivo | Cambios | Razón |
|---------|---------|-------|
| `app/metric-display.ts` | ✨ NUEVO | Constante visual `АВГУСТ_COMPLIANCE_TARGET` (separada de lógica MIPE) |
| `app/metrics-panel.tsx` | + meta en KPI, línea 95%, tendencia última 6 visitas, etiquetas accesibles | Dashboard por finca |
| `app/consolidated-metrics.tsx` | + meta en KPI, línea 95%, evidencia expandible, conteo y accesibilidad | Dashboard consolidado |
| `app/metric-chapter-details.tsx` | + meta en tarjeta, línea 95%, línea 5% "No", ARIA | Detalles por capítulo |
| `app/b2b-metrics.css` | Estilos visuales adicionales | Colores AVGUST, estados, ayudas, evidencia, móvil y modo oscuro |
| `lib/model.ts` | ⛔ NO tocado | Las fórmulas MIPE quedan intactas |
| `lib/metric-analysis.ts` | ⛔ NO tocado | El análisis matemático sin cambios |

---

## Estado de las mejoras de interfaz

Se completó el alcance visual y de accesibilidad en la rama `feat/avgust-metrics-95`:

- Se añadieron ayudas accesibles con teclado para explicar que la meta es visual y no altera la fórmula o clasificación MIPE.
- Los gráficos tienen descripciones accesibles; las líneas de referencia siguen identificando la meta AVGUST y los umbrales MIPE.
- La tarjeta de finca resume visualmente el índice de sus últimas seis visitas, con texto además de color para indicar si alcanzó la meta.
- El consolidado informa cuántos criterios tienen hallazgos; la tabla distingue la frecuencia de respuestas “No” de la conformidad y su meta.
- Los detalles expandibles incluyen nombres accesibles, foco visible y una animación que respeta `prefers-reduced-motion`.
- El diseño incluye soporte para modo oscuro y tamaños estrechos.
- No se cambió el cálculo MIPE, la clasificación oficial, la persistencia ni el contenido de las exportaciones Word/PDF.

### Validación ejecutada y pendiente

- Build de producción: aprobado.
- TypeScript (`tsc --noEmit`): aprobado.
- Oxlint de los tres componentes modificados: aprobado.
- Tests unitarios: 22/22 aprobados.
- Contraste WCAG AA calculado para texto de estado: 5.65:1 (verde claro), 5.50:1 (ámbar claro), 8.77:1 (verde oscuro) y 8.65:1 (ámbar oscuro).
- `git diff --check`: aprobado.
- Se abrió el programa en escritorio y móvil, pero en ese entorno no hay datos de visitas para revisar los nuevos gráficos de métricas. Falta una revisión visual del dashboard de métricas con datos en los distintos tamaños y temas, y probar con lector de pantalla.

### Fuera de este alcance

La exportación específica de evidencia a CSV y la inclusión de la meta AVGUST en documentos Word/PDF no se implementaron. Requieren cambios funcionales en exportaciones y fueron excluidas del alcance visual solicitado.

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
- No se muestra una tendencia vacía; el panel de finca requiere una visita revisada para presentar los KPI.
- En el consolidado, los criterios sin respuestas aplicables muestran “Sin medición”.

**¿Se exporta la meta 95% a Word/PDF?**
- No. La meta está disponible solamente en la interfaz; las exportaciones no se modificaron.

**¿Puedo cambiar el 95% a otro valor?**
- Sí, edita `app/metric-display.ts` en un lugar, se propaga a toda la UI.

---

## Checklist antes de integrar

- [x] Fórmulas MIPE, clasificación, persistencia y exportaciones sin cambios en esta fase
- [x] Soporte CSS para móvil y tema oscuro
- [x] Lectura de estado no dependiente solo del color y controles con foco visible
- [x] Respeto a la preferencia de movimiento reducido
- [x] Build, comprobación TypeScript, lint y tests unitarios
- [ ] Revisar visualmente en escritorio, tablet y móvil, con tema claro y oscuro
- [x] Calcular contraste WCAG AA para los estados de meta añadidos
- [ ] Probar navegación con lector de pantalla y revisar métricas con datos de visitas reales

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
