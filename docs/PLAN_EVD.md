# Executive Vision Deck (EVD) — Plan de Implementación

> **Estado**: Borrador aprobado — pendiente de implementación
> **Fecha**: 2026-07-11
> **Enfoque**: Visual-Nativo (Enfoque B)
> **Estimación total**: ~83 horas

---

## 1. Concepto

El EVD no es un PowerPoint generado por IA. Es un **artefacto de negocio visual-nativo** con calidad nivel agencia consulting (McKinsey/BCG/Bain). Output que no se distinga de lo que haría un graphic designer profesional.

### Capacidades

- Narrativa ejecutiva (storytelling con action titles)
- Identidad visual profesional (branding configurable)
- Gráficos automáticos (echarts SSR → SVG de alta calidad)
- Diagramas de flujo y procesos (mermaid → SVG con theme custom)
- Wireframes conceptuales (SVG programático, solo con `uiScreensContent`)
- Enfoque para directores, clientes e inversionistas
- Exportación a PPTX y PDF
- Editor de slides visual en el browser
- Almacenamiento permanente en filesystem montable

### Fuentes de datos (orden de prioridad)

| Fuente | Campo DB | Qué aporta al deck |
|---|---|---|
| Phase 0 / DBGA | `phase0SummaryContent` / `dbgaContent` | Contexto ejecutivo, gaps, complejidad, tech specs |
| BRD | `brdContent` | Problema de negocio, KPIs, alcance, riesgos, stakeholders |
| MDD | `mddContent` | Capacidades, entidades, arquitectura |
| UI Screens | `uiScreensContent` | Wireframes (solo si existe) |
| Spec | `specContent` | User journeys, criterios de éxito |
| Architecture | `architectureContent` | Diagramas de sistema |

**Guardrail**: Si no existe ni DBGA ni BRD ni MDD, el sistema rechaza generar y dice "fuentes insuficientes".

---

## 2. Stack de tecnologías

| Capa | Librería | Versión | Justificación |
|---|---|---|---|
| PPTX | `pptxgenjs` | 4.0.1 | 4.1M downloads/semana, MIT, cero deps, master slides, gradient fills, shapes |
| Charts SVG | `echarts` | latest | Zero native deps, SSR SVG, 30+ tipos de gráfico, temas custom |
| Mermaid SVG | `@mermaid-js/mermaid-cli` | 11.x | Production-ready, necesita Chromium |
| PDF | `puppeteer` | latest | HTML→PDF pixel-perfect, ya necesitamos Chromium para mermaid |
| Logo upload | `multer` | latest | Middleware multipart estándar NestJS |
| File I/O | `node:fs/promises` | built-in | Lectura/escritura de archivos |
| Fonts | Inter (Google Fonts) | — | Embedded en PDF vía @font-face |

### Por qué NO otras alternativas

| Descartada | Razón |
|---|---|
| officegen | Abandonado (2020) |
| chartjs-node-canvas | Requiere Cairo/Pango, frágil en Docker |
| @react-pdf/renderer | Sin CSS Grid, output menos controlado que puppeteer |
| PDFKit | Sin rendering HTML, todo manual |
| QuickChart.io API | Dependencia externa, datos salen del server |

---

## 3. Calidad profesional: Estándar de diseño

### 3.1 Filosofía: Consulting-Grade Visual Communication

| Principio | Aplicación en EVD |
|---|---|
| **Action titles** | Cada slide tiene un título que dice la conclusión, no el tema. "El mercado crece 18% anual" vs "Análisis de Mercado" |
| **Un mensaje por slide** | El LLM genera un slide = un insight. Si hay dos puntos, dos slides |
| **Pirámide invertida** | Título (conclusión) → Evidencia (chart/diagrama) → Fuente |
| **Max 2 fuentes tipográficas** | Inter (sans) para todo. Títulos bold, cuerpo regular |
| **3-4 colores máximo** | Brand primary + accent + neutrals. Color = significado, no decoración |
| **Grid consistente** | Margen izquierdo 0.5", títodos nunca se mueven entre slides |
| **Fuentes de datos** | Todo chart tiene línea de fuente abajo |
| **Espacio en blanco** | No llenar cada pulgada. Respirar |

### 3.2 Sistema de diseño visual (Design Tokens)

