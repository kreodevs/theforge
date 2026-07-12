# Executive Vision Deck (EVD) — Plan de Implementación + Monetización

> Estado actualizado: Fase de diseño completa. Implementación pendiente de iniciar.

---

## Objetivo
- Construir un nuevo entregable premium para The Forge llamado **"Executive Vision Deck (EVD)"** — un generador de presentaciones visuales nativas de calidad de agencia, con exportación PPTX y PDF, incluyendo charts, diagramas, wireframes y diseño profesional.
- **Monetización vía portal externo de licenciamiento** — sin módulo separado, el código EVD vive en el mismo repo open source, protegido por validación de licencia server-side.

## Decisiones Clave

### Enfoque Visual-Nativo
- **Enfoque B (Visual-Nativo)** seleccionado sobre Enfoque A (markdown-rich)
- Server-side rendered charts (echarts SSR → SVG), mermaid diagrams, programmatic SVG wireframes
- pptxgenjs para PPTX, puppeteer para PDF

### Calidad de Presentación
- Estándar consultivo (McKinsey/BCG/Bain): action titles, un-mensaje-por-slide, pirámide invertida
- Máximo 2 tipografías, 3-4 colores, source citations en cada chart, whitespace como elemento de diseño

### Datos y Storage
- **EVD es on-demand, NO en cascade**: el usuario dispara la generación manualmente
- Fuentes de datos: Phase 0/DBGA + BRD + MDD (requisito mínimo). Guardrail: rechaza si ninguno existe. Wireframes solo cuando `uiScreensContent` existe
- **Storage permanente**: `/app/data/{projectId}/` via Docker named volume `theforge_api_data`
- API container actualmente sin mounts de volumen (stateless)

### Infraestructura Existente (o ausente)
- **No existe** infraestructura de almacenamiento de archivos, exportación o rendering visual en The Forge — todo se construye desde cero
- `pptxgenjs@4.0.1` (4.1M downloads, MIT, cero deps), `echarts` (SSR SVG), `@mermaid-js/mermaid-cli` (necesita Chromium), `puppeteer` (HTML→PDF), `multer` (logo upload)

### Edición en Editor
- **Slides editables en browser**: editor visual full (no solo textarea), con drag-reorder, inline editing, panel de branding, preview carousel
- Patrones de referencia: StandardDocPanel, WorkshopView, store, tab system

---

## Infraestructura Docker (Crítico)

El API container (`theforge-api`) actualmente es **stateless** — cero mounts de volumen.

```yaml
# docker-compose.yml - cambios necesarios
services:
  api:
    volumes:
      - theforge_api_data:/app/data

volumes:
  theforge_api_data:
    name: theforge_api_data
```

