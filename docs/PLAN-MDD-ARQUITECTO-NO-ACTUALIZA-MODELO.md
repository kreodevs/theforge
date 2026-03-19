# Plan: Arquitecto no actualiza §3 Modelo de Datos (y MDD no refleja cambios)

Revisión profunda a partir de la conversación del usuario (modelo de datos con aplicaciones, roles por aplicación, permisos) y de los cuadernos NotebookLM: _Arquitectura de Prompts y Patrones_, _Specification-Driven Development and the Evolution of AI Engineering_, _Architecting Agentic Systems: Frameworks, Patterns, and Advanced Workflows_.

**Objetivo:** Documentar causas raíz y plan de cambios. **Estado:** Implementado (P0–P4).

---

## 1. Síntoma

- El usuario pide explícitamente: "modificar el modelo de datos, roles a nivel de aplicación, permisos basados en roles por aplicación".
- Tras aprobar el plan ("sí"), el pipeline ejecuta Clarifier → Software Architect → … → Auditor.
- El MDD final **no** muestra cambios en ## 3. Modelo de Datos ni en el diagrama ER (sigue users/sessions sin aplicaciones ni roles por aplicación).

En logs se ve:

- `[MDD:SoftwareArchitect] ok mddDraftLen=10467` (Arquitecto devuelve draft más corto).
- `[MDD:Security] parse estructurado falló, fallback desde markdown` y `ok seguridad merged mddDraftLen=11373`.
- `[MDD:DiagramInjector] output len=11343` y el Auditor recibe ese draft.

Es decir: el documento **crece** después del Arquitecto (10467 → 11373), lo que indica que un nodo posterior está **reemplazando** el draft del Arquitecto por otro construido desde un estado donde §3 es la **versión antigua**.

---

## 2. Causas raíz identificadas

### 2.1 Sobrescritura de §3 por Security/Integration (principal)

**Mecanismo actual:**

1. Software Architect devuelve **solo markdown** (no JSON estructurado). El código extrae §3 del markdown, parsea con `parseModeloDatosFromSection3Markdown()` y, si hay `sql`, hace `mergeMddStructured(..., slice, ...)` y devuelve `{ mddStructured: merged, mddDraft }`.
2. Si el parse de §3 **falla** (p. ej. el LLM no pone ```sql o CREATE TABLE, o usa otro formato), no se actualiza `mddStructured`y se devuelve solo`{ mddDraft }`. Entonces `state.mddStructured` sigue con el **modelo de datos antiguo**.
3. Security (e Integration) hacen:
   - `merged = mergeMddStructured(state.mddStructured, slice, state.mddDraft)`
   - `mddDraft = mddStructuredToMarkdown(merged)`
4. `mergeMddStructured` con `draft` hace `base = hydrateStructuredFromDraft(prev, draft)`. `hydrateStructuredFromDraft` **solo** rellena §1 (Contexto) y §2 (Arquitectura) desde el draft; **no** extrae ni rellena §3 ni §4.
5. El `slice` de Security solo trae `seguridad`; no trae `modeloDatos`. Por tanto `out.modeloDatos = base.modeloDatos` = modelo antiguo que venía en `prev`.
6. `mddStructuredToMarkdown(merged)` genera el documento **completo** desde `merged`, incluyendo §3 desde `merged.modeloDatos` = **antiguo**. Así se **pisa** el §3 correcto que el Arquitecto había dejado en `mddDraft`.

**Conclusión:** Cualquier nodo que haga "merge structured + toMarkdown" y no inyecte §3/§4 desde el draft actual puede reintroducir un §3/§4 obsoletos si `mddStructured` no se actualizó (por parse fallido o porque el Arquitecto solo devolvió markdown y el parse fue estricto).

### 2.2 Directiva diluida (planUserIntent)

Al crear `pendingPlanApproval`, se setea `planUserIntent: getLastSubstantiveUserMessage(state)`. Esa función devuelve **un solo** bloque: el último mensaje sustancial que coincida con `DESIGN_REQUIREMENT_REGEX`, o el último sustancial como fallback.

En la conversación del usuario, el **último** mensaje antes de "¿Ejecutar este plan?" fue algo como "para el back usaré nestjs y para el front react + vite + tailwindcss + shadcn". Ese mensaje no contiene "modelo de datos" ni "roles por aplicación"; los requisitos de modelo estaban en mensajes **anteriores**. Por tanto `planUserIntent` (y luego `acceptedProposalDirective`) puede quedar solo con "nestjs, react, vite..." y **perder** "roles a nivel de aplicación, permisos por aplicación". El Arquitecto recibe una directiva que no menciona el modelo de datos.

**Conclusión:** La directiva que llega al Arquitecto puede ser solo el último mensaje (stack tecnológico) y no la intención completa del usuario (incluyendo modelo/roles).

### 2.3 Parse estricto de §3 (markdown → structured)

`parseModeloDatosFromSection3Markdown` exige:

- Bloque ```sql con contenido, o bien CREATE TABLE en el texto.
- Si no, devuelve `null`.

Si el LLM escribe §3 con otro formato (p. ej. tablas en texto, o SQL sin bloques bien cerrados), el Arquitecto puede estar **sí** actualizando el markdown (`mddDraft`), pero el código no actualiza `mddStructured`. Luego Security/Integration, al reconstruir desde structured, reintroducen la §3 vieja.

### 2.4 Architect Critic no detecta el gap

En logs: `[MDD:ArchitectCritic] parse critic output failed, assuming ok`. Si el Critic devuelve texto que no parsea como `{ verdict, gaps }`, se asume "ok" y no hay reintento al Arquitecto. Aunque el Critic pudiera haber detectado que faltan "aplicaciones" y "roles por aplicación", el fallo de parse impide usar ese feedback.

---

## 3. Alineación con cuadernos (qué reforzar)

- **Specification-Driven:** La Constitución (MDD) debe reflejar la especificación (directiva del usuario). Hoy la directiva puede estar incompleta y/o el documento final se sobrescribe desde un estado desactualizado.
- **Architecting Agentic / Plan-then-Execute:** El "plan" incluye un goal por paso; el Executor inyecta `currentStepGoal`. Si la **directiva** que alimenta ese goal es solo el último mensaje, el plan no está alineado con la intención completa.
- **Reflection:** El Critic debería detectar gaps en §3/§4; si su salida no es machine-readable, el bucle de reflexión se corta ("assuming ok").
- **Chain (waterfall):** Cada agente debe preservar las secciones que no le competen. Hoy Security/Integration, al reconstruir el documento desde `mddStructured`, reescriben §3/§4 aunque no sean su responsabilidad.

---

## 4. Plan de cambios (orden sugerido)

### 4.1 Evitar sobrescritura de §3/§4 por Security e Integration (crítico)

**Objetivo:** Que Security e Integration **no** reemplacen §3 ni §4 cuando solo aportan §6 o §7.

**Opciones:**

- **A) Merge por sección en el draft (recomendada):** En lugar de `merged = mergeMddStructured(..., slice, draft)` y `mddDraft = mddStructuredToMarkdown(merged)`:

  - Security: extraer §6 del output del LLM; reemplazar **solo** la sección "## 6. Seguridad" en `state.mddDraft` por el nuevo contenido; devolver ese draft como `mddDraft` (y opcionalmente actualizar `mddStructured.seguridad` para consistencia).
  - Integration: igual con §7.
  - Así §1–§5 del draft entrante (el que salió del Arquitecto + Formatter) se preservan siempre.

