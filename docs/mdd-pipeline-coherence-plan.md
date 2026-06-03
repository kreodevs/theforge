# Plan: Coherencia del Pipeline MDD

## Problema raíz

El documento final que el usuario lee **no es lo que el Auditor certificó**. El pipeline inyecta contenido determinista (`mdd-enrich-uiux-intent.ts`) después de la auditoría, y los agentes reciben señales contradictorias entre sí y con el Project Spec de entrada.

Cadena de responsabilidades (mayor → menor impacto):

```
Project Spec + DBGA (entrada mezclada)
        ↓
   Clarifier — fusiona sin resolver conflictos entre fuentes
        ↓
 Software Architect — rellena "enterprise" por señales mixtas
        ↓
 Security + Integration — mínimos obligatorios inflados
        ↓
   Auditor — valida borrador SIN el post-proceso
        ↓
 prepareMddForOutput() ← AQUÍ se inyecta UI/UX Design Intent
        ↓
   Documento final (nunca certificado)
```

---

## Fase 1 — Desconectar el enriquecedor de UI/UX del MDD constitucional

**Impacto:** elimina la sección más claramente incorrecta (Kanban inventado, contratos `/api/v1/${tabla}`, `status` inexistente).

### 1.1 Hacer el enricher condicional

**Archivo:** `apps/api/src/modules/ai-analysis/utils/mdd-prepare-output.ts` · línea 126

Cambio: `enrichMddWithUiUxDesignIntent(withDiagrams)` → solo ejecutar cuando se llame desde flujos de componentes UI (MCP de Wireframes), nunca al generar el MDD constitucional desde el pipeline MDD.

Opciones:
- A) Añadir parámetro `{ skipUiEnrich?: boolean }` a `prepareMddForOutput` y pasar `skipUiEnrich: true` desde `ai-analysis.service.ts`.
- B) Mover la llamada al enricher fuera de `prepareMddForOutput`, al punto de consumo del Wireframe/MCP.

**Decisión recomendada:** Opción A — cambio mínimo, reversible, no rompe el flujo de Wireframes.

### 1.2 Ajustar el punto de llamada en el servicio

**Archivo:** `apps/api/src/modules/ai-analysis/ai-analysis.service.ts` · líneas 764–768

```typescript
const prepared = prepareMddForOutput({
  mddStructured: lastState?.mddStructured,
  mddDraft: draft,
  skipUiEnrich: true,   // ← añadir
});
```

---

## Fase 2 — Mover el Auditor al final del pipeline (después del post-proceso)

**Impacto:** el score y la decisión de aceptar/rechazar cubren el documento real que el usuario lee.

### 2.1 Reubicar la llamada al Auditor

**Opción actual:** Auditor corre sobre `mddDraft` (pre-`prepareMddForOutput`).  
**Opción propuesta:** Auditor corre sobre el output de `prepareMddForOutput`.

Alternativa más simple: mantener el Auditor donde está pero pasarle la salida de `prepareMddForOutput` como input, no el borrador crudo.

**Archivo a tocar:** `apps/api/src/modules/ai-analysis/nodes/mdd-auditor.node.ts`  
Verificar si el nodo lee `state.mddDraft` directamente; si sí, el fix es que `prepareMddForOutput` se llame antes de la ejecución del auditor o que el auditor lea un campo separado `mddFinal`.

> ⚠️ Dependencia con Fase 1: si se desactiva el enricher para el MDD constitucional, este problema se reduce considerablemente. Evaluar si la Fase 2 sigue siendo necesaria después de la Fase 1.

---

## Fase 3 — Regla de conflicto Spec > MDD en el Clarifier

**Impacto:** elimina alcances contradictorios (dashboard sí/no, SDKs fuera de scope).

**Archivo:** `apps/api/src/modules/ai-analysis/prompts/mdd/clarifier-prompt.md` · línea 30

### Problema actual
El Clarifier usa el Project Spec como "entrada principal para §1" pero no tiene instrucción para resolver qué hacer cuando Spec y DBGA/MDD dicen cosas opuestas.

### Cambio propuesto
Añadir sección explícita **"Regla de prioridad de fuentes"**:

```
Cuando Project Spec y Benchmark (DBGA/MDD) describan el alcance de forma
contradictoria, el Project Spec tiene prioridad absoluta sobre qué está
FUERA de alcance. El DBGA puede ampliar detalles técnicos de lo que está
DENTRO, pero nunca reintroducir algo que el Spec marcó como exclusión.

Si detectas una contradicción, documéntala explícitamente en §1.3 como
"Exclusión validada:" seguida de la fuente (Spec) que la define.
```

### Eliminar ambigüedad YAGNI vs proactividad
Separar en dos reglas claras:
- **Proactividad:** solo para elegir stack entre opciones que están dentro del alcance Spec.
- **YAGNI:** aplica cuando el Spec no menciona algo; no proponer integraciones no descritas.

---

## Fase 4 — Limpiar señales mixtas en el Software Architect

**Impacto:** reduce inflación MVP (gRPC, Kafka, SDKs extra) y huecos §3↔§4.

**Archivo:** `apps/api/src/modules/ai-analysis/prompts/mdd/software-architect-prompt.md`