El Dockerfile del API necesita Chromium para mermaid-cli + puppeteer:
```dockerfile
# apps/api/Dockerfile
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

---

## Stack Técnico

| Componente | Librería | Uso |
|---|---|---|
| PPTX export | `pptxgenjs@4.0.1` | Generación programática de slides |
| Charts SSR | `echarts` | SVG server-side de charts |
| Diagramas | `@mermaid-js/mermaid-cli` | Mermaid → SVG/PNG |
| PDF export | `puppeteer` | HTML → PDF de alta calidad |
| Upload | `multer` | Logo upload |

---

## Schema JSON (Estructura de un Slide)

```json
{
  "title": "Action Title — una oración con message",
  "subtitle": "Contexto breve (opcional)",
  "template": "title|hero|kpi|chart|mermaid|wireframe|comparison|quadrant|quote|sources",
  "layout": "full|two-column|sidebar",
  "branding": {
    "logoPath": "/app/data/{projectId}/logo.png",
    "primaryColor": "#1a56db",
    "accentColor": "#f59e0b"
  },
  "content": {
    // Depende del template:
    // chart: { type, data, options }
    // mermaid: { code, theme }
    // wireframe: { components[] }
    // kpi: { items[{ label, value, trend }] }
    // comparison: { items[{ before, after }] }
    // sources: [{ label, url }]
  }
}
```

---

## Template de Slides Disponibles

| Template | Descripción |
|---|---|
| `title` | Portada / cierre |
| `hero` | Imagen grande + texto superpuesto |
| `kpi` | Métricas clave con trends |
| `chart` | Bar/Line/Pie/Scatter/Heatmap |
| `mermaid` | Diagrama de flujo/arquitectura |
| `wireframe` | Wireframe programático SVG |
| `comparison` | Antes vs Después |
| `quadrant` | Matriz 2x2 |
| `quote` | Cita o insight destacado |
| `sources` | Fuentes y referencias |

---

## Fases de Implementación

### Fase 1: Storage + DB (~12h)
- Docker volume `theforge_api_data` + mount
- Prisma schema: `evdContent String? @db.Text` en Project y Stage
- Storage service: `EvdStorageService` (save/load/delete JSON, export PPTX/PDF, logo upload)
- Shared types: `EVDJSON` type + `evd` en `DeliverableKind`

### Fase 2: AI Generation (~16h)
- `evd-prompt.md` + `evd-prompt.ts` en `/apps/api/src/modules/ai/prompts/`
- `generateEVDJSON()` en `ai.service.ts`
- Validación de fuentes mínimas (DBGA/BRD/MDD)

### Fase 3: Export Engine (~24h)
- `pptxgenjs` renderer: JSON → PPTX
- `echarts` SSR: chart JSON → SVG
- `mermaid` CLI: code → SVG
- `puppeteer` PDF: HTML template → PDF
- Wireframe generator: component tree → SVG

### Fase 4: Frontend Editor (~20h)
- EVD tab en WorkshopView (HIGH complexity only)
- Visual slide editor con drag-reorder
- Inline text editing (contenteditable)
- Branding panel (colores, logo)
- Preview carousel
- Export buttons (PPTX, PDF)
- Logo upload component

### Fase 5: Integration (~8h)
- Case en `generateDocument()` switch (projects.service.ts:1626)
- EVD en complexityTabs.ts (HIGH only)
- Nav item en workshopDocNav.ts
- State en workshopStore.ts

---

## Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `packages/shared-types/src/deliverables-matrix.ts` | Agregar `"evd"` a `DeliverableKind` |
| `packages/database/schema.prisma` | Agregar `evdContent` a Project + Stage |
| `packages/shared-types/src/stage-deliverable-snapshot.ts` | Agregar `evd` a field arrays |
| `packages/shared-types/src/project-generation-guard.ts` | Agregar mapping |
| `apps/api/src/modules/ai/ai.service.ts` | Agregar `generateEVDJSON()` |
| `apps/api/src/modules/projects/projects.service.ts` | Agregar `generateEVD()` + case |
| `apps/api/src/modules/projects/projects.controller.ts` | Agregar endpoints export + validación licencia |
| `apps/api/package.json` | pptxgenjs, echarts, mermaid-cli, multer |
| `apps/api/Dockerfile` | Instalar Chromium |
| `apps/web/src/utils/complexityTabs.ts` | Agregar `"evd"` tab |
| `apps/web/src/views/WorkshopView.tsx` | Agregar EVD panel + editor |
| `apps/web/src/store/workshopStore.ts` | Agregar evd states |
| `apps/web/src/utils/workshopDocNav.ts` | Agregar nav item (Presentation icon) |
| `docker-compose.yml` | Volumen + mount |

---

## Esfuerzo Estimado

### EVD (en repo open source)

| Componente | Horas |
|---|---|
| Storage + DB (Fase 1) | ~12h |
| AI Generation (Fase 2) | ~16h |
| Export Engine (Fase 3) | ~24h |
| Frontend Editor (Fase 4) | ~20h |
| Integration (Fase 5) | ~8h |
| **Total EVD** | **~80h** |

### Portal de Licenciamiento (standalone)

| Componente | Horas |
|---|---|
| Backend API + DB schema + usage tracking | ~22h |
| Auth + user dashboard | ~12h |
| Stripe integration (one-time **+ subscriptions**) | ~18h |
| Subscription management (upgrade/downgrade/cancel) | ~8h |
| Admin panel + abuse detection | ~14h |
| Per-Project extension/reactivation flow | ~6h |
| Deploy + ops | ~8h |
| **Total Portal** | **~88h** |

### Integración (EVD ↔ Portal)

| Componente | Horas |
|---|---|
| Validation handler en The Forge | ~4h |
| Offline cache + HMAC | ~4h |
| Settings UI para license key | ~4h |
| **Total Integración** | **~12h** |

| **TOTAL GENERAL** | **~180h** |

---

## Estrategia de Monetización — Portal Externo

### Modelo Seleccionado
EVD vive en el mismo repo open source. **Protección vía validación server-side** contra un portal externo de licenciamiento. No hay módulo separado ni package npm privado.

### Por qué funciona
- La generación EVD ocurre en el API (server-side). El usuario no puede "quitar el check" sin reimplementar toda la lógica de generación
- Sin clave válida, el handler simplemente no ejecuta — no hay código que forkear y "arreglar"
- El portal puede validar, rate-limit, expirar, y trackear uso

### Arquitectura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Portal Web      │     │  The Forge API   │     │  Portal API     │
│  (emite licencia)│     │  (valida licencia)│     │  (backend)      │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                         │
         │  1. Usuario registra  │                         │
         │  y obtiene clave      │                         │
         ├──────────────────────►│                         │
         │                       │  2. POST /validate      │
         │                       ├────────────────────────►│
         │                       │  3. { valid, tier,      │
         │                       │       expiresAt }       │
         │                       │◄────────────────────────┤
         │                       │                         │
         │  4. Guarda en Settings │                         │
         │  { licenseKey: "..." } │                         │
         ├──────────────────────►│                         │
         │                       │  5. Generar EVD:        │
         │                       │  validates → generates  │
         │                       │  → exports PPTX/PDF     │
         └───────────────────────┘                         │
                                                           │
```

