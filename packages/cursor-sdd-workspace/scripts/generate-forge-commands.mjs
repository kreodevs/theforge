#!/usr/bin/env node
/**
 * Genera comandos forge-* en el repo del plugin (commands/).
 * Ejecutar: npm run build:plugin  (vendor-prompts + este script)
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePluginRoot } from "./forge-plugin-path.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_PREFIX = "prompts/mdd";
const PLUGIN_COMMANDS = join(resolvePluginRoot(), "commands");

/** @param {string} ref */
function promptFile(ref) {
  if (ref.startsWith("(") || ref.includes(".node.ts")) return ref;
  if (ref.includes(".mjs")) return ref;
  const files = ref.match(/[\w-]+\.md/g);
  if (!files) return ref;
  return files.map((f) => `${PROMPTS_PREFIX}/${f}`).join(" + ");
}

/** @param {string} ref @param {string | null} rootPrefix */
function promptDisplay(ref, rootPrefix) {
  const resolved = promptFile(ref);
  if (resolved.startsWith("(") || resolved.includes(".node.ts") || resolved.includes(".mjs")) {
    return resolved;
  }
  return rootPrefix ? `${rootPrefix}${resolved}` : resolved;
}

const agents = [
  {
    id: "forge-clarifier",
    title: "Clarificador",
    forgeNode: "clarifier",
    prompt: "clarifier-prompt.md",
    inputs: [
      "WORKFLOW.yaml (`project.idea`)",
      "paso0/domain-benchmark.md",
      "paso0/decisions.catalog.json",
      "docs/sdd/spec.md",
      "docs/sdd/.pipeline/clarifier-output.md (si existe, refinamiento)",
      "docs/sdd/.pipeline/auditor-report.json (si loop auditor→clarifier)",
    ],
    outputs: [
      "docs/sdd/.pipeline/clarifier-output.md — §1 completo + bloque `<!-- clarifiedScope: ... -->`",
      "Actualizar borrador parcial en mdd.md solo §1 si aún no hay pipeline merge",
    ],
    obligations: [
      "§1 en español: propósito, fronteras DDD, actores, glosario (solo términos del alcance), UAT si aplica",
      "Dueño de catálogo → §1: `mvpCapabilities`, `outOfScope`, `entities` (glosario), `risks` (R-xxx o mitigación)",
      "Cada término de `entities[]` debe aparecer en el glosario §1; cada `outOfScope[]` como viñeta explícita",
      "§2–§7 como placeholders de una línea en primera pasada",
      "clarifiedScope explícito: entidades, capacidades, D-IDs, instrucciones para arquitectos",
      "Respetar stack declarado en Paso 0; no sustituir por stack «de mercado»",
      "Sin JSON crudo ni [object Object] en §1",
    ],
    next: "`/forge-software-architect` (monolithic) o `/forge-stack-architect` (high_split)",
    agentId: "clarifier",
  },
  {
    id: "forge-software-architect",
    title: "Arquitecto de Software (monolítico)",
    forgeNode: "software_architect",
    prompt: "software-architect-prompt-full.md",
    inputs: [
      "docs/sdd/.pipeline/clarifier-output.md",
      "paso0/domain-benchmark.md",
      "paso0/decisions.catalog.json",
      "docs/sdd/spec.md",
      "prompts/mdd/mdd-constitution-skeleton.md (plugin Forge SDD)",
    ],
    outputs: ["docs/sdd/.pipeline/architect-draft.md — §2, §3, §4"],
    obligations: [
      "§2: stack con «¿Por qué?», Screaming Architecture",
      "§3: CREATE TABLE + TechnicalMetadata + erDiagram en paridad",
      "§4.A: tabla de endpoints + JSON request/response por operación",
      "§4.B solo si Paso 0 nombra integraciones externas",
      "YAGNI: sin entidades/API no citadas en Paso 0 o clarifiedScope",
    ],
    next: "`/forge-architect-critic`",
    agentId: "software_architect",
    skipWhen: "pipeline.mode = high_split",
  },
  {
    id: "forge-stack-architect",
    title: "Arquitecto de Stack (§2)",
    forgeNode: "stack_architect",
    prompt: "software-architect-prompt-stack.md",
    inputs: [
      "docs/sdd/.pipeline/clarifier-output.md",
      "paso0/decisions.catalog.json",
      "docs/sdd/spec.md",
    ],
    outputs: ["docs/sdd/.pipeline/stack-draft.md — solo §2"],
    obligations: [
      "Solo cuerpo de §2 Arquitectura y Stack",
      "Decisiones con justificación; coherencia con D-IDs del catálogo",
      "Reintentar si §2 < 200 chars (máx. 2 intentos en Forge)",
    ],
    next: "`/forge-data-model`",
    agentId: "stack_architect",
    skipWhen: "pipeline.mode = monolithic",
  },
  {
    id: "forge-data-model",
    title: "Arquitecto de Modelo de Datos (§3)",
    forgeNode: "data_model",
    prompt: "software-architect-prompt-data-model.md",
    inputs: [
      "docs/sdd/.pipeline/clarifier-output.md",
      "docs/sdd/.pipeline/stack-draft.md",
      "paso0/decisions.catalog.json",
    ],
    outputs: ["docs/sdd/.pipeline/data-model-draft.md — §3"],
    obligations: [
      "SQL CREATE TABLE válido; TechnicalMetadata por tabla",
      "erDiagram Mermaid alineado (PK/FK sin comas inválidas)",
      "Dueño de `canonicalEntities[]` del catálogo → §3: **CREATE TABLE** por cada entidad",
      "Todas las entidades del glosario §1 materializadas",
    ],
    next: "`/forge-architect-critic`",
    agentId: "data_model",
  },
  {
    id: "forge-architect-critic",
    title: "Critic del Arquitecto",
    forgeNode: "architect_critic",
    prompt: "architect-critic-prompt.md",
    inputs: [
      "docs/sdd/.pipeline/clarifier-output.md (directiva / clarifiedScope)",
      "§3 y §4 de architect-draft o data-model + api-contracts drafts",
    ],
    outputs: [
      "docs/sdd/.pipeline/critic-feedback.json — `{ \"verdict\": \"ok\"|\"gap\", \"gaps\": [] }`",
    ],
    obligations: [
      "Verificar paridad directiva ↔ SQL ↔ ER ↔ §4",
      "Detectar domain-auth-only-skew si BRD tiene ≥3 capacidades no-auth",
      "No inventar requisitos; solo gaps explícitos de la directiva",
    ],
    next:
      "Si gap tablas → `/forge-data-model-patch` o `/forge-data-model`; si ok → `/forge-api-contracts` o `/forge-section5`",
    agentId: "architect_critic",
  },
  {
    id: "forge-data-model-patch",
    title: "Parche de Modelo de Datos",
    forgeNode: "data_model_patch",
    prompt: "software-architect-prompt-data-model.md",
    inputs: [
      "docs/sdd/.pipeline/critic-feedback.json",
      "docs/sdd/.pipeline/data-model-draft.md",
    ],
    outputs: ["docs/sdd/.pipeline/data-model-patch.md — parches §3"],
    obligations: [
      "Solo corregir tablas/columnas señaladas por el critic (gaps «solo tabla»)",
      "Merge mínimo; no reescribir §3 entero",
    ],
    next: "`/forge-architect-critic` (re-evaluación)",
    agentId: "data_model_patch",
    optional: true,
  },
  {
    id: "forge-api-contracts",
    title: "Arquitecto de Contratos API (§4)",
    forgeNode: "api_contracts",
    prompt: "software-architect-prompt-api-contracts.md",
    inputs: [
      "docs/sdd/.pipeline/clarifier-output.md",
      "docs/sdd/.pipeline/data-model-draft.md",
      "docs/sdd/.pipeline/stack-draft.md (si high_split)",
    ],
    outputs: ["docs/sdd/.pipeline/api-contracts-draft.md — §4"],
    obligations: [
      "§4.A obligatoria: tabla resumen + JSON por endpoint",
      "Dueño de `mandatoryApiRouteFamilies[]` → §4.A: cada `pathPattern` documentado",
      "Tipos JSON alineados a columnas §3 (UUID, etc.)",
      "Mín. ~150 chars §4; proyectos grandes: docenas de filas de endpoints",
    ],
    next: "`/forge-section5`",
    agentId: "api_contracts",
  },
  {
    id: "forge-section5",
    title: "Ingeniero §5 Lógica y Edge Cases",
    forgeNode: "section5",
    prompt: "section5-prompt.md",
    inputs: [
      "docs/sdd/.pipeline/clarifier-output.md",
      "§1–§4 consolidados (drafts o mdd-after-architect)",
      "paso0/domain-benchmark.md",
    ],
    outputs: ["docs/sdd/.pipeline/section5-draft.md — §5"],
    obligations: [
      "≥4 reglas BDD/AAA o ≥8 viñetas sustantivas",
      "Dueño de `businessRules[]` → §5: cada **RN-xx** del catálogo con D-IDs",
      "RN-XX → BR-XXX + D-IDs; ≥2 escenarios Gherkin",
      "Cada mutación §4.A con comportamiento/error documentado",
    ],
    next: "`/forge-formatter` (modo after_architect)",
    agentId: "section5",
  },
  {
    id: "forge-formatter",
    title: "Formateador determinista",
    forgeNode: "format_after_architect | format_after_redactor",
    prompt: "mdd-formatter-prompt.md",
    inputs: ["Sidecars del tramo actual (architect / sec-int)", "docs/sdd/mdd.md parcial"],
    outputs: [
      "docs/sdd/.pipeline/mdd-after-architect.md o mdd-after-redactor.md",
      "Normalizar fences, headings, §4.A antes de §4.B",
    ],
    obligations: [
      "Sin LLM destructivo: solo normalización estructural",
      "Promover fences SQL/JSON; corregir headings pegados",
      "No eliminar contenido sustancial",
    ],
    next: "after_architect → `/forge-security-integration`; after_redactor → paralelo consistency+diagram",
    agentId: "format_after_architect",
    note: "Ejecutar dos veces en pipeline completo; marcar el agente correspondiente en WORKFLOW.yaml",
  },
  {
    id: "forge-security-integration",
    title: "Seguridad + Integración (paralelo)",
    forgeNode: "security_integration",
    prompt: "security-architect-prompt.md + integration-engineer-prompt.md",
    inputs: [
      "docs/sdd/.pipeline/mdd-after-architect.md",
      "docs/sdd/.pipeline/clarifier-output.md",
    ],
    outputs: ["docs/sdd/.pipeline/sec-int-draft.md — §6 y §7"],
    obligations: [
      "§6: controles acotados al alcance; schemaRequirements si faltan tablas",
      "§7: 7.1–7.4+ manifest JSON (stack, deployment, security, integration_metadata)",
      "§7 no duplica §6; sizing CPU/memoria en 7.4",
      "Ejecutar §6 y §7 en paralelo (misma pasada)",
    ],
    next: "`/forge-formatter` (modo after_redactor)",
    agentId: "security_integration",
    parallelGroup: "sec_int",
  },
  {
    id: "forge-security",
    title: "Arquitecto de Seguridad (§6)",
    forgeNode: "security",
    prompt: "security-architect-prompt.md",
    inputs: ["docs/sdd/mdd.md o sec-int-draft", "clarifier-output"],
    outputs: ["docs/sdd/.pipeline/security-draft.md — §6"],
    obligations: [
      "Solo §6; subsecciones con ≥3 viñetas reales",
      "Coherencia con §3 (MFA, RBAC, audit)",
      "Usar en delivery gate loop cuando fix_target = security",
    ],
    next: "`/forge-integration` o `/forge-formatter`",
    agentId: "security",
    optional: true,
  },
  {
    id: "forge-integration",
    title: "Ingeniero de Integración (§7)",
    forgeNode: "integration",
    prompt: "integration-engineer-prompt.md",
    inputs: ["docs/sdd/mdd.md", "security-draft si existe"],
    outputs: ["docs/sdd/.pipeline/integration-draft.md — §7"],
    obligations: [
      "Flujos paso a paso si el usuario los describió en Paso 0",
      "Manifest JSON final coherente con §2 (Node version, DB engine)",
      "Loop gate: fix_target = integration",
    ],
    next: "`/forge-formatter` (after_redactor)",
    agentId: "integration",
    optional: true,
  },
  {
    id: "forge-cross-consistency",
    title: "Revisor de Consistencia Cruzada",
    forgeNode: "cross_consistency_checker",
    prompt: "cross-consistency-prompt.md",
    inputs: ["docs/sdd/.pipeline/mdd-after-redactor.md o mdd.md"],
    outputs: [
      "docs/sdd/.pipeline/cross-consistency-patches.json",
      "Aplicar parches find/replace al borrador",
    ],
    obligations: [
      "Parches mínimos (≤8): tablas §3 ↔ §4 ↔ manifest §7",
      "Stack §2 ↔ base_image §7; api_prefix consistente",
      "Responder OK_CONSISTENT si no hay cambios",
    ],
    next: "`/forge-diagram-injector` (paralelo) luego `/forge-auditor`",
    agentId: "cross_consistency_checker",
    parallelGroup: "post_format",
  },
  {
    id: "forge-diagram-injector",
    title: "Inyector de Diagramas",
    forgeNode: "diagram_injector",
    prompt: "(determinístico) skill forge-workflow — erDiagram §3 y flujos §7",
    inputs: ["Borrador post-consistency", "§3 SQL", "§7 infra"],
    outputs: [
      "docs/sdd/.pipeline/diagram-injector.md — sugerencias Mermaid",
      "Completar erDiagram §3 y diagramas de flujo §7 si faltan",
    ],
    obligations: [
      "Solo bloques Mermaid válidos",
      "erDiagram en paridad con CREATE TABLE",
      "Paralelo con cross-consistency (parallel_group: post_format)",
    ],
    next: "`/forge-auditor`",
    agentId: "diagram_injector",
    parallelGroup: "post_format",
  },
  {
    id: "forge-auditor",
    title: "Auditor de Calidad MDD",
    forgeNode: "auditor",
    prompt: "auditor-prompt.md",
    inputs: ["docs/sdd/mdd.md borrador casi final", "paso0 + spec"],
    outputs: [
      "docs/sdd/.pipeline/auditor-report.json",
      "score 0–100, critical_gaps, auditorDecision",
    ],
    obligations: [
      "Umbral intervención < 85 → clarifier; ≥ 85 → done",
      "Ejecutar `npm run validate:paso0-coverage` y penalizar score por cada D-ID MVP/confirmada ausente",
      "Paridad SQL ↔ Mermaid; constitución §1",
      "Una sola pasada en one-shot (auditorRan)",
    ],
    next: "Si gaps → agente dueño; si ok → `/forge-prepare-output`",
    agentId: "auditor",
  },
  {
    id: "forge-prepare-output",
    title: "Preparar salida y delivery gate",
    forgeNode: "prepare_output",
    prompt: "(determinístico) skill forge-workflow — merge sidecars → mdd.md",
    inputs: ["Todos los sidecars en docs/sdd/.pipeline/", "WORKFLOW.yaml pipeline state"],
    outputs: [
      "docs/sdd/mdd.md — documento consolidado final",
      "pipeline.delivery_gate (score, blockers, fix_target)",
    ],
    obligations: [
      "Merge §1–§7 desde sidecars; eliminar placeholders",
      "Inyectar §0 (patrones inmutables) antes de §1; append §10 Registro de cambios tras §9",
      "Ejecutar `npm run validate:paso0-coverage`; **no** marcar `paso0_mdd_coverage` si hay blockers",
      "Asegurar §8 UI/UX y §9 Trazabilidad (plantilla: `paso0/mdd-sections-template.md`)",
      "Evaluar delivery gate (umbral 90, MIN_SECTION_BODY 200 chars, §3 ≥100)",
      "Si falla: marcar fix_target y re-enrutar agente (max 2 iteraciones)",
      "Si delivery gate ok: marcar agente `passed`; **siguiente** `/forge-paso0-coverage-remediation`",
    ],
    next: "`/forge-paso0-coverage-remediation` o re-ejecutar agente indicado por fix_target",
    agentId: "prepare_output",
  },
  {
    id: "forge-paso0-coverage-remediation",
    title: "Remediación cobertura Paso 0",
    forgeNode: "paso0_coverage_remediation",
    prompt: "(determinístico) scripts/remediate-paso0-coverage.mjs",
    inputs: [
      "docs/sdd/mdd.md (post prepare_output)",
      "paso0/decisions.catalog.json",
      "deliverables/paso0-coverage-report.json",
    ],
    outputs: [
      "docs/sdd/mdd.md — parches §0, §1 glosario, §1.7 riesgos, §1.8 D-IDs, §4 familias API, §9/§10",
      "deliverables/paso0-remediation-log.json",
      "deliverables/paso0-coverage-report.json (re-validado)",
    ],
    obligations: [
      "Ejecutar `npm run remediate:paso0-coverage` (loop validate→patch, max 3 iteraciones)",
      "Parches deterministas: §0 patrones, términos §1.5, tabla R-xxx §1.7, D-IDs §1.8, rutas §4.A",
      "**Regenerar §9** tras cada iteración; asegurar §10 changelog",
      "Si quedan blockers no deterministas: **una** pasada LLM semántica por categoría",
      "No marcar `gates.paso0_mdd_coverage` hasta `validate:paso0-coverage` exit 0",
      "Al pasar: `gates.paso0_mdd_coverage.status: passed`, `gates.mdd.status: passed`, `phase: gates`",
    ],
    next: "`/forge-gate`",
    agentId: "paso0_coverage_remediation",
    note: "Post-proceso automático tras prepare_output; Cursor-only",
  },
];

