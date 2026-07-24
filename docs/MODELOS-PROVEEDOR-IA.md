# Guía de modelos por ajuste de proveedor IA

Referencia para **Ajustes → Proveedores de IA** (instancia activa del equipo o clave personal BYOK). Cada campo del modal define qué modelo usa una fase distinta del taller: chat del orquestador, auditoría MDD, pipeline HIGH, embeddings del grafo, transcripción de voz o mensajes con imágenes.

> **En una frase:** elige un **rango** (económico, medio o top), copia los IDs tal cual en el campo correspondiente y separa **chat** de **auditor/planner** en proyectos HIGH.

---

## Rangos de uso

| Rango | Cuándo elegirlo | Compromiso |
|-------|-----------------|------------|
| **Económico** | Pruebas, demos, proyectos pequeños o presupuesto API ajustado | Menor coste por token; más reintentos o reparaciones posibles |
| **Medio** | Producción habitual ForgeOps / complejidad MEDIA–HIGH | Mejor equilibrio calidad, latencia y coste (recomendado por defecto) |
| **Top** | MDD HIGH exigente, auditorías estrictas, entregables largos (Tasks, Spec) | Máxima calidad y razonamiento; coste API notablemente mayor |

Verifica que el slug exista en la consola de tu proveedor antes de guardar. En **OpenRouter**, consulta [openrouter.ai/models](https://openrouter.ai/models). Los sufijos `:nitro` o `:floor` dependen de tu cuenta.

---

## Campos del modal (qué controla cada uno)

| Campo en Ajustes | Uso en The Forge |
|------------------|------------------|
| **Modelo de chat** | Orquestador del Workshop, redacción de entregables, chat por pestaña, redactor de Tasks |
| **Modelos de respaldo** | Cadena alternativa si falla el chat principal (separados por coma) |
| **Modelo auditor / planner** | MDD Auditor, Cross-Consistency, Tasks Planner, Tasks Auditor LLM, parches de reparación |
| **Modelo top MDD HIGH** | Pipeline MDD HIGH (stack architect, data model, API contracts). Vacío = mismo que chat |
| **Modelo de embeddings** | Memoria vectorial del grafo MDD (RAG). Requiere dimensión coherente con el índice |
| **Modelo de transcripción (STT)** | Voz a texto en el chat (si el proveedor lo expone) |
| **Modelo de visión** | Mensajes del chat con imágenes adjuntas |
| **Respaldo de visión** | Fallback exclusivo del modelo de visión |

**Reglas rápidas**

1. En complejidad **HIGH**, no uses el mismo modelo flojo para **chat** y **auditor/planner**.
2. **Modelo top MDD HIGH** solo impacta la generación MDD en pipeline dividido; el resto del taller sigue con chat/auditor.
3. Si **auditor/planner** queda vacío, The Forge reutiliza el **modelo de chat** (válido solo en LOW/MEDIUM o pruebas).

---

## OpenRouter (recomendado)

Una sola API key accede a todos los slugs `proveedor/modelo`. Es el escenario más flexible para mezclar rangos (p. ej. chat medio + auditor económico + top MDD en Opus).

### Modelo de chat

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `openai/gpt-4o-mini` | `google/gemini-2.5-flash-preview` | `meta-llama/llama-3.1-8b-instruct` |
| Medio | `anthropic/claude-sonnet-4` | `openai/gpt-4o` | `nousresearch/hermes-3-llama-3.1-405b` |
| Top | `anthropic/claude-opus-4` | `openai/o1` | `google/gemini-2.5-pro-preview` |

### Modelos de respaldo (opcional)

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `google/gemma-3-27b-it` | `qwen/qwen-2.5-7b-instruct` | `mistralai/mistral-7b-instruct` |
| Medio | `google/gemini-2.5-flash` | `meta-llama/llama-3.3-70b-instruct` | `openai/gpt-4o-mini` |
| Top | `anthropic/claude-sonnet-4` | `openai/gpt-4o` | `google/gemini-2.5-flash-preview` |

### Modelo auditor / planner

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `openai/gpt-4o-mini` | `anthropic/claude-3.5-haiku` | `google/gemini-2.5-flash-preview` |
| Medio | `openai/gpt-4o-mini` | `google/gemini-2.5-flash` | `anthropic/claude-3.5-haiku` |
| Top | `openai/gpt-4o` | `anthropic/claude-sonnet-4` | `google/gemini-2.5-pro-preview` |

### Modelo top MDD HIGH

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `openai/gpt-4o-mini` | `google/gemini-2.5-flash` | `anthropic/claude-3.5-haiku` |
| Medio | `anthropic/claude-sonnet-4` | `openai/gpt-4o` | `google/gemini-2.5-pro-preview` |
| Top | `anthropic/claude-opus-4` | `openai/o1` | `openai/o1-pro` |

La UI muestra una **referencia de coste MXN** (~15 entidades, pipeline MDD HIGH completo) al configurar este campo.

### Modelo de embeddings

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `openai/text-embedding-3-small` | `openai/text-embedding-ada-002` | — |
| Medio | `openai/text-embedding-3-small` | `google/text-embedding-004` | — |
| Top | `openai/text-embedding-3-large` | `openai/text-embedding-3-small` | — |

Default del catálogo: `openai/text-embedding-3-small` (1536 dimensiones). No cambies de dimensión en un proyecto con índice ya creado sin regenerar embeddings.

### Modelo de transcripción (STT)

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `openai/whisper-1` | — | — |
| Medio | `openai/whisper-1` | — | — |
| Top | `openai/whisper-1` | — | — |

OpenRouter expone principalmente Whisper vía prefijo `openai/`. Para STT dedicado barato, valora instancia **Groq** (`whisper-large-v3`).

### Modelo de visión

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `openai/gpt-4o-mini` | `google/gemini-2.5-flash` | `anthropic/claude-3.5-haiku` |
| Medio | `openai/gpt-4o` | `anthropic/claude-sonnet-4` | `google/gemini-2.5-flash` |
| Top | `openai/gpt-4o` | `anthropic/claude-opus-4` | `google/gemini-2.5-pro-preview` |

### Respaldo de visión (opcional)

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `google/gemini-2.5-flash-preview` | `openai/gpt-4o-mini` | — |
| Medio | `openai/gpt-4o-mini` | `google/gemini-2.5-flash` | — |
| Top | `anthropic/claude-sonnet-4` | `openai/gpt-4o` | — |

---

## OpenAI (API directa)

IDs **sin** prefijo `openai/`. Embeddings, visión y STT nativos.

### Modelo de chat

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `gpt-4o-mini` | `gpt-4.1-nano` | `gpt-3.5-turbo` |
| Medio | `gpt-4o` | `gpt-4.1` | `gpt-4o-mini` |
| Top | `o1` | `o1-pro` | `gpt-4.1` |

### Modelos de respaldo

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `gpt-4o-mini` | `gpt-3.5-turbo` | — |
| Medio | `gpt-4o-mini` | `gpt-4o` | — |
| Top | `gpt-4o` | `gpt-4o-mini` | — |

### Modelo auditor / planner

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `gpt-4o-mini` | `gpt-4.1-nano` | — |
| Medio | `gpt-4o-mini` | `gpt-4o` | — |
| Top | `gpt-4o` | `o1` | `gpt-4.1` |

### Modelo top MDD HIGH

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `gpt-4o-mini` | `gpt-4o` | — |
| Medio | `gpt-4o` | `gpt-4.1` | — |
| Top | `o1` | `o1-pro` | `gpt-4.1` |

### Embeddings / STT / visión

| Campo | Económico | Medio | Top |
|-------|-----------|-------|-----|
| Embeddings | `text-embedding-3-small` | `text-embedding-3-small` | `text-embedding-3-large` |
| STT | `whisper-1` | `whisper-1` | `whisper-1` |
| Visión | `gpt-4o-mini` | `gpt-4o` | `gpt-4o` |
| Respaldo visión | `gpt-4o-mini` | `gpt-4o-mini` | `gpt-4o` |

---

## Anthropic (API directa)

Sin embeddings ni STT en catálogo Forge; configura otro proveedor para embeddings si usas grafo con RAG.

### Modelo de chat

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `claude-3-5-haiku-20241022` | `claude-3-haiku-20240307` | — |
| Medio | `claude-3-5-sonnet-20240620` | `claude-sonnet-4-20250514` | `claude-3-5-haiku-20241022` |
| Top | `claude-opus-4-20250514` | `claude-3-opus-20240229` | `claude-sonnet-4-20250514` |

### Modelo auditor / planner y top MDD HIGH

| Campo | Económico | Medio | Top |
|-------|-----------|-------|-----|
| Auditor / planner | `claude-3-5-haiku-20241022` | `claude-3-5-sonnet-20240620` | `claude-opus-4-20250514` |
| Top MDD HIGH | `claude-3-5-haiku-20241022` | `claude-3-5-sonnet-20240620` | `claude-opus-4-20250514` |

### Visión

Usa los mismos IDs con soporte multimodal (Sonnet/Opus/Haiku según rango). Respaldo: un Haiku si el principal es Sonnet/Opus.

---

## Google Gemini (API directa)

### Modelo de chat

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `gemini-2.0-flash-lite` | `gemini-1.5-flash` | `gemini-2.0-flash` |
| Medio | `gemini-1.5-pro` | `gemini-2.5-flash` | `gemini-2.0-flash` |
| Top | `gemini-2.5-pro` | `gemini-1.5-pro` | `gemini-2.5-flash` |

### Auditor / planner y top MDD HIGH

| Campo | Económico | Medio | Top |
|-------|-----------|-------|-----|
| Auditor / planner | `gemini-2.0-flash` | `gemini-2.5-flash` | `gemini-2.5-pro` |
| Top MDD HIGH | `gemini-2.0-flash` | `gemini-2.5-flash` | `gemini-2.5-pro` |

### Embeddings y visión

| Campo | Económico | Medio | Top |
|-------|-----------|-------|-----|
| Embeddings | `text-embedding-004` | `text-embedding-004` | `text-embedding-004` |
| Visión | `gemini-2.0-flash` | `gemini-1.5-pro` | `gemini-2.5-pro` |

---

## Cloudflare Workers AI

Modelos con prefijo `@cf/`. Sin visión ni STT en el catálogo actual.

### Modelo de chat

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `@cf/meta/llama-3.1-8b-instruct` | `@cf/google/embeddinggemma-300m` | — |
| Medio | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | `@cf/mistral/mistral-small-3.1-24b-instruct` | `@cf/meta/llama-3.1-8b-instruct` |
| Top | `@cf/openai/gpt-oss-120b` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | `@cf/mistral/mistral-small-3.1-24b-instruct` |

### Embeddings

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `@cf/baai/bge-base-en-v1.5` | `@cf/google/embeddinggemma-300m` | — |
| Medio | `@cf/baai/bge-base-en-v1.5` | `@cf/baai/bge-large-en-v1.5` | — |
| Top | `@cf/baai/bge-large-en-v1.5` | `@cf/baai/bge-base-en-v1.5` | — |

Para MDD HIGH exigente, Cloudflare suele quedarse corto en auditoría; combina con OpenRouter u OpenAI en otra instancia.

---

## Groq

Inferencia muy rápida; ideal chat económico y STT. Sin embeddings ni visión en catálogo.

### Modelo de chat

| Rango | Modelo 1 | Modelo 2 | Modelo 3 |
|-------|----------|----------|----------|
| Económico | `llama-3.1-8b-instant` | `openai/gpt-oss-20b` | `meta-llama/llama-4-scout-17b-16e-instruct` |
| Medio | `llama-3.3-70b-versatile` | `qwen/qwen3-32b` | `openai/gpt-oss-120b` |
| Top | `openai/gpt-oss-120b` | `llama-3.3-70b-versatile` | `qwen/qwen3-32b` |

### STT

| Rango | Modelo |
|-------|--------|
| Económico / Medio / Top | `whisper-large-v3` |

---

## Combos listos para copiar (OpenRouter)

### Económico — pruebas y LOW

```text
Chat:           openai/gpt-4o-mini
Respaldo:       google/gemma-3-27b-it
Auditor:        openai/gpt-4o-mini
Top MDD HIGH:   (vacío o google/gemini-2.5-flash)
Embeddings:     openai/text-embedding-3-small
Visión:         openai/gpt-4o-mini
```

### Medio — producción recomendada

```text
Chat:           anthropic/claude-sonnet-4
Respaldo:       openai/gpt-4o-mini
Auditor:        openai/gpt-4o-mini
Top MDD HIGH:   anthropic/claude-sonnet-4
Embeddings:     openai/text-embedding-3-small
Visión:         openai/gpt-4o
```

### Top — MDD HIGH y entregables críticos

```text
Chat:           anthropic/claude-sonnet-4
Respaldo:       openai/gpt-4o
Auditor:        openai/gpt-4o
Top MDD HIGH:   anthropic/claude-opus-4
Embeddings:     openai/text-embedding-3-small
Visión:         openai/gpt-4o
```

---

## Más detalle por fase

- **Tasks (planner, redactor, auditor):** ver también `docs/TASKS-OPENROUTER-MODELS.md` en el repositorio.
- **Coste referencia MDD HIGH:** el formulario calcula MXN con ~15 entidades; escala con entidades/pantallas/endpoints del proyecto.
- **Instancia activa:** solo la instancia marcada como **Activa** alimenta el grafo MDD, chat y generación en background.

---

## Checklist antes de guardar

1. ¿Separaste **chat** y **auditor/planner** en HIGH?
2. ¿El **top MDD HIGH** es ≥ calidad que el chat si usas pipeline dividido?
3. ¿Los **embeddings** mantienen la misma dimensión que proyectos ya indexados?
4. ¿Probaste un mensaje con **imagen** si configuraste visión?
5. ¿Los slugs existen en tu proveedor hoy (OpenRouter cambia catálogo con frecuencia)?