### Flujo de Validación
1. **Al generar/exportar EVD**: API valida la clave con el portal
2. **Verificación de projectId**: La clave debe coincidir con el projectId actual
3. **Verificación de límites**: generationsUsed < generationsLimit, exportsUsed < exportsLimit
4. **Si portal reachable**: usa respuesta del portal (tier, límites, uso)
5. **Si portal unreachable**: cache local con TTL 24h + firma HMAC para validación offline
6. **Grace period**: 7 días sin conexión → fail-closed después
7. **Post-generación**: POST /licenses/increment para actualizar contadores

### Seguridad del Código
- **Código EVD en repo open source** — anyone puede ver la lógica
- **Protección real**: validación server-side. No hay forma de "skippear" sin reimplementar la generación completa
- **Disuasión adicional**: watermarking, telemetry, rate limiting por clave

### Almacén de Licencia en Settings
```json
// Settings del Forge (existing pattern)
{
  "licenseKey": "evd-xxxx-xxxx-xxxx",
  "licenseServer": "https://license.theforge.dev",
  "licenseCache": {
    "valid": true,
    "tier": "evd-project",
    "projectId": "uuid-del-proyecto",
    "instanceId": "id-de-la-instancia-dokploy",
    "generationsUsed": 3,
    "generationsLimit": 10,
    "exportsPptxUsed": 1,
    "exportsPdfUsed": 2,
    "validatedAt": "2026-07-11T10:00:00Z"
  }
}
```

### Modelo de Pricing — Dual (One-Time + Mensual)

The Forge se monetiza por **dos vías complementarias**: acceso a la plataforma (instancia) y funcionalidad premium (EVD). Cada vía tiene su propio modelo de cobro.

---

#### A. Acceso a la Plataforma (ForgeOps + Ariadne)

| Tier | Precio | Tipo | Qué obtiene | Duración |
|---|---|---|---|---|
| **Shared Starter** | $9/mo | Mensual | Instancia compartida, 3 proyectos, Forge + Ariadne | Mientras pague |
| **Shared Pro** | $19/mo | Mensual | Instancia compartida, 10 proyectos, prioridad en cola | Mientras pague |
| **Private** | $49/mo | Mensual | VPS dedicado (Contabo), proyectos ilimitados, acceso total | Mientras pague |
| **Per-Project** | $29 one-time | Por proyecto | 1 proyecto en instancia compartida, acceso 6 meses | 6 meses, luego solo lectura |

**Instancia compartida = multi-tenant oculto:**
- The Forge de cada usuario NO ve los otros usuarios en el VPS
- Cada proyecto está aislado a nivel de base de datos
- El usuario percibe que tiene su propia instancia
- ForgeOps administra el VPS y distribuye usuarios

