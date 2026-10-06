# FASE 7.1 — AVGUST CARE 360 ENTERPRISE DESIGN SYSTEM

**Plataforma Empresarial de Inteligencia Agronómica y Aseguramiento MIPE**  
**Fecha:** Octubre 2026  
**Versión:** 1.5.32 (Build 2.0.1)  
**Estado:** DESIGN SYSTEM APPROVED & IMPLEMENTED  

---

## 1. FUNDAMENTOS Y PROPUESTA VISUAL DE PRODUCTO

**AVGUST CARE 360** evoluciona de una interfaz convencional de formularios hacia una **plataforma empresarial de inteligencia agronómica y control operativo de campo**, transmitiendo:

* **Rigor y Precisión:** Cifras en `tabular-nums`, deltas claros y trazabilidad documental.
* **Jerarquía Operativa:** Distinción inequívoca entre el **Score Oficial MIPE**, los KPIs operativos de ejecución y la matriz de riesgos.
* **Claridad en Campo y Oficina:** Legibilidad garantizada en pantallas móviles bajo luz solar directa (`Sun Mode`), interfaces de escritorio ejecutivas y soporte integral para `Dark Mode`.
* **Zero-Pill Discipline:** Reemplazo de pastillas decorativas por tipografía estructurada, bordes sutiles y códigos de color con significado normativo.

---

## 2. TOKENS DE DISEÑO (CSS CUSTOM PROPERTIES)

### 2.1 Paleta de Color y Semántica Agronómica

| Token CSS | Valor Light Mode | Valor Dark Mode | Propósito / Semántica |
| :--- | :--- | :--- | :--- |
| `--c360-brand` | `#00b5e2` | `#00b5e2` | Identidad corporativa AVGUST (Cian) |
| `--c360-brand-strong` | `#0087a8` | `#38bdf8` | Acentos primarios y títulos de marca |
| `--c360-agro-green` | `#14532d` | `#86efac` | Verde agro institucional (Salud óptima) |
| `--c360-agro-lime` | `#7cb342` | `#a3e635` | Acento técnico MIPE |
| `--c360-bg-app` | `#f8fafc` | `#090d16` | Fondo del lienzo de la aplicación |
| `--c360-surface` | `#ffffff` | `#0f172a` | Superficie de tarjetas y lienzos |
| `--c360-surface-elevated`| `#ffffff` | `#1e293b` | Modales, menús y popovers |
| `--c360-surface-sunken`  | `#f1f5f9` | `#0b1120` | Fondos de métricas secundarias y tracks |
| `--c360-border-hairline` | `#e2e8f0` | `#1e293b` | Bordes sutiles de delimitación |
| `--c360-text-primary`    | `#0f172a` | `#f8fafc` | Títulos y cifras principales |
| `--c360-text-secondary`  | `#334155` | `#cbd5e1` | Textos de apoyo y nombres de criterios |
| `--c360-text-muted`      | `#64748b` | `#94a3b8` | Metadatos, fechas y etiquetas secundarias|

### 2.2 Estados Funcionales y Capa de Riesgos

* **Conforme / Certificación (`--c360-status-success`):** `#16a34a` (Fondo: `#f0fdf4`, Borde: `#bbf7d0`). Cumplimiento $\ge 90\%$ o criterio `SI`.
* **Atención / Desviación Moderada (`--c360-status-warning`):** `#d97706` (Fondo: `#fffbeb`, Borde: `#fde68a`). Cumplimiento $75\% - 89.9\%$ o severidad Media.
* **Crítico / Incumplimiento (`--c360-status-danger`):** `#dc2626` (Fondo: `#fef2f2`, Borde: `#fecaca`). Cumplimiento $< 75\%$, criterio `NO` o severidad Crítica/Alta.
* **Informativo / Protocolo (`--c360-status-info`):** `#0284c7` (Fondo: `#f0f9ff`, Borde: `#bae6fd`). Cobertura y diagnóstico.
* **Sin Evaluar / Neutro (`--c360-status-neutral`):** `#64748b` (Fondo: `#f8fafc`, Borde: `#e2e8f0`). Criterios `NA` o capítulos no inspeccionados.

---

## 3. SISTEMA TIPOGRÁFICO Y JERARQUÍA

* **Tipografía Primaria:** `Manrope`, system-ui, -apple-system, sans-serif.