```typescript
const EVD_DESIGN_SYSTEM = {
  // Neutros (70% del deck)
  colors: {
    text:         '#1A1A2E',  // Charcoal, no negro puro
    textLight:    '#6B7280',  // Gray-500 para fuentes/secundario
    bg:           '#FFFFFF',  // Fondo principal
    bgSubtle:     '#F9FAFB',  // Gray-50 para secciones alternas
    border:       '#E5E7EB',  // Gray-200 para líneas
    gridLine:     '#F3F4F6',  // Gray-100 para gridlines de charts

    // Brand (25% del deck — derivados automáticamente del color del usuario)
    brandPrimary:   '{{userPrimary}}',
    brandSecondary: '{{userSecondary}}',
    brandAccent:    '{{userAccent}}',

    // Semánticos
    positive:  '#059669',  // Verde para positivo/crecimiento
    negative:  '#DC2626',  // Rojo para negativo/riesgo
    neutral:   '#6B7280',  // Gray para benchmark/histórico
    highlight: '{{accent}}',
  },

  // Tipografía
  typography: {
    family:       'Inter',
    titleSize:    24,    // Bold, action title
    subtitleSize: 14,    // Regular, soporte
    bodySize:     12,    // Regular, bullets/evidencia
    captionSize:  9,     // Light, fuentes/pie de página
    lineHeight:   1.3,
    titleWeight:  700,
    bodyWeight:   400,
  },

  // Espaciado (baseline grid 4px)
  spacing: {
    slideMargin: 0.5,   // inches (todos los lados)
    titleY:      0.3,   // inches desde arriba
    bodyY:       1.2,   // inches donde empieza el contenido
    footerY:     6.9,   // inches pie de página
    gapBetween:  0.15,  // inches entre elementos
  },

  // Grids de layout
  layouts: {
    fullChart:      { chart: '100% w', narrative: 'below' },
    twoColumn:      { left: '60%', right: '40%' },
    threeColumn:    { left: '33%', center: '33%', right: '33%' },
    titleOverChart: { title: 'top 20%', chart: 'bottom 80%' },
    kpiRow:         { kpis: '4 cards equal width' },
    coverFull:      { centered: true, gradient: true },
  },
};
```

### 3.3 Calidad por tipo de slide

#### Charts (echarts SSR → SVG)

```
Estándar mínimo:
├── Gradiente radial en área de chart (no color plano)
├── Sombras sutiles en puntos de datos (shadowBlur: 8-12)
├── Gridlines minimalistas (solo horizontal, color: #F3F4F6)
├── Sin borde de chart (sin axisLine donde no aporte)
├── Labels directos sobre datos (no legend cuando hay ≤4 series)
├── Tooltip con formato profesional (no el default)
├── Animación de entrada en preview (fade-in + slide-up)
└── Fuente de datos siempre visible
```

#### Diagramas (mermaid → SVG)

```
Estándar mínimo:
├── Custom theme que matchea la paleta del deck
├── Bordes redondeados (borderRadius en nodos)
├── Sombras sutiles en nodos
├── Colores de nodos = paleta brand (no colores default de mermaid)
├── Flechas con curvas suaves (curveType: basis)
├── Espaciado generoso entre nodos
└── Renderizado a SVG limpio (no PNG rasterizado)
```

#### Wireframes (SVG programático)

```
Estándar mínimo (estilo Balsamiq/Figma wireframe):
├── Background blanco con bordes grises (#D1D5DB)
├── Componentes con estilo lo-fi pero legible
│   ├── Navbar: rectangulo gris oscuro (#374151) con placeholder circles
│   ├── Sidebar: rectangulo gris claro (#E5E7EB) con líneas de texto
│   ├── Cards: rectangulo blanco con borde + shadow sutil
│   ├── Tables: header gris (#F3F4F6) + filas alternas
│   ├── Forms: input boxes con bordes redondeados
│   └── Buttons: rounded rect con fill sutil
├── Labels en fuente pequeña italic (#9CA3AF)
├── Líneas de guía punteadas para alineación
└── Nomenclatura de pantalla arriba (route/path)
```

#### PPTX (pptxgenjs)

```
Estándar mínimo:
├── Master slide definido con:
│   ├── Logo del usuario (si fue subido) — posición fija
│   ├── Línea horizontal de color brand (0.02" height)
│   ├── Footer: "Confidential | {fecha} | {page}"
│   ├── Page number en esquina inferior derecha
│   └── Background blanco o very light gray (#F9FAFB)
├── Action titles: 24pt bold, color text (#1A1A2E)
├── Body: 12pt regular, color text
├── Charts embebidos como SVG→Image de alta resolución
├── Shapes con gradient fills (no color plano)
├── Rounded rectangles para callout boxes
├── Transiciones entre slides: fade (sutil)
└── Export a 16:9 widescreen (13.33" x 7.5")
```

#### PDF (puppeteer → HTML template)

```
Estándar mínimo:
├── Paper size: A4 landscape para screen, A4 portrait para print
├── CSS print-optimized:
│   ├── @page { margin: 0; size: landscape; }
│   ├── orphans: 3; widows: 3;
│   └── hyphens: auto;
├── Full-bleed gradient backgrounds en cover y section dividers
├── Grid system CSS (12-column, 24px gutter)
├── Inter font via @font-face (embedded)
├── Charts como inline SVG (no images — escalables)
├── Sombras CSS en cards y callout boxes
├── Page numbers en footer
├── Cover page con gradient brand→dark + logo centered
└── Table of contents clickable (hyperlinks internos)
```