**Per-Project (one-time) — detalles:**
- Usuario paga $29 una vez, obtiene 1 proyecto en instancia compartida
- Acceso completo durante 6 meses (generar, editar, exportar todo)
- After 6 meses: proyecto en **solo lectura** (puede ver, descargar, pero no generar/editar)
- Para reactivar: puede comprar "extensión" ($15/3 meses) o migrar a plan mensual
- **No incluye EVD** (se compra por separado o como add-on)

---

#### B. Executive Vision Deck (EVD) — Add-on

EVD se vende **por separado** del acceso a la plataforma. Disponible en cualquier tier.

| Tier EVD | Precio | Tipo | Incluye | Duración | Límites |
|---|---|---|---|---|---|
| **EVD Free** | $0 | — | Sin acceso a EVD | — | — |
| **EVD Project** | $49 one-time | Por proyecto | EVD para 1 proyecto específico | 6 meses | 10 generaciones + 10 exports PPTX + 10 exports PDF |
| **EVD Pack 3** | $119 one-time | Por proyecto | EVD para 3 proyectos | 12 meses | 10 generaciones + 10 exports por proyecto |
| **EVD Monthly** | $19/mo | Mensual | EVD ilimitado en todos los proyectos | Mientras pague | 30 generaciones/mes + exports ilimitados |

**Por qué EVD y no incluido en la plataforma:**
- EVD es software puro, costo marginal ≈ $0
- Permite monetizar usuarios de instancia compartida (que pagan poco por la plataforma)
- El usuario que solo necesita 1 presentación no paga mensual por EVD

**Binding de licencia EVD a proyecto:**
- `EVD Project` y `EVD Pack 3`: clave vinculada al `projectId` al activarse. No reasignable
- Si el usuario borra el proyecto, pierde la licencia (y el trabajo)
- `EVD Monthly`: sin绑定 a proyecto específico, válida en la instancia

**Ejemplo de usuario:**
```
Compartida Starter ($9/mo) + EVD Project ($49 one-time)
= $58 total primer mes, luego $9/mo

Private ($49/mo) + EVD Monthly ($19/mo)  
= $68/mo total

Per-Project ($29 one-time, 6 meses) + EVD Project ($49 one-time, 6 meses)
= $78 total por 6 meses de 1 proyecto completo
```

---

#### C. Resumen de Todos los Tiers

| Tier | Precio | Tipo | Plataforma | EVD | Proyectos | Duración |
|---|---|---|---|---|---|---|
| Free | $0 | — | Core (sin deploy) | No | — | — |
| Per-Project | $29 one-time | Por proyecto | Shared, 1 proyecto | No | 1 | 6 meses → solo lectura |
| Shared Starter | $9/mo | Mensual | Shared, 3 proyectos | No | 3 | Mientras pague |
| Shared Pro | $19/mo | Mensual | Shared, 10 proyectos | No | 10 | Mientras pague |
| Private | $49/mo | Mensual | Dedicado, ilimitado | No | Ilimitado | Mientras pague |
| + EVD Project | +$49 one-time | Por proyecto | — | 1 proyecto | — | 6 meses |
| + EVD Pack 3 | +$119 one-time | Por proyecto | — | 3 proyectos | — | 12 meses |
| + EVD Monthly | +$19/mo | Mensual | — | Todos | — | Mientras pague |

---

#### D. Flujo de Compra

```
Usuario llega a theforge.dev
  ├─ Opción 1: "Prueba gratis" → Free tier (sin deploy)
  ├─ Opción 2: "Un proyecto" → Per-Project $29 → Stripe checkout → clave por email
  └─ Opción 3: "Plan mensual" → Stripe subscription → provisionamiento Dokploy
       ├─ Shared Starter $9/mo
       ├─ Shared Pro $19/mo
       └─ Private $49/mo
            └─ Post-compra: upsell EVD ("¿Quieres presentaciones ejecutivas?")
                 ├─ EVD Project $49 (si tiene 1 proyecto)
                 ├─ EVD Pack 3 $119 (si tiene varios)
                 └─ EVD Monthly $19/mo (si usa la plataforma intensivamente)
```

---

#### E. Mitigación de Abuso