| Nivel Tipográfico | Tamaño | Peso | Interletrado | Uso en Producto |
| :--- | :--- | :--- | :--- | :--- |
| **Score Hero** | `42px` | 800 | `-0.02em` | Score Oficial MIPE protagonista (e.g. `84.6 pts`) |
| **Display / H1** | `24px` | 800 | `-0.02em` | Título del Command Center y encabezado de finca |
| **Heading / H2** | `18px` | 700 | `-0.01em` | Secciones del lienzo (Brechas, Intervención, Riesgos) |
| **Subheading / H3**| `15px` | 700 | `0.00em` | Títulos de tarjetas de capítulos y causas raíz |
| **Body Primary** | `13.5px` | 500 / 600 | `0.00em` | Textos de diagnóstico y observaciones técnicas |
| **Caption / Eyebrow**| `10.5px`| 800 | `+0.06em` | Kickers en mayúsculas (`DISTRIBUCIÓN PONDERADA`) |
| **Numeric KPI** | Varía | 700 / 800 | `tabular-nums` | Todas las cifras, porcentajes y deltas |

---

## 4. SISTEMA DE ESPACIADO Y GRILLA (4px Base Grid)

* `--c360-sp-1`: `4px` (Microespacio entre icono y texto)
* `--c360-sp-2`: `8px` (Espacio compacto entre elementos relacionados)
* `--c360-sp-3`: `12px` (Padding interno de celdas y badges)
* `--c360-sp-4`: `16px` (Padding estándar de tarjetas secundarias)
* `--c360-sp-5`: `20px` (Separación de bloques en columnas)
* `--c360-sp-6`: `24px` (Padding principal del Lienzo Maestro)
* `--c360-sp-8`: `32px` (Separación de macrosecciones)
* `--c360-sp-12`: `48px` (Contenedores vacíos y héroes)

---

## 5. COMPONENTES BASE NORMALIZADOS

### 5.1 Botones e Interactividad
* **Primario:** `c360-btn-primary` (Acento verde agro o cian corporativo, microtransición de 120ms).
* **Secundario / Outline:** `c360-btn-outline` (Fondo transparente, borde de 1px, hover con elevación 1).
* **Acceso Directo / Drill-down:** `c360-btn-qi-evidence` (Acceso instantáneo a fotos y trazabilidad documental).

### 5.2 Tarjetas y Contenedores
* **Command Canvas:** Superficie unificada de 2 columnas (Izquierda: Salud MIPE & Diagnóstico; Derecha: Trayectoria temporal SVG).
* **Chapter Gap Cards:** Tarjetas interactivas con indicador de pérdida de puntos (*Primary Gap*) y barra de aporte porcentual.
* **Intervention List Item:** Fila estructurada de 4 columnas (Prioridad &rarr; Problema/Contexto &rarr; Acción/Responsable &rarr; Evidencia).

### 5.3 Estados del Sistema
* **Estado de Sincronización:** Insignia discreta con estado de red (`Online`, `Offline`, `Syncing`).
* **Estados Vacíos:** Mensajes descriptivos y claros (*"No hay información suficiente para establecer una prioridad"*).
* **Modo Exteriores (`Sun Mode`):** Alto contraste, fondos blancos puros y bordes reforzados para trabajo de campo en invernaderos.

---

## 6. ESTRATEGIA RESPONSIVE MULTIDISPOSITIVO

1. **Desktop Windows ($\ge 1024\text{px}$):**
   * Lienzo Maestro en 2 columnas balanceadas ($1.15\text{fr} : 0.85\text{fr}$).
   * Barra de brechas con las 5 tarjetas de capítulos en cuadrícula horizontal fluida.
   * Plan de intervención con tabla expandida de 4 columnas.
2. **Tablet ($768\text{px} - 1023\text{px}$):**
   * Lienzo Maestro en columna apilada con sparkline integrado.
   * Cuadrícula de capítulos $2 \times 2 + 1$.
3. **Móvil / Android ($\le 767\text{px}$):**
   * Pila vertical optimizada: Score Rector &rarr; Diagnóstico &rarr; Analizador de Brechas &rarr; Top 2 Desviaciones Críticas.
   * Botones táctiles con altura mínima de 44px (*touch target compliance*).
   * Desplazamiento suave sin *doomscrolling*.

---

## 7. MATRIZ DE VALIDACIÓN TÉCNICA

* **Suite de Pruebas Automatizadas:** 67/67 tests aprobados (`PASS 100%`).
* **Compilación de Producción (`node build.js`):** Exitosa (`dist/` empaquetado).
* **Linter de Código (`npm run lint`):** Exitoso sin advertencias.
* **Integridad Matemática:** Preservada al 100% sin modificaciones al núcleo.
