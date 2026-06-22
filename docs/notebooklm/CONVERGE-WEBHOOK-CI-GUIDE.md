# Converge webhook (CI brownfield) — guía operativa

Copia canónica de la ayuda del Workshop. Mantener alineada con `apps/web/src/content/help/converge-webhook-ci.md`.

## Propósito

Automatizar **converge brownfield** desde CI: detectar drift entre `tasks.md`/MDD y el codebase (vía Ariadne), y notificar o persistir resultados mediante webhook HTTP.

## Superficie

| Capa | Detalle |
|------|---------|
| API | `POST /projects/:id/converge/trigger` — body `{ persist?, webhookUrl? }`, query `?stageId=` |
| UI | Workshop → Integración → **Webhook converge (CI)** → `Project.convergeWebhookUrl` |
| Env | `CONVERGE_WEBHOOK_URL` (fallback global) |
| Secreto | `Project.convergeWebhookSecret` → header `X-TheForge-Signature: sha256=…` |
| Implementación | `sdd-integration.service.ts` → `triggerConverge` |

## Cadena brownfield

```text
git push → Ariadne webhook/resync → The Forge converge/trigger → webhook downstream
```

Ariadne reindexa **por repositorio** (webhook Bitbucket/GitHub o `POST /repositories/:id/resync[-for-project]`). The Forge no reindexa; consume MCP. El pipeline debe **esperar** resync antes de trigger.

## Prioridad URL webhook

1. Body `webhookUrl`
2. `Project.convergeWebhookUrl`
3. `CONVERGE_WEBHOOK_URL`

## Payload saliente

Evento `theforge.converge` con `conformanceGaps`, `convergeSection`, `suggestedTasksMarkdown`, `openTaskCount`, `persisted`, `webhookSent`.

## Plan de referencia

- `docs/plans/PLAN-BROWNFIELD-P1-P2-P3.md` (P2.5, D3)

## Cadena Ariadne (reindex automático)

Ariadne puede llamar `converge/trigger` **por repositorio** tras sync exitoso (`theforge_converge_trigger_mode`). Ver monorepo Ariadne: `docs/notebooklm/BROWNFIELD-CONVERGE-THEFORGE.md`.