| Vector | Mitigación |
|---|---|
| Compartir claves EVD | Vinculada a `projectId` + `instanceId`. Rate limiting por clave |
| Borrar y recrear proyecto | Pierde todo el trabajo (MDD, BRD, DBGA). Recrear toma horas reales |
| Instancia compartida: un usuario ve a otros | The Forge solo muestra proyectos del usuario autenticado. Aislamiento a nivel DB |
| Scraping de generación EVD | Server-side generation. Sin clave, el handler no ejecuta |
| Uso excesivo de EVD | Generaciones por mes limitadas. Exceso → upgrade a EVD Monthly |
| Cancelar suscripción y seguir usando | Instance se apaga al cancelar. Datos se retienen 30 días |

### Roadmap
1. **Portal de licenciamiento** (PREREQUISITO) — crear antes que EVD
2. **EVD sin licensing** — desarrollo inicial, validar demanda
3. **Integración portal** — conectar validación
4. **Pricing tiers + checkout** — monetización completa

---

## Prerequisito: Portal de Licenciamiento

**El portal debe construirse ANTES de integrar licensing en EVD.**

### Stack del Portal
- Backend: NestJS standalone
- DB: PostgreSQL (licenses, users, orders, usage, subscriptions)
- Auth: OAuth2 / magic links
- Payments: Stripe (**one-time payments + subscriptions**)
- Deploy: Dokploy (ya tenemos infra)

### Funcionalidades del Portal
| Feature | Descripción |
|---|---|
| License generation | Emit keys vinculadas a projectId + instanceId |
| Subscription management | Stripe subscriptions para planes mensuales (Shared/Private) |
| One-time purchases | Stripe one-time para Per-Project y EVD packs |
| Validation API | Endpoint que The Forge llama para validar + verificar límites |
| Usage tracking | Conteo de generaciones y exports por clave/proyecto/subscription |
| User dashboard | Historial de licencias, invoices, proyectos activos, suscripciones |
| Admin panel | Gestión de licencias, métricas, revocation, abuse detection |
| Stripe webhooks | Activar licencias según pagos (one-time o recurrente) |
| Rate limiting | Por clave, por IP, por tier (generaciones/día) |
| Offline cache | HMAC-signed cache para validación sin conexión |
| Expiration handling | Per-Project: 6 meses → solo lectura. EVD packs: expiración + grace period |
| Extension purchases | Comprar extensión de Per-Project ($15/3 meses) o reactivar |

### Endpoints del Portal API
```
# Licencias
POST   /api/licenses/validate    → { valid, tier, projectId, generationsLeft, exportsLeft, expiresAt }
POST   /api/licenses/create      → genera nueva licencia vinculada a projectId
POST   /api/licenses/activate    → activar tras pago Stripe (one-time o subscription)
GET    /api/licenses/:key        → info de licencia + uso
DELETE /api/licenses/:key        → revocar licencia
POST   /api/licenses/increment   → incrementar contador de uso (generaciones/exports)

# Subscriptions (mensual)
POST   /api/subscriptions/create      → crear suscripción Stripe (Shared/Private/EVD Monthly)
POST   /api/subscriptions/cancel      → cancelar suscripción (datos se retienen 30 días)
GET    /api/subscriptions/:id         → info de suscripción + estado
POST   /api/subscriptions/upgrade     → cambiar de tier (Shared Starter → Pro → Private)

# Per-Project extensions
POST   /api/licenses/extend           → extender Per-Project ($15/3 meses)
POST   /api/licenses/reactivate       → reactivar proyecto en solo lectura → acceso completo
```

---

## Notas de Implementación

### Patrones Frontend Existentes a Seguir
- `StandardDocPanel`: textarea + preview toggle → referencia para editing
- `WorkshopView`: tab system + panel switching
- `workshopStore`: state management pattern

### Prompts de IA
- Nuevo archivo: `/apps/api/src/modules/ai/prompts/evd-prompt.md`
- Nuevo archivo: `/apps/api/src/modules/ai/prompts/evd-prompt.ts`
- Referencia: Existing prompts en el mismo directorio

### Docker/Puppeteer
- Chromium necesita instalación en Dockerfile
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`
- Puppeteer en Docker requiere `--no-sandbox` flag

---

## Próximos Pasos

1. **Crear Portal de Licenciamiento** (PREREQUISITO — antes que EVD)
2. Iniciar Fase 1 del EVD: Docker volume + storage service + Prisma schema
3. Crear shared types para `EVDJSON`
4. Implementar `EvdStorageService`
5. Integrar validación de licencia contra portal
