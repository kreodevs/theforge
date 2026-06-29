---
id: integracion-new-legacy
title: Integración NEW ↔ LEGACY
category: Arquitectura
last_updated: 2026-06-29
---

# Integración NEW ↔ LEGACY (Handoff)

> **AI Context Brief:** Flujo de handoff entre un proyecto NEW (greenfield) y uno LEGACY (brownfield): el equipo NEW registra items `NEW-LEG-*` y el IntegrationAgent los convierte en `handoff-spec.md`. Léelo antes de tocar el módulo de integración o el agente de handoff.

## 1. Uso Básico (Quick Start)

```typescript
// Items de handoff NO son tabla propia: viven en JSON.
//   Project.integrationHandoff = { items: IntegrationHandoffItem[] }   (IDs NEW-LEG-\d{2,})
//   IntegrationTrace            = matriz de trazabilidad NEW-LEG ↔ etapa/historia legacy
//   Stage.handoffSpecContent    = handoff-spec.md generado (aplanado en Project)

// Generar/regenerar el documento:
//   POST /projects/:id/integration/sync-handoff-spec
//   POST /projects/:id/integration/stages/:stageId/sync-handoff-spec
```

## 2. API & Contrato de Tipos (Specs)

| Pieza                         | Archivo                                                                       | Rol                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| Tipos compartidos             | `packages/shared-types/src/project-integration.ts`                            | `IntegrationHandoffItem`, `IntegrationHandoff`, `IntegrationTraceRow` (+ Zod). |
| Servicio de integración       | `apps/api/src/modules/projects/integration/project-integration.service.ts`    | Vincular NEW↔LEGACY, CRUD items, send, promote, import, reconcile, abandon. |
| Servicio del agente           | `apps/api/src/modules/projects/integration/integration-agent.service.ts`      | `syncHandoffSpec()` → `runIntegrationAgent()`.            |
| Redactor (agente)             | `apps/api/src/modules/ai-analysis/nodes/integration-agent.node.ts`            | Plan-then-Execute; sondea Ariadne por item.               |
| Controlador                   | `…/integration/project-integration.controller.ts`                             | `POST …/handoff/items`, `POST …/integration/sync-handoff-spec`. |
| UI                            | `apps/web/src/components/IntegrationPanel.tsx`                                 | Pestaña de integración + Handoff Spec.                    |

**Estados de trace:** `DRAFT | SENT | ACCEPTED | IMPLEMENTED | REJECTED`.

**Flujo corto:** NEW crea items en `integrationHandoff` → `handoff/send` → LEGACY promueve a etapa (`promote-to-stage`) o importa → `sync-handoff-spec` escribe `handoffSpecContent` → `IntegrationTrace` rastrea el estado.

## 3. Decisiones de Diseño y Restricciones

- **Regla de Oro (gobernanza):** el IntegrationAgent **solo estructura y profundiza** los items `NEW-LEG-*` ya registrados por el usuario; **nunca inventa** items de handoff.
- **Regla 2:** Los items son **JSON en `Project.integrationHandoff`**, no una tabla `HandoffItem`. No asumas un modelo Prisma dedicado.
- **Regla 3:** El documento es regenerable (botón «Sincronizar Especificación de Handoff»); el contenido editado a mano se persiste vía `persistHandoffSpecContent`.
- **Regla 4:** El redactor cita endpoints **exactos** del proyecto NEW (contratos de API + MDD §4) y consolida bloqueos en la sección «Gaps y decisiones pendientes»; si una ruta no existe, la marca como pregunta abierta en vez de inventarla.
- **Regla 5:** Diagramas Mermaid por item (`erDiagram` §3, `sequenceDiagram` §4, `flowchart`/`stateDiagram-v2` según el caso); un solo fence ` ```mermaid ` por diagrama.