- **B) Hidratar §3 y §4 desde el draft en merge:** En `mergeMddStructured`, cuando se pasa `draft`, hacer que `hydrateStructuredFromDraft` (o una variante) también extraiga §3 y §4 del draft y rellene `base.modeloDatos` y `base.contratosApi` si no están en `slice`. Así la "base" ya lleva el §3/§4 actual del draft y no se pisan.

La opción **A** es más defensiva: los nodos que solo tocan una sección no reconstruyen el documento entero desde structured.

**Archivos:** `mdd-security.node.ts`, `mdd-integration.node.ts`; opcionalmente `mdd-merge-structured.ts` o nuevo helper `replaceSectionInDraft` en `mdd-sanitize.ts`.

### 4.2 Directiva completa para el plan (planUserIntent / acceptedProposalDirective)

**Objetivo:** Que la directiva que se fija al aprobar el plan (y que reciben el Arquitecto y el Critic) incluya **todos** los requisitos de diseño relevantes de la conversación, no solo el último mensaje.

**Cambios posibles:**

- **Acumular intención:** En lugar de `planUserIntent: getLastSubstantiveUserMessage(state)`, construir una "intención de plan" que concatene:
  - Los últimos N bloques de `userInputAccumulated` que contengan `DESIGN_REQUIREMENT_REGEX` o que sean sustanciales (p. ej. 2–3 bloques), o
  - Un resumen explícito: "Requisitos del usuario para este plan: [lista de bloques con requisitos de diseño]".
- **Incluir clarifiedScope en la directiva:** Si hay `clarifiedScope`, añadir un fragmento (ej. primeros 500 chars) a la directiva para que el Arquitecto vea alcance + roles por aplicación en un solo bloque.

**Archivos:** `mdd-manager.node.ts` (donde se setea `planUserIntent`), `mdd-user-brief.ts` (nueva función tipo `getPlanDirective(state)` que agregue varios bloques o clarifiedScope).

