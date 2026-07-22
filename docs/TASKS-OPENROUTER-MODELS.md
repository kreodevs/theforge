# Tasks — modelos OpenRouter y tiempo de generación

Guía para **Ajustes → Proveedores → instancia activa** (OpenRouter). Relacionado: [TASKS-ROL-EN-SDD.md](./TASKS-ROL-EN-SDD.md), pipeline en `tasks-generation-pipeline.service.ts`.

---

## Qué modelo hace qué

| Fase | Campo en Ajustes | Rol |
|------|------------------|-----|
| **Redactor** (escribe `tasks.md`) | **Modelo de chat** | Markdown YAML, lotes de ~24 ítems del plan |
| **Planner** (plan JSON) | **Modelo auditor / planner** (vacío = chat) | JSON estricto, cobertura API/pantallas |
| **Auditor LLM** (umbral 92) | **Modelo auditor / planner** | Puntúa calidad; no debe ser el mismo rol débil que genera |
| **Reparación parche** | **Modelo auditor / planner** | 1 llamada cuando solo falla el auditor |
| **Reparación regen** | **Modelo de chat** | Regenera todos los lotes (caro en tiempo) |

**Regla:** deja auditor/planner **vacío** solo si chat y auditor comparten el mismo modelo a propósito. Para Tasks en proyectos HIGH, **separa modelos**.

---

## Combos recomendados (OpenRouter)

Verifica slugs en [openrouter.ai/models](https://openrouter.ai/models); los `:nitro` / `:floor` dependen de tu cuenta.

### Económico (~$ / proyecto grande)

| Campo | Modelo sugerido | Notas |
|-------|-----------------|-------|
| Chat (redactor) | `google/gemini-2.5-flash-preview` o `openai/gpt-4o-mini` | Rápido, markdown aceptable |
| Auditor / planner | `openai/gpt-4o-mini` o `anthropic/claude-3.5-haiku` | JSON + criterio barato |
| Respaldo | `google/gemma-3-27b-it:nitro` | Solo si falla el chat |

Tiempo orientativo: **25–45 min** (90 ítems, 4 lotes paralelos ×2). Riesgo: más reparaciones si el redactor es flojo.

### Equilibrado (recomendado ForgeOps / HIGH)

| Campo | Modelo sugerido | Notas |
|-------|-----------------|-------|
| Chat (redactor) | `anthropic/claude-sonnet-4` o `openai/gpt-4o` | Buen YAML largo, menos truncado |
| Auditor / planner | `openai/gpt-4o-mini` o `google/gemini-2.5-flash-preview` | Distinto del redactor; auditoría rápida |
| Respaldo | `google/gemma-3-27b-it:nitro` | Chat fallback |

Tiempo orientativo: **15–30 min**. Mejor relación calidad/tiempo que MiniMax único para todo.

### Máxima calidad

| Campo | Modelo sugerido | Notas |
|-------|-----------------|-------|
| Chat (redactor) | `anthropic/claude-sonnet-4` o `google/gemini-2.5-pro-preview` | Documentos largos, pocas reparaciones |
| Auditor / planner | `openai/gpt-4o` o `anthropic/claude-sonnet-4` | Planner + auditor exigente |
| Respaldo | `openai/gpt-4o-mini` | Degradación controlada |

Tiempo orientativo: **20–40 min** (menos ciclos repair aunque cada llamada cuesta más).

---

## Tu config actual (`minimax/minimax-m3` en todo)

- **Problema:** mismo modelo genera, planifica y audita → auditor LLM ~45–50 con gates deterministas ~95 (ForgeOps).
- **Cambio mínimo:** mantén MiniMax en **chat**; pon en **auditor/planner** `openai/gpt-4o-mini` o `gemini-2.5-flash`.
- **Cambio fuerte:** combo **equilibrado** arriba.

---

## Variables de entorno (tiempo de generación)

Opcionales en API / Dokploy:

| Variable | Default | Efecto |
|----------|---------|--------|
| `TASKS_REDACTOR_BATCH_SIZE` | `24` | Más ítems por llamada → menos lotes |
| `TASKS_REDACTOR_CONCURRENCY` | `2` | Lotes en paralelo (máx. 4; cuidado rate limit) |
| `TASKS_PIPELINE_MAX_REPAIRS` | `2` | Reparaciones si no truncado |
| `TASKS_PIPELINE_MAX_REPAIRS_TRUNCATED` | `3` | Si documento truncado |
| `TASKS_PIPELINE_MAX_REPAIRS_DEFICIT` | `3` | Si faltan muchas tareas vs plan |
| `TASKS_REPAIR_STAGNANT_DELTA` | `3` | Corta repairs si el score LLM no mejora |

Optimizaciones en código (v1.6+):

- Lotes de redacción **en paralelo** (`TASKS_REDACTOR_CONCURRENCY`).
- Si **solo falla el auditor LLM** (determinista OK) → **parche** (1 LLM) en lugar de regenerar todos los lotes.
- **Early exit** si el score del auditor no sube entre intentos.
- Borrador incremental en Workshop (ves el doc crecer).

---

## Estimación de llamadas (90 ítems de plan)

| Escenario | Llamadas LLM aprox. |
|-----------|---------------------|
| Ideal (pasa a la 1ª) | 1 planner + 4 redactor + 1 auditor ≈ **6** |
| 1 repair solo LLM (parche) | +1 parche +1 auditor ≈ **8** |
| 1 repair regen completa | +4 redactor +1 auditor ≈ **11** |
| Antes (MiniMax, 5 repairs regen) | **30+** llamadas, 120+ min |

---

## Checklist rápido

1. Separar **chat** y **auditor/planner**.
2. Subir `TASKS_REDACTOR_CONCURRENCY=2` (o `3` si OpenRouter no limita).
3. Regenerar Tasks con pestaña abierta (borrador incremental).
4. Si sigue bloqueando en `TASKS_QUALITY_BLOCKED`, revisar upstream (API, pantallas) antes de subir más repairs.