---

## 4. Estructura JSON del EVD

El LLM genera un JSON estructurado (no markdown). Schema de validación Zod.

```jsonc
{
  "meta": {
    "title": "string",
    "subtitle": "string",
    "version": "1.0",
    "createdAt": "ISO-date",
    "updatedAt": "ISO-date"
  },
  "branding": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "logoPath": "string | null",  // path relativo dentro de assets/
    "fontFamily": "Inter | Montserrat | system"
  },
  "slides": [
    // Slide Cover (siempre primero)
    {
      "id": "uuid",
      "type": "cover",
      "title": "string",          // action title
      "subtitle": "string",
      "author": "string",
      "date": "string",
      "narrative": "string"       // talking points para el presentador
    },

    // KPI overview
    {
      "id": "uuid",
      "type": "kpi",
      "title": "string",          // action title: "El proyecto impacta 5 métricas clave"
      "kpis": [
        {
          "label": "string",
          "value": "string",       // "18%", "$2.4M", "12,000"
          "trend": "up | down | flat",
          "delta": "string"        // "+3% vs last quarter"
        }
      ],
      "narrative": "string"
    },

    // Chart slide
    {
      "id": "uuid",
      "type": "chart",
      "title": "string",          // action title
      "chartType": "bar | line | pie | doughnut | radar | scatter | area",
      "chartData": {
        "labels": ["string"],
        "series": [
          { "name": "string", "data": [number] }
        ]
      },
      "chartConfig": {
        // overrides de estilo (gradient, shadow, etc.)
      },
      "source": "string",         // fuente de datos (obligatorio)
      "narrative": "string"
    },

    // Multi-chart (grid 2x2 o 1+2)
    {
      "id": "uuid",
      "type": "multi-chart",
      "title": "string",
      "layout": "2x2 | 1+2 | 2+1",
      "charts": [
        { "type": "string", "data": {}, "label": "string" }
      ],
      "narrative": "string"
    },

    // Diagram slide
    {
      "id": "uuid",
      "type": "diagram",
      "title": "string",
      "diagramType": "flowchart | sequence | gantt | erDiagram | stateDiagram",
      "diagramSource": "string",  // mermaid DSL
      "narrative": "string"
    },

    // Table slide
    {
      "id": "uuid",
      "type": "table",
      "title": "string",
      "columns": [
        { "header": "string", "align": "left | center | right" }
      ],
      "rows": [["string"]],
      "narrative": "string"
    },

    // Wireframe slide (solo si hay uiScreensContent)
    {
      "id": "uuid",
      "type": "wireframe",
      "title": "string",
      "screenName": "string",
      "route": "/string",
      "components": [
        {
          "type": "navbar | sidebar | card | table | form | modal | button | input",
          "label": "string",
          "x": "number", "y": "number",
          "w": "number", "h": "number"
        }
      ],
      "narrative": "string"
    },

    // Narrative/text slide
    {
      "id": "uuid",
      "type": "narrative",
      "title": "string",          // action title
      "bullets": ["string"],      // max 5 bullets, cada uno 1 línea
      "narrative": "string"
    },

    // Timeline slide
    {
      "id": "uuid",
      "type": "timeline",
      "title": "string",
      "events": [
        { "date": "string", "label": "string", "description": "string" }
      ],
      "narrative": "string"
    }
  ]
}
```

---

## 5. Arquitectura del sistema

### 5.1 Diagrama de flujo

```
MDD + Entregables existentes (DBGA, BRD, Spec, etc.)
        │
        ▼
┌─────────────────────────────┐
│  LLM genera JSON EVD        │  ← Prompt premium con ghost deck structure
│  (estructurado, no markdown)│
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  Validación Zod + Quality   │  ← Action titles, one-message, sources
│  checks post-generación     │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  Motor Visual               │
│  ├── echarts SSR → SVG      │  ← Charts con tema premium
│  ├── mermaid-cli → SVG      │  ← Diagramas con theme custom
│  └── SVG generator          │  ← Wireframes (si hay uiScreens)
└─────────┬───────────────────┘
          │
          ├──► PPTX (pptxgenjs + master slides + SVGs embebidos)
          ├──► PDF  (HTML template + puppeteer)
          └──► Preview HTML (editor visual en Workshop)
```

### 5.2 Almacenamiento

El volumen Docker `theforge_api_data` se monta en `/app/data` en el contenedor API.

```
/app/data/
  └─ {projectId}/
        ├─ evd.json            ← estructura editable (source of truth en DB)
        ├─ deck.pptx           ← export PPTX generado
        ├─ deck.pdf            ← export PDF generado
        └─ assets/
              ├─ logo.png      ← logo subido por el usuario
              └─ charts/       ← SVGs de charts cacheados
                    ├─ slide-1-chart.svg
                    └─ slide-2-diagram.svg
```