### 4.3 Robustecer extracción de §3 a structured (Arquitecto)

**Objetivo:** Reducir la probabilidad de que el Arquitecto actualice solo `mddDraft` y no `mddStructured`.

- **Parse más tolerante:** En `parseModeloDatosFromSection3Markdown`, si no hay bloque ```sql pero hay CREATE TABLE en el cuerpo de §3, extraer SQL de la sección (regex o heurística) y rellenar `modeloDatos`.
- **Siempre actualizar structured cuando se actualice el draft:** Tras generar `mddDraft`, si hay sección 3 en el markdown (p. ej. `extractSection3Body(mddDraft)` no nulo), intentar siempre rellenar `modeloDatos` (aunque sea con sql mínimo o diagrama vacío) y hacer merge en `mddStructured`, para que nodos posteriores no recuperen un §3 viejo desde `state.mddStructured`.

**Archivos:** `mdd-sanitize.ts` (`parseModeloDatosFromSection3Markdown`, `extractSection3Body`), `mdd-software-architect.node.ts` (bloque que hace merge de section3/4/5 a structured).

### 4.4 Architect Critic: salida más robusta

**Objetivo:** Evitar "parse critic output failed, assuming ok" para que un verdict "gap" con feedback llegue al reintento del Arquitecto.

- Pedir al Critic salida en un formato más fácil de parsear (ej. JSON en bloque ```json obligatorio, o líneas fijas `VERDICT: ok|gap`, `GAPS: ...`).
- Si el parse falla, no asumir "ok"; opciones: (1) tratar como "gap" con feedback genérico "No se pudo verificar §3/§4; revisa que la directiva esté aplicada", o (2) reintentar una vez con prompt simplificado.

**Archivos:** `architect-critic-prompt.md`, `mdd-architect-critic.node.ts`.

### 4.5 (Opcional) Plan explícito con "objetivo de modelo de datos"

Si el Manager detecta que la conversación incluye requisitos de modelo (p. ej. `AFFECTS_MODEL_REGEX` o `DESIGN_REQUIREMENT_REGEX` en los bloques recientes), podría añadir al paso `software_architect` del plan un `goal` explícito tipo: "Actualizar §3 Modelo de Datos y §4 Contratos con: [resumen de requisitos de modelo/roles]". Así `currentStepGoal` lleva el mandato de modelo incluso si la directiva general se diluye.

**Archivos:** `mdd-manager.node.ts` (`buildMddPlan`, `goalForStep`), posiblemente `mdd-user-brief.ts`.

---

## 5. Priorización e implementación

| Prioridad | Cambio                                                        | Estado                                                                                                                                                                      |
| --------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | 4.1 Evitar sobrescritura §3/§4 (Security/Integration)         | Hecho: `replaceSection6Or7InDraft`, `seguridadItemsToSection6Markdown`, `integracionToSection7Markdown`; Security e Integration reemplazan solo §6/§7 en el draft entrante. |
| P1        | 4.2 Directiva completa (planUserIntent)                       | Hecho: `getPlanDirective(state)` agrega varios bloques + clarifiedScope; Manager usa para `planUserIntent` y pasa a `buildMddPlan`.                                         |
| P2        | 4.3 Extracción §3 más robusta + siempre actualizar structured | Hecho: `parseModeloDatosFromSection3Markdown` con fallback; SA siempre hace merge de §3/§4/§5 a `mddStructured` cuando hay slice.                                           |
| P3        | 4.4 Critic output robusto                                     | Hecho: prompt pide JSON en bloque \`\`\`json; parse fallido → gap con feedback genérico (un reintento).                                                                     |
| P4        | 4.5 Goal explícito de modelo en el plan                       | Hecho: `goalForStep("software_architect")` con `MODEL_REQUIREMENT_REGEX`; `buildMddPlan(..., planDirective)` usa `briefForGoal`.                                            |

---

## 6. Referencias

- Cuadernos NotebookLM: _Arquitectura de Prompts y Patrones_, _Specification-Driven Development and the Evolution of AI Engineering_, _Architecting Agentic Systems: Frameworks, Patterns, and Advanced Workflows_.
- Repo: `docs/MDD-PATRONES-FLUJO.md`, `docs/archive/plan-mdd-planner-executor.md`, `docs/ENTREGABLES-SDD-VALIDACION.md`.
- Código: `apps/api/src/modules/ai-analysis/nodes/mdd-software-architect.node.ts`, `mdd-security.node.ts`, `mdd-integration.node.ts`, `utils/mdd-merge-structured.ts`, `utils/mdd-sanitize.ts` (`hydrateStructuredFromDraft`, `parseModeloDatosFromSection3Markdown`), `utils/mdd-user-brief.ts`, `mdd-manager.node.ts`.