/** @param {string[]} lines @param {string | null} rootPrefix */
function prefixPaths(lines, rootPrefix) {
  if (!rootPrefix) return lines;
  return lines.map((l) => {
    if (l.startsWith("prompts/")) return `${rootPrefix}${l}`;
    if (l.startsWith("docs/") || l.startsWith("paso0/") || l.startsWith("WORKFLOW")) {
      return l.startsWith("WORKFLOW") ? `${rootPrefix}${l}` : `${rootPrefix}${l}`;
    }
    return l;
  });
}

/**
 * @param {typeof agents[number]} agent
 * @param {string | null} rootPrefix
 */
function render(agent, rootPrefix) {
  const opt = agent.optional ? "\n\n> **Opcional:** solo si el critic o delivery gate lo exige.\n" : "";
  const skip = agent.skipWhen ? `\n\n> **Omitir cuando:** ${agent.skipWhen}\n` : "";
  const parallel = agent.parallelGroup
    ? `\n\n**Paralelo:** \`parallel_group: ${agent.parallelGroup}\` — puede ejecutarse junto al otro agente del grupo.\n`
    : "";

  const inputs = prefixPaths(agent.inputs, rootPrefix)
    .map((i) => `- ${i}`)
    .join("\n");
  const outputs = prefixPaths(agent.outputs, rootPrefix)
    .map((o) => `- ${o}`)
    .join("\n");
  const obligations = agent.obligations.map((o) => `- ${o}`).join("\n");
  const promptPath = promptDisplay(agent.prompt, rootPrefix);

  return `# Forge ${agent.title} (pipeline MDD local)

**No usar The Forge API.**${opt}${skip}${parallel}

## Rol

Nodo Forge: \`${agent.forgeNode}\`. Paridad con grafo MDD one-shot.

## Entradas

${inputs}

## Salidas

${outputs}

## Prompt Forge (referencia)

Leer prompt empaquetado en el plugin Forge SDD:

\`${promptPath}\`

Obligaciones clave (resumen; no copiar el prompt completo):

${obligations}

## Actualizar WORKFLOW.yaml

1. \`pipeline.current_agent: ${agent.agentId}\` al iniciar.
2. Marcar agente \`${agent.agentId}\` con \`status: running\` → \`passed\` (o \`failed\` / \`skipped\`).
3. ${agent.note ?? "Avanzar `pipeline.current_agent` al siguiente agente no skipped."}

## Siguiente

${agent.next}
`;
}

