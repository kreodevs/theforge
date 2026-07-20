# MDD lean pipeline — nota de migración (Oleada 0–4)

Rama de trabajo original: `feat/mdd-lean-pipeline-model-tiers`  
Estado al **2026-07-16:** oleada 4 completada en esa rama; integración en el monorepo según rama activa (`master` / feature). Base histórica: `origin/master`.

Documento de referencia para el pipeline lean vigente. Oleada 0 fue solo documentación; oleadas 1–4 implementaron producto.

---

## Arquitectura objetivo (resumen)

Pipeline **lean**: cuatro generadores LLM, **Quality Gate**, **Manager delgado**, formatter/diagram deterministas, y `graph_populator` (tier C). El chat Workshop delega regeneración MDD vía jobs de sección; no regenera las siete § en chat.

---

## Contratos de rol

### Generadores (4 LLM, tier B o A según nodo)

| Nodo | Tier | Responsabilidad |
|------|------|-----------------|
| **Clarifier** | B | §1 — contexto, alcance, clarificaciones |
| **Architect** (`software_architect`) | **A** | §2–§5 — SQL, API, diseño de software |
| **Security** | B | §6 — seguridad |
| **Integration** | B | §7 — integraciones |

**Contrato:** cada generador escribe su sección en el estado del grafo; no hay critic ni blackboard intermedio. Security e Integration se enrutan en paralelo (sin nodo fusion `security_integration`).

### Quality Gate (tier B)

**Contrato de salida:**

- `qualityGate.ok === true` cuando `blockers.length === 0`, **o**
- HITL `acknowledgeGaps` (usuario acepta gaps explícitos).

**Sin:** umbrales 85/90, `goto END` por techo de iteración del antiguo delivery gate, ni loop de 3 re-runs del architect.

**Implementación (oleadas posteriores):**

1. Paso determinista (fusiona delivery gate paso 1, auditor gaps, cross-consistency, §3 composition blockers).
2. Paso LLM opcional (modelo B).
3. Resultado `{ ok, blockers, gaps[] }`.

Si hay gaps por sección → enrutar de vuelta al **Manager** (máx. 2 rondas Manager → generador). Si `ok` → **graph_populator**.

### Manager (tier B, delgado)

**Contrato:**

- Orquesta Clarifier, Architect, Security, Integration (no executor de 8 pasos).
- Absorbe responsabilidades de `ask_initial_topic` y `plan_approval`.
- Routing desde gaps del Quality Gate vía `mdd-manager-routing.util`.
- No depende del loop `delivery_gate` ni del auditor/prepare_output legacy.

### Formatter / Diagram (deterministas)

**Contrato:**

- Un solo **Formatter** (determinista; eliminar `llm_formatter`).
- **Diagram** (determinista) tras formatter.
- Salida hacia Quality Gate, no hacia critic ni cross_consistency_checker.

### Chat Workshop (fuera del grafo MDD, tier C/B)

| Intención | Modelo | Comportamiento |
|-----------|--------|----------------|
| explore / chat_only | **C**, perfil chat 8K | Sin document 32K en tab MDD |
| direct_edit, tab ≠ mdd | **B** (temporal) | Edición documento |
| direct_edit, tab mdd | — | Encolar job `section` del pipeline; chat responde con poll |

### graph_populator (tier C)

Tras QG `ok`: ADRs / grafo con modelo ligero (chat tier).

### Legacy Coordinador (tier A)

Usa `architectChatModel`; Quality Gate util compartido con pipeline MDD.

---

## Nodos a eliminar del grafo

- `architect_critic`
- `cross_consistency_checker`
- `llm_formatter`
- `blackboard`
- `mdd-redactor`
- `mdd-frontend-architect`
- Nodo fusion `security_integration` (reemplazado por routing paralelo)
- Loop `delivery_gate` (3 re-runs architect)
- `executor` de 8 pasos
- `plan_approval` / `ask_initial_topic` como nodos separados (absorbidos por Manager)
- Flujo `auditor` + `prepare_output` como gate final (reemplazado por `quality_gate`)

Archivos candidatos a borrado en Oleada 4: nodos muertos sin imports (p. ej. redactor, frontend-architect, critic/blackboard).

---

## Nodos a mantener / introducir