### 5.3 Estructura de slides tipo "Ghost Deck" (McKinsey)

El LLM genera siguiendo esta narrativa:

```
Slide 1:  COVER       — Title + subtitle + date + author
Slide 2:  KPIs        — 4-5 métricas clave del proyecto
Slide 3:  PROBLEM     — El problema que resuelve (narrative + datos)
Slide 4:  MARKET      — Tamaño de mercado / oportunidad (chart)
Slide 5:  SOLUTION    — Nuestra solución (narrative bullets)
Slide 6:  ARCHITECTURE — Cómo funciona (diagrama)
Slide 7:  USER FLOWS  — Flujos principales (diagrama o wireframes)
Slide 8:  WIREFRAMES  — Screens principales (si hay uiScreensContent)
Slide 9:  ROADMAP     — Timeline de implementación
Slide 10: RISKS       — Riesgos y mitigaciones
Slide 11: FINANCIALS  — Proyecciones / ROI (charts)
Slide 12: NEXT STEPS  — Próximos pasos concretos
Slide 13: APPENDIX    — Detalles técnicos (opcional)
```

- **Minimum viable deck**: 8 slides (cover + 5 contenido + roadmap + next steps)
- **Maximum**: 15 slides (evitar slide fatigue)

---

## 6. Plan de implementación detallado

### Fase 1: Infraestructura de almacenamiento (4h)

| # | Archivo | Acción |
|---|---|---|
| 1.1 | `docker-compose.yml` | Agregar named volume `theforge_api_data` + mount en API container en `/app/data` |
| 1.2 | `docker-compose.override.yml` | Mismo mount para dev local |
| 1.3 | `apps/api/src/modules/evd/evd-storage.service.ts` | **NUEVO**: `ensureProjectDir(projectId)`, `writeJSON(projectId, data)`, `readJSON(projectId)`, `writeBuffer(projectId, path, buffer)`, `getReadStream(projectId, path)`, `getFilePath(projectId, path)` |
| 1.4 | `apps/api/src/modules/evd/evd-storage.module.ts` | **NUEVO**: NestJS module con `EvStorageService` |

```typescript
// Ejemplo de interfaz del servicio de almacenamiento
@Injectable()
export class EvdStorageService {
  private readonly basePath = '/app/data';

  async ensureProjectDir(projectId: string): Promise<string> {
    const dir = join(this.basePath, projectId, 'assets', 'charts');
    await mkdir(dir, { recursive: true });
    return join(this.basePath, projectId);
  }

  async writeJSON(projectId: string, data: EvdStructure): Promise<void> { ... }
  async readJSON(projectId: string): Promise<EvdStructure | null> { ... }
  async writeBuffer(projectId: string, relativePath: string, buffer: Buffer): Promise<string> { ... }
  getReadStream(projectId: string, relativePath: string): ReadStream { ... }
  getFilePath(projectId: string, relativePath: string): string { ... }
}
```

### Fase 2: Tipo de entregable + DB (3h)

| # | Archivo | Acción |
|---|---|---|
| 2.1 | `packages/shared-types/src/deliverables-matrix.ts` | Añadir `"evd"` a `DeliverableKind` + `DELIVERABLE_STEP_LABELS` + `DELIVERABLE_PROJECT_CONTENT_FIELD` + `DELIVERABLES_BY_COMPLEXITY` + `DELIVERABLE_WAVES_BY_COMPLEXITY` |
| 2.2 | `packages/database/schema.prisma` | Añadir `evdContent String? @db.Text` a models `Project` y `Stage` |
| 2.3 | `packages/shared-types/src/stage-deliverable-snapshot.ts` | Añadir `evd` al array `DELIVERABLE_KEYS` y al schema |
| 2.4 | `packages/shared-types/src/project-generation-guard.ts` | Añadir mapping en `GENERATION_JOB_TYPE_LABELS` y `generationJobToDeliverableKind()` |
| 2.5 | Prisma migration | `npx prisma migrate dev --name add-evd-deliverable` |

**Wave position en cascada**: W3 o W4 (después de todos los entregables, porque el EVD lee de todos).

```typescript
// En DELIVERABLE_WAVES_BY_COMPLEXITY HIGH:
HIGH: [
  ["mdd_canonical"],
  ["spec", "architecture"],
  ["use_cases", "user_stories", "api_contracts", "logic_flows", "ux_ui_guide", "blueprint"],
  ["ui_screens_sync"],
  ["tasks", "infra", "agent_governance", "evd"],  // ← evd al final
],
```

### Fase 3: Design system (6h)

