# PROMPT_GOOGLE_AI_STUDIO.md — АВГУСТ CARE 360

Guía técnica integral, bitácora de arquitectura y documento de referencia para ingeniería y desarrollo continuo de **АВГУСТ CARE 360** en Google AI Studio y entornos locales.

---

## 1. Contexto

### ¿Qué es АВГУСТ CARE 360?
**АВГУСТ CARE 360** es la plataforma corporativa de aseguramiento técnico, auditoría agronómica y gestión de buenas prácticas fitosanitarias desarrollada para **АВГУСТ Crop Protection**. Su propósito principal es acompañar a fincas y productores agrícolas en la evaluación rigurosa del Manejo Integrado de Plagas y Enfermedades (**MIPE**), calibración de equipos de aplicación, gestión de compromisos de mejora, trazabilidad fotográfica con evidencia antes/después, y generación de informes ejecutivos oficiales (Word, Excel, PDF y respaldos seguros `.care360`).

### Stack Tecnológico
- **Frontend Core**: React 19 / TypeScript, arquitectura modular basada en componentes y hooks funcionales.
- **Estilos y Sistema de Diseño**: Tailwind CSS v4, CSS Modules / hojas de estilo B2B corporativas (`b2b-metrics.css`, `globals.css`, `mobile.css`).
- **Visualización y Gráficas**: Recharts (curvas longitudinales, micro-sparklines con gradientes y micro-tooltips interactivos, histogramas de procesos).
- **Almacenamiento Local y Resiliencia**: SQLite en WebAssembly (`sql.js`), IndexedDB mediante `DeviceStore` y archivos de respaldo empaquetados `.care360` (formato binario SQLite 3 con imágenes BLOB embebidas).
- **Capacidades Offline / PWA**: Service Worker (`sw.js`) y Web App Manifest para continuidad operativa en campo sin conectividad de red.
- **Exportación Documental**: `docx` para informes de auditoría y hojas ejecutivas en Microsoft Word, generadores CSV/Excel con matrices de evaluación MIPE.
- **Calidad y Verificación**: Node.js Test Runner nativo (`node --test`), compilador TypeScript y `oxlint`.

---

## 2. Mejoras Implementadas

### Meta Visual 95% (Excelencia B2B y Jerarquía Visual)
- **Scorecards Ejecutivos**: Rediseño integral de las tarjetas de métricas pasando de vistas planas a un lenguaje B2B corporativo con elevaciones sutiles (`box-shadow: 0 1px 3px rgba(15,23,42,0.05)` y hover `0 8px 16px rgba(15,23,42,0.08)`), bordes definidos y acentos visuales por estado.
- **Paleta de Identidad АВГУСТ**:
  - Azul Corporativo Primario: `#007fa3` (identidad de marca y curvas de Índice MIPE).
  - Verde Agronómico: `#78be20` / `#10b981` (conformidad, umbral saludable y estados conformes).
  - Azul Cielo: `#0284c7` (tasa de cumplimiento de criterios).
  - Ámbar Alerta: `#f59e0b` (requiere atención / advertencias técnicas).
  - Carmesí / Rubí: `#e11d48` / `#ef4444` (hallazgos abiertos y desviaciones críticas).
  - Índigo Normativo: `#6366f1` (cobertura ponderada de procesos).
  - Neutros Slate: `#0f172a`, `#334155`, `#64748b`, `#f8fafc`.
- **Micro-Sparklines Recharts en Vivo**: Cada tarjeta de KPI cuenta con su gráfico de tendencia histórico interactivo (`KpiSparkline`), mostrando la trayectoria real con tooltip flotante de fecha y valor exacto.
- **Evidencia Expandible y Pares Fotográficos**: Comparación antes/después con fotografía inicial del hallazgo y evidencia de cierre verificada, además de desglose interactivo por capítulos (Almacén 5%, Dosificación 30%, Transporte 5%, Mezclas 30% y Aplicación 30%).
- **Micro-Insignias Semánticas**: Etiquetas de estado (`healthy`, `acceptable`, `critical`, `pending`) con bordes contrastantes y texto en mayúsculas tabulares.

---

## 3. Cambios Técnicos