### 4.1 Segmentar reglas TheForge/Ariadne

Las reglas de FalkorDB/Bitbucket son específicas de proyectos de análisis de código. Actualmente están en el prompt global del Arquitecto y en el Manager.

**Cambio:** mover estas reglas a una sección condicional `[Solo aplicar si isLegacyProject=true o dominio=code-analysis]`. El Manager ya tiene `isLegacyProject` en el estado.

**Archivo adicional:** `apps/api/src/modules/ai-analysis/prompts/mdd/manager-prompt.md` · líneas 173–178  
Mover las reglas de AriadneSpecs a una sección que el Manager solo inyecte cuando corresponda.

### 4.2 Acotar la regla "nunca Pendiente"

La regla actual (`PROACTIVIDAD OBLIGATORIA — nunca dejes secciones vacías`) es útil para evitar placeholders pero empuja al Arquitecto a inventar cuando el Spec no especifica. Cambio propuesto:

```
Nunca dejes secciones vacías SI el Spec o el alcance clarificado lo describe.
Si el Spec no menciona algo, deja una nota "Fuera de alcance per Spec" en lugar
de inventar un estándar de industria.
```

### 4.3 Reforzar el self-check §3↔§4 con regla determinista

Añadir al nodo del Arquitecto (código, no prompt) una verificación post-LLM:
- Cada endpoint en §4 que referencia un campo (ej. `key.value_encrypted`) debe existir en alguna tabla de §3.
- Si no existe → agregar al `auditorFeedback` como gap crítico en vez de dejarlo pasar silencioso.

**Archivo:** `apps/api/src/modules/ai-analysis/nodes/mdd-software-architect.node.ts`  
Existe `[DIAG §4]` y `[DIAG §5]` — extender con verificación cross-reference.

---

## Fase 5 — Calibrar mínimos obligatorios de Security e Integration

**Impacto:** reduce §6/§7 sobredimensionadas (Kafka, Patroni, 3 AZ en MVP).

### 5.1 Security prompt — hacer el mínimo dependiente del alcance

**Archivo:** `apps/api/src/modules/ai-analysis/prompts/mdd/security-architect-prompt.md` · líneas 62–66

Cambio: la tabla `security_events` obligatoria solo si §1 menciona auditoría, compliance o multi-tenant. Añadir condición:

```
Incluye security_events SOLO si §1 describe: auditoría regulatoria, compliance
(SOC2, PCI), multi-tenant con aislamiento, o logging de acceso como requisito.
Si §1 describe un MVP interno, una tabla de logs básica en applications es
suficiente — no infles con tablas enterprise que el equipo no va a mantener.
```

### 5.2 Integration prompt — reducir el mínimo de viñetas

**Archivo:** `apps/api/src/modules/ai-analysis/prompts/mdd/integration-engineer-prompt.md` · línea 9

Cambio: de "4–6 viñetas de contenido real" a "suficientes viñetas para cubrir lo que §1 requiere, mínimo 2". El mínimo fijo de 4–6 fuerza contenido enterprise aunque el Spec no lo pida.

---

## Fase 6 — Extender la rúbrica del Auditor

**Impacto:** el Auditor detecta conflictos de alcance y campos faltantes que hoy aprueba silencioso.

**Archivo:** `apps/api/src/modules/ai-analysis/prompts/mdd/auditor-prompt.md`

### Checks a añadir

| Check nuevo | Descripción |
|---|---|
| Conflicto de alcance | Si §1 tiene una "Exclusión validada" y otra sección la contradice → gap crítico |
| Campos huérfanos §4↔§3 | Endpoint en §4 que usa campo no definido en §3 → gap |
| Tecnologías fuera de Spec | Si §2 incluye tech que el Project Spec marcó como fuera de alcance → gap |

> Estos checks son adicionales al score actual; no cambian el umbral 85.

---

## Orden de ejecución recomendado

| Fase | Esfuerzo | Impacto | Dependencias |
|------|----------|---------|--------------|
| 1 — Desconectar enricher UI/UX | Bajo (código, 2 líneas) | Alto | — |
| 3 — Regla conflicto Spec>MDD Clarifier | Bajo (prompt) | Alto | — |
| 4.1 — Segmentar reglas TheForge/Ariadne | Medio (prompt + código condicional) | Medio | — |
| 4.2 — Acotar "nunca Pendiente" | Bajo (prompt) | Medio | — |
| 5 — Calibrar Security + Integration | Bajo (prompts) | Medio | — |
| 6 — Extender rúbrica Auditor | Medio (prompt) | Medio | 3, 4 |
| 4.3 — Self-check §3↔§4 determinista | Alto (código) | Medio-alto | 4.1, 4.2 |
| 2 — Auditor post-prepareMddForOutput | Alto (pipeline) | Bajo (tras Fase 1) | 1 |

---

## Lo que este plan NO toca (por ahora)

- Design System, pantallas, flujos de Wireframes — el enricher tiene valor ahí.
- `mdd-enrich-uiux-intent.ts` como archivo — no se elimina, solo se desconecta del pipeline MDD constitucional.
- Lógica de complejidad LOW/MEDIUM/HIGH — fuera de scope de este plan.
- Cambios al frontend o al schema de BD.