| # | Archivo | Acción |
|---|---|---|
| 3.1 | `apps/api/src/modules/evd/evd-design-system.ts` | **NUEVO**: Constantes de diseño (colores, tipografía, espaciado, layouts) |
| 3.2 | `apps/api/src/modules/evd/evd-color.utils.ts` | **NUEVO**: Derivación automática de paleta desde un brand color (HSL manipulation, complementary colors, tint/shade generation) |
| 3.3 | `apps/api/src/modules/evd/evd-chart-theme.ts` | **NUEVO**: Tema echarts premium (gradientes, sombras, gridlines, fonts, colors) |
| 3.4 | `apps/api/src/modules/evd/evd-mermaid-theme.ts` | **NUEVO**: Custom mermaid theme JSON (colores brand, border radius, shadows, curveType) |
| 3.5 | `apps/api/src/modules/evd/evd-typography.ts` | **NUEVO**: Constantes tipográficas para PPTX, PDF y preview |

### Fase 4: Generación LLM — contenido JSON (8h)

| # | Archivo | Acción |
|---|---|---|
| 4.1 | `apps/api/src/modules/ai/prompts/evd-prompt.md` | **NUEVO**: System prompt detallado para generar JSON EVD válido |
| 4.2 | `apps/api/src/modules/ai/prompts/evd-prompt.ts` | Loader del prompt |
| 4.3 | `apps/api/src/modules/ai/evd-schema.ts` | **NUEVO**: Zod schema del JSON EVD (validación completa) |
| 4.4 | `apps/api/src/modules/ai/ai.service.ts` | Nuevo método `generateEVDJSON(context, sources)` |
| 4.5 | `apps/api/src/modules/projects/projects.service.ts` | Nuevo método `generateEVD(projectId)` + caso en `generateDocument()` |

**El prompt del LLM debe incluir:**
- Ghost deck structure (la secuencia narrativa)
- Action title guidelines (cada título = conclusión)
- One-message-per-slide rule
- Chart selection logic (qué tipo de chart para qué tipo de dato)
- Wireframe generation rules (solo si hay uiScreensContent)
- JSON schema exacto como referencia
- Branding del usuario

**Post-procesamiento de calidad:**
- Validar JSON contra Zod schema
- Verificar action titles (que no sean topic titles)
- Verificar que cada slide tiene ≤1 mensaje
- Verificar que charts tienen `source`
- Coherencia narrativa entre slides

### Fase 5: Motor visual — Charts (8h)

| # | Archivo | Acción |
|---|---|---|
| 5.1 | `apps/api/src/modules/evd/evd-chart.service.ts` | **NUEVO**: `renderChartSVG(chartData, chartType, theme)` → Buffer SVG |

```typescript
// Ejemplo del servicio de charts
@Injectable()
export class EvdChartService {
  renderChartSVG(
    data: ChartData,
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter' | 'area',
    theme: EvdDesignTheme,
    options?: { width?: number; height?: number }
  ): string {
    const echarts = require('echarts');
    const chart = echarts.init(null, null, {
      renderer: 'svg',
      ssr: true,
      width: options?.width ?? 1100,
      height: options?.height ?? 500,
    });

    const echartsConfig = this.buildEchartsConfig(data, type, theme);
    chart.setOption(echartsConfig);
    const svgStr = chart.renderToSVGString();
    chart.dispose();
    return svgStr;
  }

  private buildEchartsConfig(data, type, theme): EChartsOption {
    // Configuración premium:
    // - Gradientes radiales en area charts
    // - Sombras en scatter points
    // - Gridlines minimalistas
    // - Labels directos
    // - Fuente de datos
    // - Color palette del theme
  }
}
```

### Fase 6: Motor visual — Diagramas (4h)

| # | Archivo | Acción |
|---|---|---|
| 6.1 | `apps/api/src/modules/evd/evd-diagram.service.ts` | **NUEVO**: `renderMermaidSVG(mermaidCode, theme)` → Buffer SVG |

```typescript
// Usa @mermaid-js/mermaid-cli para renderizar
// Con custom theme que matchea la paleta del deck
// Cache de SVGs por hash del mermaid code
```

### Fase 7: Motor visual — Wireframes (8h)

| # | Archivo | Acción |
|---|---|---|
| 7.1 | `apps/api/src/modules/evd/evd-wireframe.service.ts` | **NUEVO**: `renderWireframeSVG(spec, theme)` → Buffer SVG |

```typescript
// Genera SVG programático estilo Balsamiq/Figma wireframe
// Componentes: navbar, sidebar, card, table, form, modal, button, input
// Estilo lo-fi con bordes grises, sombras sutiles, labels italic
```

### Fase 8: Exportación PPTX (10h)

| # | Archivo | Acción |
|---|---|---|
| 8.1 | `apps/api/src/modules/evd/evd-pptx.service.ts` | **NUEVO**: `generatePPTX(evdJson, renderedAssets)` → Buffer |