| Archivo | Tipo de Cambio | Justificación Técnica y Funcional |
| :--- | :--- | :--- |
| `app/kpi-sparkline.tsx` | **Nuevo Componente** | Componente reutilizable de Recharts (`AreaChart`, `ResponsiveContainer`, `Tooltip`) para renderizar curvas de evolución en cada KPI con soporte de líneas base únicas. |
| `app/metrics-panel.tsx` | **Modificación** | Integración de micro-gráficas Recharts en las 5 tarjetas de KPI por finca, interactividad click-to-focus para filtrar la curva principal y filtros rápidos de tiempo. |
| `app/consolidated-metrics.tsx` | **Modificación** | Incorporación de micro-gráficas de tendencia mensual en el consolidado corporativo multi-finca y mapeo estricto del timeline. |
| `app/farm-query.tsx` | **Modificación** | Integración de sparklines de puntaje MIPE y recuento de hallazgos en la ficha centralizada de finca. |
| `app/b2b-metrics.css` | **Modificación / Estilos** | Definición de sombras sutiles, micro-gradientes, tipografía con números tabulares (`tabular-nums`) y compatibilidad completa con modo oscuro (`html.dark`). |
| `lib/model.ts` | **Ajuste de Paridad** | Restauración del estándar oficial APK 1.5.32 para `blankVisit().chapters` con `[2, 3, 4, 5]` manteniendo 100% de compatibilidad. |
| `lib/account-backup-file.ts` | **Respaldo y Normalización** | Soporte tanto para `receive_reports` como `receiveReports` al exportar contactos de fincas hacia SQLite `.care360`. |
| `tests/unit/care360-backup-restore.test.mjs` | **Nueva Suite de Prueba** | Prueba unitaria de ida y vuelta para respaldos SQLite `.care360`, asegurando persistencia de entidades y blobs fotográficos. |

---

## 4. Tareas para Proseguir

### 1. Validación Multiplataforma
- [ ] **Diseño Responsivo**: Comprobar el comportamiento de las grillas de KPIs en pantallas extra pequeñas (< 480px, apilado en 1 columna), tablets (768px - 1024px, grilla 2x2) y monitores ultrawide (> 1440px).
- [ ] **Modo Oscuro (`html.dark`)**: Verificar contraste de colores en todas las tarjetas de métricas, bordes, leyendas de Recharts y tooltips en fondos oscuros `#0f172a`.
- [ ] **Impresión y Exportación PDF**: Asegurar que las reglas `@media print` oculten elementos interactivos (`.no-print`) y mantengan la cabecera corporativa de alta resolución.

### 2. Accesibilidad (a11y)
- [ ] **Navegación por Teclado**: Soporte para activación mediante `Enter` y `Espacio` en todas las tarjetas interactivas de KPIs (`role="button"`, `tabIndex={0}`).
- [ ] **Lectores de Pantalla**: Inclusión de atributos `aria-label` descriptivos en cada gráfica y sparkline indicando el valor actual y la tendencia.
- [ ] **Contraste de Color WCAG AA**: Mantener ratios de contraste mínimos de 4.5:1 en textos principales y badges sobre fondos claros y oscuros.

### 3. Perfeccionamientos Técnicos
- [ ] **Transiciones y Micro-Animaciones**: Añadir animaciones fluidas con CSS transitions al expandir capítulos de informe o cambiar periodos.
- [ ] **Exportación CSV / Excel**: Validar que las matrices consolidadas incluyan columnas de ponderación y capítulos evaluados.
- [ ] **Comparación Temporal Avanzada**: Permitir la selección arbitraria de dos visitas cualesquiera para cálculo instantáneo de delta por criterio.

### 4. Documentación para Usuarios Finales
- [ ] Elaborar guía visual del modelo de evaluación MIPE ponderado (5% Almacén, 30% Dosificación, 5% Transporte, 30% Mezclas, 30% Aplicación).
- [ ] Instrucciones de creación y restauración de archivos de respaldo `.care360`.

---

## 5. Estructura de Datos

A continuación se detalla el esquema TypeScript completo del motor de análisis métrico consolidado (`ConsolidatedMetricAnalysis`) ubicado en `lib/metric-analysis.ts`:

```typescript
import { type MetricStatus, type Visit, metricTrend } from './model';

export type MetricRecord = {
  visit: Visit;
  score: number;
  status: MetricStatus;
  applicable: number;
  positive: number;
  findings: number;
  date: string;
  responsible: string;
  weightedScore: number | null;
  pointsEarned: number;
  criteriaCompliance: number | null;
  weightedCoveragePct: number;
  evaluatedChapters: number;
};

export type ChapterMetricItem = {
  id: string;
  text: string;
  firstAnswer: string | null;
  latestAnswer: string | null;
  firstScore: number | null;
  latestScore: number | null;
};

export type ChapterMetricDetail = {
  id: number;
  title: string;
  weight: number;
  weightPct: number;
  maxPoints: number;
  pointsEarned: number;
  firstPointsEarned: number;
  score: number | null;
  firstScore: number | null;
  findings: number;
  applicable: number;
  status: MetricStatus;
  items: ChapterMetricItem[];
};

export type ConsolidatedMetricAnalysis = {
  records: MetricRecord[];
  farms: number;
  applicable: number;
  findings: number;
  score: number | null;
  status: MetricStatus;
  timeline: {
    period: string; // Formato YYYY-MM
    score: number;
    findings: number;
    reports: number;
    status: MetricStatus;
  }[];
  trend: ReturnType<typeof metricTrend>;
  chapters: {
    id: number;
    title: string;
    applicable: number;
    findings: number;
    score: number | null;
    status: MetricStatus;
    farms: number;
  }[];
  items: {
    id: string;
    chapter: number;
    chapterTitle: string;
    text: string;
    applicable: number;
    findings: number;
    rate: number;
    farms: number;
  }[];
  matrix: {
    farm: string;
    date: string;
    responsible: string;
    chapter: string;
    item: string;
    text: string;
    answer: string;
    observation: string;
    recommendation: string;
  }[];
};
```

