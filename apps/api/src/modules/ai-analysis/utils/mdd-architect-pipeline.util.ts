import type { MddComplexityLevel } from "../state/mdd-state.schema.js";
import type { MDDStateType } from "../state/index.js";
import { isMddTailParallelEnabled } from "./mdd-tail-parallel.config.js";

/** Alcance del nodo arquitecto en el pipeline MDD. */
export type MddSoftwareArchitectScope = "full" | "stack" | "data_model" | "api_contracts";

export type ArchitectCriticPhase = "after_section3" | "after_full";

/** Pipeline §2→§3→critic→§4 solo en complejidad HIGH (pasada completa). */
export function isHighSplitArchitectPipeline(state: MDDStateType): boolean {
  if (state.mddComplexity !== "HIGH") return false;
  if (state.delegateTarget === "sections" && state.sectionsToRun?.length) return false;
  if (state.executorControlled === true && state.sectionsToRun?.length) return false;
  return true;
}

/** Secuencia de nodos arquitecto tras clarifier (sin format/tail). */
export function getArchitectNodeSequence(complexity?: MddComplexityLevel): readonly string[] {
  if (complexity === "HIGH") {
    return ["stack_architect", "data_model", "architect_critic", "api_contracts"] as const;
  }
  return ["software_architect", "architect_critic"] as const;
}

/** §5 fuera del arquitecto en pasada completa; section5/tail_parallel lo materializa. */
export function shouldDecoupleSection5FromArchitect(
  state: MDDStateType,
  scope: MddSoftwareArchitectScope,
): boolean {
  if (state.sectionsToRun?.length) {
    if (scope !== "full") return true;
    return isMddTailParallelEnabled() && !state.sectionsToRun.includes("section5");
  }
  return true;
}

const SCOPE_BLOCKS: Record<MddSoftwareArchitectScope, string> = {
  full: "",
  stack: `# Arquitecto de Stack (MDD §2)

**Alcance exclusivo:** Redacta **solo ## 2. Arquitectura y Stack**. Copia ## 1. Contexto del borrador sin cambios.
**Prohibido** modificar §3, §4 ni redactar §5 (deja §5 con placeholder \`(Pendiente: paso dedicado Lógica y Edge Cases)\`).
Las decisiones de stack (frontend, backend, ORM, colas, despliegue base) alimentan los agentes de modelo de datos y contratos API.`,
  data_model: `# Experto en Modelo de Datos (MDD §3)

**Alcance exclusivo:** Redacta **solo ## 3. Modelo de Datos** (SQL PostgreSQL, erDiagram Mermaid, TechnicalMetadata si aplica).
Copia ## 1 y ## 2 del borrador. **No** modifiques §4 ni redactes §5 (placeholder de paso dedicado).
Deriva entidades y relaciones de §1, §2 y requisitos explícitos del usuario.`,
  api_contracts: `# Experto en Contratos de API (MDD §4)

**Alcance exclusivo:** Redacta **solo ## 4. Contratos de API** (tabla GFM + endpoints con request/response JSON).
Copia ## 1–§3 del borrador. **No** redactes §5 (placeholder de paso dedicado).
Cada entidad/recurso de §3 que requiera API debe tener operación documentada; alinea rutas con el stack de §2.`,
};

export function architectScopePromptPrefix(scope: MddSoftwareArchitectScope): string {
  return SCOPE_BLOCKS[scope];
}

/** Nodo arquitecto → sección MDD tocada (merge quirúrgico). */
export function architectScopeSectionNumber(scope: MddSoftwareArchitectScope): 2 | 3 | 4 | null {
  if (scope === "stack") return 2;
  if (scope === "data_model") return 3;
  if (scope === "api_contracts") return 4;
  return null;
}

/** Expande software_architect a la secuencia HIGH cuando aplica. */
export function expandArchitectAgentNames(
  agentNames: string[],
  complexity?: MddComplexityLevel,
): string[] {
  if (complexity !== "HIGH" || !agentNames.includes("software_architect")) {
    return agentNames;
  }
  const out: string[] = [];
  for (const name of agentNames) {
    if (name === "software_architect") {
      out.push("stack_architect", "data_model", "architect_critic", "api_contracts");
    } else {
      out.push(name);
    }
  }
  return out;
}

/** Agente(s) para regenerar una sección MDD (2–4) según complejidad. */
export function agentsForArchitectSection(
  section: 2 | 3 | 4,
  complexity?: MddComplexityLevel,
): string[] {
  if (complexity !== "HIGH") return ["software_architect"];
  if (section === 2) return ["stack_architect"];
  if (section === 3) return ["data_model"];
  return ["api_contracts"];
}