```typescript
// Master slides definidos:
// - COVER_MASTER: gradient background, centered title, logo
// - CONTENT_MASTER: header line, title area, body area, footer
// - CHART_MASTER: title area, full-width chart, source line, footer
// - KPI_MASTER: title, 4-column KPI grid, footer
// - DIAGRAM_MASTER: title, full-width diagram, footer
// - TABLE_MASTER: title, full-width table, footer
// - CLOSING_MASTER: centered next steps, contact info

// Cada master tiene:
// - Logo position (si el usuario subió logo)
// - Brand color horizontal line (0.02" height)
// - Footer: "Confidential | {fecha} | {page}"
// - Background: white o #F9FAFB
// - Page number bottom-right
```

### Fase 9: Exportación PDF (8h)

| # | Archivo | Acción |
|---|---|---|
| 9.1 | `apps/api/src/modules/evd/evd-html.template.ts` | **NUEVO**: Template HTML/CSS premium para PDF |
| 9.2 | `apps/api/src/modules/evd/evd-pdf.service.ts` | **NUEVO**: `generatePDF(evdJson, renderedAssets)` → Buffer |

```typescript
// HTML template con:
// - CSS Grid 12 columnas
// - Inter font embedded (@font-face)
// - Full-bleed gradients en cover y section dividers
// - Charts como inline SVG (escalables)
// - Sombras CSS en cards
// - Print-optimized: @page, orphans, widows, hyphens
// - Page numbers en footer
// - Table of contents clickable
```

### Fase 10: Orquestador de exportación (4h)

| # | Archivo | Acción |
|---|---|---|
| 10.1 | `apps/api/src/modules/evd/evd-export.service.ts` | **NUEVO**: Orquesta render → export → persiste a filesystem |

```typescript
@Injectable()
export class EvdExportService {
  async exportPPTX(projectId: string): Promise<Buffer> {
    const json = await this.storage.readJSON(projectId);
    const rendered = await this.renderer.renderAll(json);
    const pptxBuffer = await this.pptx.generate(json, rendered);
    await this.storage.writeBuffer(projectId, 'deck.pptx', pptxBuffer);
    return pptxBuffer;
  }

  async exportPDF(projectId: string): Promise<Buffer> {
    // Similar flow
  }
}
```

### Fase 11: Endpoints API (4h)

| # | Archivo | Acción |
|---|---|---|
| 11.1 | `apps/api/src/modules/projects/projects.controller.ts` | Nuevos endpoints |

```typescript
// Generación (bajo demanda, NO en cascada)
@Post(':id/generate-evd')
async generateEVD(@Param('id') id: string) { ... }

// Exportación — streaming download
@Get(':id/export/evd-pptx')
async exportEvdPptx(@Param('id') id: id, @Res() res: Response) {
  const buffer = await this.evdExport.exportPPTX(id);
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'Content-Disposition': `attachment; filename="executive-vision-deck.pptx"`,
  });
  res.send(buffer);
}

@Get(':id/export/evd-pdf')
async exportEvdPdf(@Param('id') id: string, @Res() res: Response) { ... }

// Upload logo
@Post(':id/evd/logo')
@UseInterceptors(FileInterceptor('logo'))
async uploadEvdLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) { ... }

// Preview HTML (para el editor en browser)
@Get(':id/evd/preview')
async getEvdPreview(@Param('id') id: string) { ... }

// Status de exportación (polling)
@Get(':id/evd/status')
async getEvdStatus(@Param('id') id: string) { ... }
```

### Fase 12: Editor de slides — Frontend (16h)

| # | Archivo | Acción |
|---|---|---|
| 12.1 | `apps/web/src/components/evd/EvdSlideEditor.tsx` | **NUEVO**: Editor visual principal — layout tipo Figma/Canva |
| 12.2 | `apps/web/src/components/evd/EvdSlideCanvas.tsx` | **NUEVO**: Renderiza un slide individual (preview WYSIWYG) |
| 12.3 | `apps/web/src/components/evd/EvdSlideToolbar.tsx` | **NUEVO**: Toolbar (agregar slide, tipo, mover, eliminar, duplicar) |
| 12.4 | `apps/web/src/components/evd/EvdBrandingPanel.tsx` | **NUEVO**: Configuración de colores + logo upload + preview en tiempo real |
| 12.5 | `apps/web/src/components/evd/EvdSlideProperties.tsx` | **NUEVO**: Panel de propiedades del slide seleccionado (editar título, datos, narrativa) |
| 12.6 | `apps/web/src/components/evd/EvdExportBar.tsx` | **NUEVO**: Botones exportar PPTX/PDF + indicador de progreso + download |
| 12.7 | `apps/web/src/components/evd/EvdPreviewCarousel.tsx` | **NUEVO**: Carrusel de preview tipo presentación (fullscreen con flechas) |
| 12.8 | `apps/web/src/hooks/useEvdEditor.ts` | **NUEVO**: Hook de estado del editor (slides, branding, selection, undo/redo) |
| 12.9 | `apps/web/src/hooks/useEvdExport.ts` | **NUEVO**: Hook para polling de export + download del archivo |