---

## 6. Preguntas Frecuentes (FAQ)

### ¿Por qué se define una meta visual de excelencia del 95%?
En auditorías agronómicas corporativas tipo B2B, los informes técnicos son presentados a gerencias de operaciones y directores de cultivo. Una presentación visual de alto nivel (sombras pulidas, tipografía con alineación numérica tabular, tarjetas de KPIs y curvas de evolución en tiempo real) reduce la fatiga visual, comunica autoridad técnica y permite detectar desviaciones críticas de forma inmediata.

### ¿Cómo se tratan los valores `null` en criterios No Aplica (NA) y capítulos no evaluados?
Siguiendo las reglas matemáticas oficiales de MIPE:
1. Las respuestas marcadas como **NA** se excluyen del denominador de criterios aplicables. **Jamás inflan la puntuación al 100% ni penalizan al productor como un 0%**.
2. Un capítulo **no evaluado** aporta exactamente 0 puntos y se excluye del porcentaje de cumplimiento relativo.
3. Si una auditoría no tiene criterios aplicables, el puntaje resultante es estrictamente `null` (mostrado como `—` en la interfaz y clasificado como `pending`), evitando divisiones por cero (`NaN` o `Infinity`).

### ¿Cómo operan las exportaciones a Word y Excel?
- **Word (`.docx`)**: Se genera un documento formal estructurado con portada institucional, resumen ejecutivo, tabla de hallazgos con compromisos de acción correctiva y desglose capítulo por capítulo.
- **Excel / CSV**: Genera una matriz desnormalizada donde cada fila representa la respuesta a un criterio individual, permitiendo análisis en herramientas de Business Intelligence (Power BI, Google Sheets).

### ¿Qué contiene el formato de respaldo `.care360`?
El archivo `.care360` es una base de datos **SQLite versión 3** empaquetada. Contiene tablas relacionales para `farms`, `farm_contacts`, `visits`, `requests` y `reports`, además de almacenar las fotografías en formato binario BLOB. Puede exportarse e importarse localmente sin requerir acceso a internet.

---

## 7. Checklist Previo a Merge

Antes de integrar cambios a la rama principal (`main`), verificar el cumplimiento de los siguientes puntos:

- [x] **Compilación Limpia**: `compile_applet` o `npm run build` finaliza sin errores de TypeScript ni bundler.
- [x] **Linting Estricto**: `oxlint` ejecutado con **0 errores y 0 advertencias**.
- [x] **Pruebas Automatizadas (27/27)**:
  - `care360-backup-restore.test.mjs` (PASSED)
  - `metrics-math.mjs` (PASSED - Casos 1 al 12 e invariantes A a H)
  - `fase6.1-parity-audit.mjs` (PASSED)
  - `metric-detail.test.mjs`, `model.mjs`, `device-store.mjs` (PASSED)
- [x] **Invariantes Matemáticas MIPE**: Puntos oficiales estrictamente acotados entre 0 y 100; suma de ponderación de capítulos = 100%.
- [x] **Conservación de Datos**: La importación y restauración de datos combina registros sin sobrescribir ni eliminar visitas previas.

---

## 8. Comando de Continuación (Ejecución Local)

Para clonar, instalar y ejecutar el proyecto en una máquina local o servidor:

```bash
# 1. Clonar el repositorio
git clone https://github.com/ko1717/Avgust-APK-.git
cd Avgust-APK-

# 2. Cambiar a la rama de trabajo
git checkout fix/functional-parity-audit-1.5.32

# 3. Instalar dependencias
npm install

# 4. Ejecutar la suite completa de pruebas automatizadas
node --test tests/unit/*.test.mjs tests/metrics-math.mjs tests/fase4-trend-benchmark.mjs tests/fase5-risks-actions.mjs tests/fase5.6-command-center.mjs tests/fase6.1-parity-audit.mjs && node tests/model.mjs && node tests/device-store.mjs

# 5. Ejecutar validación de código con linter
npm run lint

# 6. Compilar el proyecto para producción
npm run build

# 7. Iniciar el servidor de desarrollo local en puerto 3000
npm run dev
```