/**
 * @param {string | null} rootPrefix
 */
function renderPipeline(rootPrefix) {
  const p = rootPrefix ?? "";
  return `# Forge MDD Pipeline — orquestador completo

**No usar The Forge API.**

Ejecuta el pipeline multi-agente local con paridad al grafo MDD one-shot de The Forge.

## Prerrequisitos

1. \`gates.spec.status: passed\` en \`${p}WORKFLOW.yaml\`
2. Paso 0 sustancial para MDD profundo; demo YAGNI puede quedarse en ~250 líneas
3. \`phase: mdd\` o \`phase: mdd_pipeline\`

## Configuración

Editar \`${p}WORKFLOW.yaml\`:

- \`pipeline.mode\`: \`monolithic\` (LOW/MEDIUM) o \`high_split\` (HIGH)
- Resetear agentes a \`pending\` (o \`skipped\` según rama)
- \`pipeline.current_agent: clarifier\`

## Secuencia (ejecutar en orden)

### Rama monolithic (\`pipeline.mode: monolithic\`)

1. \`/forge-clarifier\`
2. \`/forge-software-architect\`
3. \`/forge-architect-critic\` → (opcional) \`/forge-data-model-patch\`
4. \`/forge-section5\`
5. \`/forge-formatter\` (after_architect)
6. \`/forge-security-integration\`
7. \`/forge-formatter\` (after_redactor)
8. En paralelo: \`/forge-cross-consistency\` + \`/forge-diagram-injector\`
9. \`/forge-auditor\`
10. \`/forge-prepare-output\`
11. \`/forge-paso0-coverage-remediation\`

### Rama high_split (\`pipeline.mode: high_split\`)

1. \`/forge-clarifier\`
2. \`/forge-stack-architect\` → \`/forge-data-model\`
3. \`/forge-architect-critic\` → \`/forge-api-contracts\`
4. \`/forge-section5\`
5. Pasos 5–11 iguales que rama monolithic

## Post-proceso cobertura Paso 0

Tras \`/forge-prepare-output\`, ejecutar **siempre** \`/forge-paso0-coverage-remediation\`.

\`/forge-gate\` re-valida cobertura antes de \`gates.mdd\`.

## Cierre

- \`phase: gates\`
- Sidecars en \`${p}docs/sdd/.pipeline/\`
- Documento final: \`${p}docs/sdd/mdd.md\`

**Validación obligatoria:** \`npm run validate:paso0-coverage\`

**Siguiente:** \`/forge-gate\`
`;
}