**Funcionalidades del editor:**
- Selección de slide con highlight azul
- Drag & drop para reordenar slides
- Panel lateral derecho: propiedades del slide seleccionado
- Panel izquierdo: thumbnails de slides
- Toolbar superior: agregar slide (dropdown de tipos), eliminar, duplicar, mover
- Doble click en título/texto para inline editing
- Branding panel: color picker para primary/secondary/accent, upload de logo
- Vista previa fullscreen (carrusel tipo presentación)
- Undo/redo básico
- Botones de export en la barra de herramientas

### Fase 13: Integración Workshop (6h)

| # | Archivo | Acción |
|---|---|---|
| 13.1 | `apps/web/src/utils/complexityTabs.ts` | Añadir `"evd"` a `WorkshopDocTab` + visibilidad HIGH only |
| 13.2 | `apps/web/src/utils/workshopDocNav.ts` | Nav item con icono `Presentation` + label "Executive Deck" |
| 13.3 | `apps/web/src/store/workshopStore.ts` | States: `evdContent`, `evdDirty`, `setEvdContent`, `persistEvdContent`, `generateEVD` |
| 13.4 | `apps/web/src/views/WorkshopView.tsx` | Panel EVD en columna central (renderiza `EvdSlideEditor`) |
| 13.5 | `apps/web/src/utils/downloadDocumentsZip.ts` | Añadir `evd.json` al ZIP de documentos |

### Fase 14: Infraestructura Docker (2h)

| # | Archivo | Acción |
|---|---|---|
| 14.1 | `apps/api/package.json` | `pptxgenjs`, `echarts`, `@mermaid-js/mermaid-cli`, `multer` |
| 14.2 | `apps/api/Dockerfile` | Instalar Chromium headless para mermaid-cli + puppeteer. Agregar `apt-get install -y chromium` |
| 14.3 | `.dockerignore` | Excluir `/app/data` del build context |
| 14.4 | `docker-compose.yml` | Named volume `theforge_api_data` + service mount |

```yaml
# Adición al docker-compose.yml
services:
  theforge-api:
    volumes:
      - theforge_api_data:/app/data

volumes:
  theforge_api_data:
```

---

## 7. Estimación de esfuerzo

| Fase | Horas | Dependencias |
|---|---|---|
| 1: Almacenamiento + DB | 4h | — |
| 2: Tipos + Matrix | 3h | Fase 1 |
| 3: Design system | 6h | — |
| 4: Generación LLM | 8h | Fase 2, 3 |
| 5: Charts engine | 8h | Fase 3 |
| 6: Diagrams engine | 4h | Fase 3 |
| 7: Wireframes engine | 8h | Fase 3 |
| 8: PPTX export | 10h | Fase 5, 6, 7 |
| 9: PDF export | 8h | Fase 5, 6, 7 |
| 10: Orquestador export | 4h | Fase 8, 9 |
| 11: Endpoints API | 4h | Fase 1, 2, 4, 10 |
| 12: Editor slides FE | 16h | Fase 11 |
| 13: Workshop integration | 6h | Fase 12 |
| 14: Infra Docker | 2h | Fase 1 |
| **Total** | **~91h** | |

### Ruta crítica

```
Fase 1 → Fase 2 → Fase 4 → Fase 10 → Fase 11 → Fase 12 → Fase 13
                    ↘ Fase 3 → Fase 5,6,7 → Fase 8,9 ↗
```

---

## 8. Flujo de usuario final

```
1. Usuario abre tab "Executive Deck" en Workshop (solo proyectos HIGH complexity)
2. Ve pantalla vacía con botón "Generar Executive Deck"
3. Click → el backend:
   a. Verifica que exista al menos DBGA, BRD o MDD
   b. Si no existen: muestra error "Se requiere al menos Benchmark o BRD"
   c. Si existen: carga todas las fuentes y llama al LLM
4. LLM genera JSON EVD (~8-12 slides)
5. Se validan quality checks (action titles, one-message, sources)
6. Se renderizan charts/diagramas/wireframes como SVGs
7. Se guarda evd.json en disco + DB
8. El editor abre con el deck pre-generado
9. Usuario puede:
   - Editar título, narrativa, datos de cada slide (inline)
   - Agregar/eliminar/reordenar/duplicar slides
   - Cambiar branding (colores, logo, fuente) con preview en tiempo real
   - Vista previa tipo presentación (fullscreen, flechas)
   - Exportar PPTX o PDF
10. Click "Exportar PPTX" o "Exportar PDF":
    a. Backend renderiza todos los assets (charts, diagrams, wireframes)
    b. Genera el archivo (PPTX via pptxgenjs, PDF via puppeteer)
    c. Guarda en /app/data/{projectId}/
    d. Frontend descarga el archivo vía streaming endpoint
```

