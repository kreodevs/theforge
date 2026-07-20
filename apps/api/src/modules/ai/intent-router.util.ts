import { hasEmbeddedSpecificationBlock } from "@theforge/shared-types";

const TAB_LABELS: Record<string, string> = {
  mdd: "MDD (Master Design Document)",
  benchmark: "Fase 0 — DBGA / Benchmark",
  spec: "Spec",
  brd: "BRD",
  blueprint: "Blueprint",
  "api-contracts": "Contratos de API",
  "logic-flows": "Flujos de lógica",
  architecture: "Arquitectura",
  "use-cases": "Casos de uso",
  "user-stories": "Historias de usuario",
  tasks: "Tareas",
  infra: "Infraestructura",
  phase0: "Fase 0",
  "ux-ui-guide": "Guía UX/UI",
};

/** Recorta mensajes largos (spec pegada) para clasificación LLM sin perder la instrucción del usuario. */
export function summarizeMessageForIntentClassification(message: string, maxLen = 4000): string {
  const m = message.trim();
  if (m.length <= maxLen) return m;

  if (hasEmbeddedSpecificationBlock(m)) {
    const specStart = m.search(/#\s+Especificaci[oó]n|^---\s*$/m);
    const instruction = specStart > 0 ? m.slice(0, specStart).trim() : m.slice(0, 900);
    return (
      `${instruction}\n\n` +
      `[… contenido embebido omitido para clasificación (${m.length} caracteres en total) …]`
    ).slice(0, maxLen);
  }

  return `${m.slice(0, maxLen)}\n\n[… mensaje truncado …]`;
}

export function documentLabelForTab(activeTab?: string): string {
  const tab = activeTab?.trim();
  if (!tab) return "documento activo del Workshop";
  return TAB_LABELS[tab] ?? tab;
}

/** El asistente ofreció aplicar un cambio y espera confirmación del usuario. */
export function assistantOfferedDocumentEdit(assistantText: string): boolean {
  const t = (assistantText ?? "").trim();
  if (t.length < 12) return false;
  if (!/\?/m.test(t)) return false;
  return /\b(?:te parece|quieres que|confirmas|procedo|lo integro|si es as[ií]|puedo integrarlo|puedo aplicarlo|actualizar[eé]\s+el\s+(?:dbga|documento))\b/i.test(
    t,
  );
}

/** Indica si hay contenido de panel para la pestaña (contexto de edición). */
export function hasWorkshopDocumentForTab(
  activeTab: string | undefined,
  contents: {
    mdd?: string | null;
    dbga?: string | null;
    spec?: string | null;
    brd?: string | null;
    blueprint?: string | null;
    phase0Summary?: string | null;
    uxGuide?: string | null;
    architecture?: string | null;
    useCases?: string | null;
    userStories?: string | null;
    apiContracts?: string | null;
    logicFlows?: string | null;
    tasks?: string | null;
    infra?: string | null;
  },
): boolean {
  const tab = (activeTab ?? "mdd").trim();
  const pick = (v?: string | null) => Boolean(v?.trim());
  switch (tab) {
    case "benchmark":
      return pick(contents.dbga);
    case "mdd":
      return pick(contents.mdd);
    case "spec":
      return pick(contents.spec);
    case "brd":
      return pick(contents.brd);
    case "blueprint":
      return pick(contents.blueprint);
    case "phase0":
      return pick(contents.phase0Summary) || pick(contents.dbga);
    case "ux-ui-guide":
      return pick(contents.uxGuide);
    case "architecture":
      return pick(contents.architecture);
    case "use-cases":
      return pick(contents.useCases);
    case "user-stories":
      return pick(contents.userStories);
    case "api-contracts":
      return pick(contents.apiContracts);
    case "logic-flows":
      return pick(contents.logicFlows);
    case "tasks":
      return pick(contents.tasks);
    case "infra":
      return pick(contents.infra);
    default:
      return false;
  }
}
