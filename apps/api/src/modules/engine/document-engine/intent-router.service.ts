import {
  type DocumentEditIntent,
  type DocumentEditRequest,
  type IntentClassification,
  type PatchTarget,
} from "@theforge/shared-types/document-ast";

/**
 * RFC-001 §3.2: IntentRouter — Clasificación de intenciones de edición
 *
 * Dada una instrucción de usuario en lenguaje natural, clasifica la intención
 * para ruteo al agente correcto (ModelArchitect, Orator, Carpenter, Joker, Parrot, SupremeLeader).
 *
 * En la implementación conversacional (LLM call) se enviará el prompt del clasificador
 * y se parseará su respuesta; en modo offline/test usamos reglas heurísticas simples.
 *
 * Responsabilidades:
 *   - Clasificar primary intent + secondary intents
 *   - Determinar impact level (single_entity, multi_entity, section_level, document_level)
 *   - Marcar si requiere confirmación humana (destructivo / high-impact)
 *   - Generar PatchTarget si es posible (por nombre de entidad/field mencionado)
 */

export type AgentType =
  | "ModelArchitect"
  | "Orator"
  | "Carpenter"
  | "Joker"
  | "AgenteIntegradorODE";

export interface RoutedIntent {
  classification: IntentClassification;
  /** Agente extremo al que se delega la ejecución */
  primaryAgent: AgentType;
  /** Agentes secundarios que deben validar/revisar la salida */
  reviewAgents?: AgentType[];
  /** Si la clasificación indica impacto destructivo, debe esperar confirmación */
  requiresConfirmation: boolean;
  /** Fallback for entity name extraction */
  inferredTarget?: PatchTarget;
}

// ─── Keyword-based classifier (offline / tests) ──────────────────────────────

const KEYWORD_MAP: { [key in DocumentEditIntent]?: string[] } = {
  create_new: ["crear", "nuevo document", "from scratch", "genera", "generar mdd"],
  update_entity: ["actualizar entidad", "modificar tabla", "cambiar campo en", "editar modelo"],
  add_entity: ["añadir entidad", "nueva tabla", "agregar modelo", "nueva entidad"],
  delete_entity: ["eliminar entidad", "borrar tabla", "quitar modelo", "delete entity"],
  restructure: ["restructurar", "reorganizar", "mover sección", "reordenar"],
  refine_description: ["mejorar descripción", "reescribir resumen", "refinar texto", "polish"],
  add_field: ["añadir campo", "nueva columna", "agregar atributo", "nuevo field"],
  remove_field: ["quitar campo", "eliminar columna", "borrar atributo", "remove field"],
  merge_entities: ["fusionar entidades", "merge tables", "combinar modelos", "unir entity"],
  split_entity: ["dividir entidad", "split table", "partir", "separar modelo"],
  reorder_sections: ["reordenar secciones", "cambiar orden", "mover sección"],
  add_section: ["nueva sección", "agregar apartado", "añadir contexto"],
  remove_section: ["eliminar sección", "quitar apartado", "borrar segmento"],
  update_business_rule: ["regla de negocio", "business rule", "restricción"],
};

function classifyByKeywords(instruction: string): DocumentEditIntent {
  const lower = instruction.toLowerCase();
  for (const [intent, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some((k) => lower.includes(k))) {
      return intent as DocumentEditIntent;
    }
  }
  return "unknown";
}

function extractEntityName(instruction: string): string | undefined {
  // Simple heuristic: look for quoted strings or Capitalized nouns near "entidad" / "tabla"
  const quoted = instruction.match(/['""]([A-Za-z_][A-Za-z0-9_]*)['"]"]/);
  if (quoted) return quoted[1];
  const afterEntity = instruction.match(/(?:entidad|tabla|modelo)\s+(?:"""?\s*|[`'"""""])?([A-Z][a-zA-Z0-9_]*)/i);
  if (afterEntity) return afterEntity[1];
  return undefined;
}

function determineImpactLevel(intent: DocumentEditIntent): NonNullable<IntentClassification["impact"]> {
  switch (intent) {
    case "create_new":
    case "restructure":
      return "document_level";
    case "merge_entities":
    case "split_entity":
    case "reorder_sections":
    case "add_section":
    case "remove_section":
      return "section_level";
    case "delete_entity":
    case "add_entity":
    case "update_entity":
      return "multi_entity";
    case "add_field":
    case "remove_field":
    case "refine_description":
    case "update_business_rule":
      return "single_entity";
    case "unknown":
      return "none";
    default:
      return "single_entity";
  }
}

function determineAgent(intent: DocumentEditIntent): AgentType {
  switch (intent) {
    case "create_new":
    case "add_entity":
    case "merge_entities":
    case "split_entity":
      return "ModelArchitect";
    case "refine_description":
    case "add_section":
    case "restructure":
      return "Orator";
    case "add_field":
    case "remove_field":
    case "update_business_rule":
    case "reorder_sections":
      return "Carpenter";
    case "delete_entity":
    case "remove_section":
      return "AgenteIntegradorODE"; // High-impact destructive; Supreme leader + safety
    case "update_entity":
      return "ModelArchitect"; // Default to architect for entity modifications
    case "unknown":
      return "AgenteIntegradorODE";
  }
}

function computeConfidence(intent: DocumentEditIntent): number {
  return intent === "unknown" ? 0.3 : 0.75;
}

function requiresConfirmation(intent: DocumentEditIntent): boolean {
  return ["delete_entity", "remove_section", "merge_entities", "split_entity", "restructure"].includes(intent);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Classify a user instruction into a structured intent (heuristic offline).
 * For production, wrap an LLM call around this and extract <intent> blocks.
 */
export function classifyEditIntent(
  instruction: string,
): { classification: IntentClassification; targetHint?: PatchTarget } {
  const primary = classifyByKeywords(instruction);
  const confidence = computeConfidence(primary);
  const impact = determineImpactLevel(primary);
  const entityName = extractEntityName(instruction);

  const classification: IntentClassification = {
    primary,
    secondary: [],
    confidence,
    reasoning: `Keyword-match heuristic classified as "${primary}" with ${(confidence * 100).toFixed(0)}% confidence.`,
    requiresConfirmation: requiresConfirmation(primary),
    impact,
    primaryTarget: entityName
      ? { entityId: entityName, fieldId: undefined, sectionId: undefined, sectionType: undefined }
      : undefined,
  };

  return {
    classification,
    targetHint: classification.primaryTarget,
  };
}

/**
 * Route intent to agent assignment.
 */
export function routeIntent(classification: IntentClassification): RoutedIntent {
  const primaryAgent = determineAgent(classification.primary);
  const reviewAgents: AgentType[] = [];

  if (classification.impact === "document_level" || classification.impact === "section_level") {
    reviewAgents.push("Orator"); // Content review for large-scale changes
  }
  if (classification.requiresConfirmation) {
    reviewAgents.push("AgenteIntegradorODE"); // Safety check for destructive ops
  }

  return {
    classification,
    primaryAgent,
    reviewAgents: reviewAgents.length ? reviewAgents : undefined,
    requiresConfirmation: classification.requiresConfirmation,
    inferredTarget: classification.primaryTarget,
  };
}

/**
 * Given a full DocumentEditRequest (with currentAst + instruction), classify + route.
 */
export function classifyAndRouteEditRequest(request: DocumentEditRequest): RoutedIntent {
  const { classification, targetHint } = classifyEditIntent(request.instruction);
  const routed = routeIntent(classification);
  if (targetHint && !routed.inferredTarget) routed.inferredTarget = targetHint;
  return routed;
}