---

## 9. Decisiones abiertas

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| 1 | ¿EVD en cascada automática o bajo demanda? | A: Auto en W3 / B: Bajo demanda | **B: Bajo demanda** — el usuario decide cuándo generarlo |
| 2 | ¿Slides editables en el browser? | A: Solo preview / B: Editor visual completo | **B: Editor completo** — pero considerar complejidad |
| 3 | ¿Wireframes desde MDD o solo desde uiScreens? | A: Siempre / B: Solo con uiScreensContent | **B: Solo con uiScreensContent** — wireframes genéricos no aportan |
| 4 | ¿Dónde vive el PPTX/PDF generado? | A: Filesystem / B: S3/R2 / C: Solo en DB | **A: Filesystem** — con Docker volume para persistencia |
| 5 | ¿Logo upload? | A: Sí, configurable / B: No, defaults | **A: Sí** — multer + filesystem |
| 6 | ¿Qué pasa si el usuario cambia el MDD después de generar EVD? | A: Regenerar automáticamente / B: Marcar como desactualizado / C: Nada | **B: Marcar con badge "outdated" + botón regenerar** |
| 7 | ¿Idioma del deck? | A: Español / B: Inglés / C: Configurable | **C: Configurable** — detectar del MDD/BRD o permitir override |

---

## 10. Archivos a crear/resumén

### Nuevos (crear desde cero)

```
apps/api/src/modules/evd/
  ├── evd-storage.service.ts
  ├── evd-storage.module.ts
  ├── evd-design-system.ts
  ├── evd-color.utils.ts
  ├── evd-chart-theme.ts
  ├── evd-mermaid-theme.ts
  ├── evd-typography.ts
  ├── evd-chart.service.ts
  ├── evd-diagram.service.ts
  ├── evd-wireframe.service.ts
  ├── evd-renderer.service.ts
  ├── evd-pptx.service.ts
  ├── evd-pdf.service.ts
  ├── evd-html.template.ts
  └── evd-export.service.ts

apps/api/src/modules/ai/prompts/
  ├── evd-prompt.md
  └── evd-prompt.ts

apps/api/src/modules/ai/
  └── evd-schema.ts

apps/web/src/components/evd/
  ├── EvdSlideEditor.tsx
  ├── EvdSlideCanvas.tsx
  ├── EvdSlideToolbar.tsx
  ├── EvdBrandingPanel.tsx
  ├── EvdSlideProperties.tsx
  ├── EvdExportBar.tsx
  └── EvdPreviewCarousel.tsx

apps/web/src/hooks/
  ├── useEvdEditor.ts
  └── useEvdExport.ts
```

### Modificar (existente)

```
packages/shared-types/src/deliverables-matrix.ts     ← añadir evd
packages/shared-types/src/stage-deliverable-snapshot.ts ← añadir evd
packages/shared-types/src/project-generation-guard.ts   ← añadir evd
packages/database/schema.prisma                         ← evdContent column
apps/api/src/modules/ai/ai.service.ts                   ← generateEVDJSON()
apps/api/src/modules/projects/projects.service.ts       ← generateEVD() + case evd
apps/api/src/modules/projects/projects.controller.ts   ← endpoints
apps/api/package.json                                   ← dependencias
apps/api/Dockerfile                                     ← Chromium
docker-compose.yml                                      ← volume + mount
apps/web/src/utils/complexityTabs.ts                    ← tab evd
apps/web/src/utils/workshopDocNav.ts                    ← nav item
apps/web/src/store/workshopStore.ts                     ← evd states
apps/web/src/views/WorkshopView.tsx                     ← evd panel
apps/web/src/utils/downloadDocumentsZip.ts              ← evd.json
```

---

## 11. Fuentes de referencia

### Consulting slide design
- [Consulting Slide Standards — Deckary](https://deckary.com/blog/consulting-slide-standards)
- [McKinsey-Style Slides — Deckary](https://deckary.com/blog/mckinsey-style-slides)
- [Strategy Consulting Slide Design — Poesius](https://poesius.com/blog/strategy-consulting-slide-design-principles)

### Librerías
- [pptxgenjs docs](https://gitbrent.github.io/PptxGenJS/)
- [echarts SSR](https://echarts.apache.org/handbook/en/how-to/cross-platform/server)
- [mermaid-cli](https://github.com/mermaid-js/mermaid-cli)

### Patrones del codebase The Forge
- Deliverables matrix: `packages/shared-types/src/deliverables-matrix.ts`
- Generación LLM: `apps/api/src/modules/ai/ai.service.ts`
- Persistencia: `apps/api/src/modules/projects/projects.service.ts`
- Endpoints: `apps/api/src/modules/projects/projects.controller.ts`
- Frontend tabs: `apps/web/src/utils/complexityTabs.ts`
- Store: `apps/web/src/store/workshopStore.ts`
