---
name: theforge
description: Guides work on The Forge monorepo (NestJS API, React Vite web, Prisma, IA-agnostic interview, Workshop view, MDD semaphore, MXN cost estimation, Dokploy). Use when editing The Forge codebase, blueprint, MDD, Workshop, AI module, engine, Docker, or when the user mentions The Forge, Workshop, MDD, semáforo, or cost estimation.
---

# The Forge

## Reference docs

- **Architecture:** `docs/THE-FORGE-INDEX.md` — flujo, IA agnóstica, Semáforo, estimación, Dokploy.
- **Blueprint:** `blueprint.md` — estructura monorepo, Prisma, módulos AI/engine.
- **MDD:** El MDD es la Constitución del proyecto (SDD); gobierna Blueprint, Contratos, Infra. Estructura canónica: 7 secciones (1. Contexto, 2. Arquitectura y Stack, 3. Modelo de Datos, 4. Contratos de API, 5. Lógica y Edge Cases, 6. Seguridad, 7. Infraestructura). Ver `docs/ENTREGABLES-SDD-VALIDACION.md` §0.
- **UI:** `docs/ui-spec.md` — Workshop tres columnas, chat, MDD viewer, Semáforo.
- **Rules:** `.cursor/rules/` — tech-stack, architect-behavior, the-forge-flow.

## Monorepo structure

```
apps/api          NestJS (modules: ai, ai-orchestrator, engine, projects, sessions)
apps/web          React (Vite) + Tailwind (views/WorkshopView, components, store, hooks, utils)
packages/database Prisma schema + client (schema en packages/database)
packages/shared-types DTOs + Zod (Status, ChecklistResult, mddJson, etc.)
packages/config   tsconfig.base, eslint, tailwind
```

## IA agnóstica

- **Contrato:** `LLMProvider` (generateResponse, parseChecklist). Adapters solo en `apps/api/src/modules/ai/adapters/`.
- **Config:** `AI_PROVIDER` (openai | google). Factory por env. Sin lógica de proveedor fuera de adapters.
- **Prompt maestro:** `apps/api/src/modules/ai/prompts/master-prompt.md` — editar el .md; el .ts lo carga en runtime.

## Semáforo y estimación

- **Semáforo:** ROJO (db_entities vacío o business_core null), AMARILLO (falta edge_cases/field_types), VERDE (checklist completo).
- **Costos:** Fórmula fija en `cost-calculator.service.ts` y `apps/web/src/utils/costCalculator.ts`. No alterar: H_total = ((Entidades×12)+(Pantallas×16))×1.25; tarifas MXN Architect 1500, Back 950, Front 850, UX 750. Motor de estimación siempre activo en UI; botón "Generar Entregables" solo en VERDE.

## Workshop (frontend)

- **Estado:** Zustand store `useWorkshopStore` (project, session, mddContent, sendMessage, persistMddContent).
- **Vista:** `WorkshopView.tsx` — grid 3 columnas: ChatContainer (useInterview) | MddViewer (secciones, streaming sin parpadeo) | Semáforo + costos (calculateCostFromMdd).
- **API:** `POST /ai-orchestrator/chat` { projectId, sessionId?, message } → { session, project }.

## Docker / Dokploy

- **Un contenedor:** servicio `theforge-db` (Postgres + API + Nginx). Conexión interna `localhost:5432`.
- **Env:** DATABASE_URL, AI_PROVIDER, OPENAI_API_KEY o GOOGLE_GENERATIVE_AI_API_KEY. Nuevos servicios/variables → actualizar `docker-compose.yml`.

## Reglas de código

- Sin `any`. DTOs desde `shared-types`. Zod para validación en runtime.
- Lógica de negocio en Services, no en Controllers.
- try/catch y logs en llamadas a adapters. Verificar semáforo VERDE antes de generar código cuando aplique.
- YAGNI: no implementar funcionalidad hasta que sea necesaria.

## Checklist al cambiar

- [ ] IA: ¿Solo AI_PROVIDER + factory? ¿Imports de SDKs solo en ai/adapters?
- [ ] Estimación: ¿Fórmula/tarifas intactas en cost-calculator?
- [ ] Docker: ¿docker-compose y env actualizados?
- [ ] README de la carpeta afectada actualizado si creas componente/página.
