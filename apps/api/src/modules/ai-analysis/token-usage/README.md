# Token Usage Telemetry

Módulo que registra cada llamada LLM del Workshop (chat, cascada de documentos, pipeline MDD) en la tabla `TokenUsage` para mostrar coste real por documento generado en la columna de métricas.

## Arquitectura

```
Controller (chat / cascade / MDD queue)
  └── runWithTokenUsageContext(ctx, fn)        ← AsyncLocalStorage
        └── AiService.generateResponse/Stream
              └── LLMProvider (OpenAI / Anthropic / Gemini)
                    └── response.usage / stream chunk usage
                          └── recordTokenUsageFromContext()
                                └── TokenUsageService.record()     ← BD
```

- **`token-usage.context.ts`** — `AsyncLocalStorage<TokenUsageContextValue>`. Helpers: `runWithTokenUsageContext(payload, fn)`, `runWithTokenUsageContext` para propagación transparente a través de awaits.
- **`token-usage.service.ts`** — `TokenUsageService` (NestJS provider): `record(event)` persite un evento. `getSummary(projectId)` agrega por documento/modelo vía `aggregateTokenUsageRows` (función pura, testeable). `recordAsync()` fire-and-forget para adapters de streaming.
- **`token-usage-recorder.ts`** — Helper DI-agnóstico en `apps/api/src/modules/ai/utils/`. `recordTokenUsageFromContext(provider, model, promptTok, completionTok, totalTok)` consume el contexto activo vía `getActiveTokenUsageContext()` y delega al `TokenUsageService` registrado en `globalThis` por `onModuleInit`.
- **`chat-model-pricing.ts`** — Catálogo USD/MXN por `(providerId, modelId)`. `calculateChatCostUsd(...)` calcula el coste; `usdToMxn(usd)` (en `FxRateService`) lo convierte.
- **`fx-rate.service.ts`** — Lee `AppConfig.mxn_per_usd` con cache 60s. `FxRateService.usdToMxn(usd)` async. `invalidate()` se llama desde `SystemConfigService.patchSettings` cuando cambia el TC.

## Cost snapshots

El `costMxn` se **snapshotea** en cada evento con el TC vigente al momento del call. Cambios futuros en el TC (Ajustes → Sistema) **no afectan** a totales históricos. La columna `mxnPerUsd` en `getSummary` devuelve el TC actual de la plataforma para que la UI lo muestre como info.

## Cómo agregar un modelo nuevo al catálogo

Cuando el equipo agregue un modelo (ej. `anthropic/claude-4.5-sonnet` en OpenRouter, o `gpt-4.1` directo), basta con editar `apps/api/src/modules/ai/providers/chat-model-pricing.ts` y añadir entrada al objeto `CHAT_MODEL_PRICING`:

```ts
// OpenRouter (slug con prefijo upstream)
"openrouter:anthropic/claude-4.5-sonnet": {
  input: 3,        // USD por 1M input tokens
  output: 15,      // USD por 1M output tokens
  source: "openrouter",
  capturedAt: "2026-07-24",
},

// Directo (OpenAI / Anthropic / Gemini / Groq / Cloudflare)
"openai:gpt-4.1": { input: 2, output: 8, source: "openai" },
"anthropic:claude-4-5-sonnet-20251001": { input: 3, output: 15, source: "anthropic" },
```

Convenciones:
- **Key**: `${providerId}:${modelId}` — sin prefijo upstream para proveedores directos; con prefijo upstream (e.g. `openai/`, `anthropic/`) para OpenRouter.
- **`input` / `output`**: USD por millón de tokens. Snapshot del precio público; actualizar cuando el proveedor cambie tarifas.
- **`source`**: nombre del proveedor (auditoría).
- **`capturedAt`**: ISO 8601. Opcional pero útil para stale-checks manuales.

Para proveedores custom o precios negociados por tenant, usar `registerChatModelPricingOverride(providerId, modelId, pricing)` en runtime (expuesto en `chat-model-pricing.ts`).

Si el modelo no está catalogado, `calculateChatCostUsd` devuelve 0 — el evento se persiste con `costUsd=0 / costMxn=0` y la UI lo muestra como "coste $0.00" (no es un error). La agregación por documento sigue mostrando tokens reales.

## Cómo agregar un nuevo `documentField`

La lista de `documentField` es abierta (string libre). Para que la UI muestre una etiqueta legible:

1. Editar `apps/web/src/components/TokenUsageCard.tsx` (`DOCUMENT_LABELS`).
2. Si el nuevo campo NO está en `apps/api/src/modules/ai/ai.service.ts:finishDocumentGeneration`, añadir `telemetryContext.documentField: "<type>Content"` al `generateOptions` del caller.
3. Si el campo se genera vía `mdd-queue.service.executeJob`, ya queda como `mddContent` por default.

## Wiring por origen

| Origen | Cómo se inyecta `telemetryContext` |
|---|---|
| Workshop chat (`sessions.service.ts`) | `buildSessionChatLlmOptions` → `documentField: "chat"`, `context: "chat"`. |
| Cascada de documentos (`ai.service.ts:finishDocumentGeneration`) | `documentField: "<type>Content"` (e.g. `specContent`, `blueprintContent`). |
| MDD pipeline (`mdd-queue.service.executeJob`) | `runWithTokenUsageContext` envuelve el job entero → `documentField: "mddContent"`, `context: "initial" \| "regenerate"`, `jobId`. |
| Legacy MDD (`legacyCoordinator.generateMdd`) | Mismo wrapper, `context: "regenerate"` si hay `dbgaContent` o `initialMessage` previo. |

## Tests

```
node --import tsx --test \
  src/modules/ai/providers/chat-model-pricing.spec.ts \
  src/modules/ai-analysis/token-usage/token-usage.context.spec.ts \
  src/modules/ai-analysis/token-usage/token-usage.service.spec.ts \
  src/modules/fx-rate/fx-rate.service.spec.ts \
  src/modules/ai-analysis/utils/mdd-llm-retry.util.derive.spec.ts
```

53 specs verde (23 + 11 por documentación futura).

## Endpoints

- `GET /api/ai-analysis/token-usage?projectId&stageId&includeChat` — resumen agregado por documento y modelo.
- `GET /api/ai-analysis/token-usage/events?projectId&stageId&documentField&limit` — eventos crudos (debug).

Ambos requieren `super_admin` ? no — sólo sesión autenticada. Renderizados en UI por `TokenUsageCard` (`apps/web/src/components/TokenUsageCard.tsx`) integrado en `WorkshopMetricsColumnInner.tsx`.