| Nodo | Notas |
|------|--------|
| **Manager** | Delgado; routing QG |
| **Clarifier** | Generador §1 |
| **Architect** | Generador §2–§5, tier A |
| **Security** | Generador §6 |
| **Integration** | Generador §7 |
| **Formatter** | Determinista, único |
| **Diagram** | Determinista |
| **quality_gate** | Nuevo; reemplaza auditor/delivery loop |
| **graph_populator** | Post-QG ok |

**Criterio de job one-shot:** máximo 4 LLM generadores + 0–1 pasada Quality Gate (LLM opcional) por ejecución típica.

---

## Tres tiers de modelo (instancia / UI)

Campos en `ProviderInstance`:

| Campo | Tier | Uso principal |
|-------|------|----------------|
| `chatModel` (existente) | **C** Ligero | Chat explore/mixed, intent router, welcome, graph_populator ADRs |
| `graphChatModel` (nuevo) | **B** Medio | Clarifier, Manager, Security, Integration, Quality Gate, entregables, tasks |
| `architectChatModel` (nuevo) | **A** Potente | `software_architect`, Legacy Coordinador |

**Migración DB:** si `auditorChatModel` tiene valor y `graphChatModel` vacío → copiar a `graphChatModel`. Columna `auditorChatModel` deprecada una release; sin campo en UI.

**Fallback runtime (vacío):** `architectChatModel` → `graphChatModel` → `chatModel`.

**Labels UI (español, alineados con `provider-model-tier-labels.ts`):**

| Tier | Badge | Formulario |
|------|-------|------------|
| **C** (`chatModel`) | **Ligero** | Bajo rendimiento |
| **B** (`graphChatModel`) | **Estándar** | Rendimiento estándar |
| **A** (`architectChatModel`) | **Premium** | Alto rendimiento |

Hints de uso: chat Workshop / intent router (C); generadores §1/§6/§7, Quality Gate, entregables (B); Architect §2–§5 y coordinador legacy (A).

**Chat layer:**

- Tier **C**: intent router, explore 8K
- Tier **B**: generadores medios, QG, entregables
- Tier **A**: architect + coordinador legacy

---

## Mapa de oleadas (recordatorio)

| Oleada | Agentes | Alcance |
|--------|---------|---------|
| 0 | coord-branch | Rama + este doc |
| 1 | A, B, C | Schema modelos, QG util/nodo, intent resolver |
| 2 | D, E | Grafo lean + UI 3 modelos |
| 3 | F, G | Cableado LLM, legacy QG, chat → section job |
| 4 | H | Limpieza, docs, tests, PR | **Completada** |

**Regla merge:** oleada N+1 tras merge/rebase de oleada N en la rama feature.

---

## Criterios de aceptación (checklist)

Oleada 4 completada en `feat/mdd-lean-pipeline-model-tiers`:

- [x] Grafo compilado **sin**: critic, cross_consistency_checker, llm_formatter, blackboard, delivery_gate loop
- [x] Job MDD one-shot: **máx.** 4 LLM generadores + 0–1 Quality Gate por pasada
- [x] `direct_edit` en tab **mdd** no invoca perfil `document` 32K en chat
- [x] UI instancia: **3 campos** modelo con hints tier C/B/A
- [x] `auditorChatModel` migrado a `graphChatModel` en DB existente
- [x] Tests verdes: QG util, intent resolver, provider form, manager routing, casos delivery gate portados
- [x] Nodos muertos eliminados (redactor, frontend-architect, critic, blackboard, cross_consistency, llm_formatter, security_integration, executor, plan_approval, ask_initial_topic, prepare_output)

---

## Riesgos (mitigación breve)

| Riesgo | Mitigación |
|--------|------------|
| SSE/web esperan eventos `auditor` / `deliveryGate` | Alias en payload SSE (`qualityGate` + campos legacy 1 release) |
| BYOK sin nuevos campos | Cadena de fallback chat → graph → architect |
| Chat deja de persistir MDD inline | Delegación section job + poll; mensaje claro en UI |
| Conflictos mdd-graph entre agentes D y F | D estructura grafo; F solo inyecta LLM factories |

---

## Referencia

Plan multi-agente: `mdd_lean_multi-agent_4d0ea151.plan.md` (Cursor plans).

---

*Corpus «The Forge - by Kreo» — NotebookLM sync 2026-07-16 (pnpm). Rutas relativas al monorepo `theforge`.*