const STATIC_PLUGIN = {
  "init-forge.md": `# Init Forge — scaffold SDD

Invoca la skill **\`init-forge\`** para crear un workspace SDD.

Con el **plugin Forge SDD** instalado, los comandos \`/forge-*\` vienen del plugin — el scaffold solo crea artefactos del proyecto.

## Uso en chat

\`\`\`text
/init-forge name="Mi App" idea="Descripción del producto"
\`\`\`

## CLI

\`\`\`bash
npx @theforge/cursor-sdd-workspace init-forge --no-cursor --target . --name "Mi App" --idea "Descripción"
\`\`\`

**Siguiente paso:** \`/forge-paso0\`
`,
  "forge-paso0.md": `# Forge Paso 0 (local)

**No usar The Forge API.** Rutas relativas al workspace del proyecto.

1. Leer \`WORKFLOW.yaml\` y \`paso0/TEMPLATE.md\`.
2. Editar \`paso0/domain-benchmark.md\` con D-IDs y gobierno.
3. Sincronizar \`paso0/decisions.catalog.json\` (\`paso0_decision_catalog\`, version 1).
4. Actualizar \`WORKFLOW.yaml\`: \`phase: paso0\`, \`gates.paso0.status: passed\`.

Siguiente: \`/forge-spec\`.
`,
  "forge-spec.md": readFileSync(join(PLUGIN_COMMANDS, "forge-spec.md"), "utf8"),
  "forge-mdd.md": `# Forge MDD (local, monolítico)

**No usar The Forge API.**

> Para paridad Forge y MDD profundo, usar **\`/forge-mdd-pipeline\`**. Este comando es la vía rápida YAGNI.

## Esqueleto y constitución

- Esqueleto: \`prompts/mdd/mdd-constitution-skeleton.md\` (plugin Forge SDD).
- Constitución: regla \`forge-sdd-constitution\` del plugin.

Completar \`docs/sdd/mdd.md\` — **7 secciones canónicas**, sin inventar dominio.

**Siguiente:** \`/forge-gate\`.
`,
  "forge-gate.md": readFileSync(join(PLUGIN_COMMANDS, "forge-gate.md"), "utf8")
    .replace(
      "detalle en `../../.cursor/skills/forge-workflow/SKILL.md`",
      "detalle en la skill **forge-workflow** del plugin",
    )
    .replace(
      "Antes de evaluar `gates.mdd` o `gates.delivery`, ejecutar desde este paquete:",
      "Antes de evaluar `gates.mdd` o `gates.delivery`, ejecutar desde la raíz del workspace SDD:",
    ),
};

function main() {
  const pluginRoot = resolvePluginRoot();
  const pluginCommands = join(pluginRoot, "commands");
  mkdirSync(pluginCommands, { recursive: true });

  for (const agent of agents) {
    writeFileSync(join(pluginCommands, `${agent.id}.md`), render(agent, null));
  }

  writeFileSync(
    join(pluginCommands, "forge-mdd-pipeline.md"),
    renderPipeline(null),
  );

  for (const [name, content] of Object.entries(STATIC_PLUGIN)) {
    writeFileSync(join(pluginCommands, name), content);
  }

  console.log(
    `Generated ${agents.length} agent commands + ${Object.keys(STATIC_PLUGIN).length} static → ${pluginCommands}`,
  );
}

main();
