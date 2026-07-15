import { z } from "zod";

/** Versión de plantillas del entregable agent_governance (MANIFEST.templateVersion). */
export const AGENT_GOVERNANCE_TEMPLATE_VERSION = "2.0.0";

/** Prefijo visible en ZIP (sin carpetas ocultas `.cursor/`). */
export const GOVERNANCE_DOCS_PREFIX = "docs/agent-governance/";

/** Mapeo ZIP → repo destino para instalación en `.cursor/`. */
export const agentGovernanceInstallEntrySchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
});

export type AgentGovernanceInstallEntry = z.infer<typeof agentGovernanceInstallEntrySchema>;

/** Un archivo del scaffold `agent-governance/` (ruta relativa + contenido). */
export const agentGovernanceFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export type AgentGovernanceFile = z.infer<typeof agentGovernanceFileSchema>;

/** Entrada sugerida por el detector (rule o skill). */
export const agentGovernanceSuggestionEntrySchema = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.enum(["rule", "skill"]),
  purpose: z.string().optional(),
  strength: z.enum(["strong", "weak"]).optional(),
});

export type AgentGovernanceSuggestionEntry = z.infer<
  typeof agentGovernanceSuggestionEntrySchema
>;

/** Sugerencias dinámicas derivadas del MDD (detector pre-LLM). */
export const agentGovernanceSuggestionsSchema = z.object({
  archetypes: z.array(z.string()),
  rationale: z.array(z.string()),
  entries: z.array(agentGovernanceSuggestionEntrySchema).optional(),
});

export type AgentGovernanceSuggestionsManifest = z.infer<
  typeof agentGovernanceSuggestionsSchema
>;

/** Metadatos del entregable (persistidos como `MANIFEST.json` en el ZIP). */
export const agentGovernanceManifestSchema = z.object({
  templateVersion: z.string().min(1),
  files: z.array(z.string()),
  generatedAt: z.string().optional(),
  suggestions: agentGovernanceSuggestionsSchema.optional(),
  /** Mapeo cursor/canónico (backward compat). */
  installMap: z.array(agentGovernanceInstallEntrySchema).optional(),
  /** Mapeos por IDE (`install-targets/{target}/` → repo destino). */
  installMaps: z
    .record(z.string(), z.array(agentGovernanceInstallEntrySchema))
    .optional(),
  /** Rutas PROMPT-INICIAL incluidas en el bundle. */
  prompts: z.array(z.string()).optional(),
});

export type AgentGovernanceManifest = z.infer<typeof agentGovernanceManifestSchema>;

/** Payload JSON almacenado en `Project.agentGovernanceContent`. */
export const agentGovernanceScaffoldSchema = z.object({
  manifest: agentGovernanceManifestSchema,
  files: z.array(agentGovernanceFileSchema),
});

export type AgentGovernanceScaffold = z.infer<typeof agentGovernanceScaffoldSchema>;

/**
 * Parsea el campo `agentGovernanceContent` del proyecto (JSON string u objeto ya parseado).
 * Devuelve `null` si no hay scaffold válido.
 */
export function parseAgentGovernanceScaffold(
  raw: string | Record<string, unknown> | null | undefined,
): AgentGovernanceScaffold | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  const parsed = agentGovernanceScaffoldSchema.safeParse(value);
  return parsed.success && parsed.data.files.length > 0 ? parsed.data : null;
}

/** Indica si el proyecto tiene scaffold de gobernanza de agentes generado. */
export function agentGovernanceScaffoldHasContent(
  raw: string | Record<string, unknown> | null | undefined,
): boolean {
  return parseAgentGovernanceScaffold(raw) != null;
}

const LEGACY_DOC_PATHS: Record<string, string> = {
  "docs/agent-onboarding.md": `${GOVERNANCE_DOCS_PREFIX}agent-onboarding.md`,
  "docs/COMO-USAR-GOBERNANZA-IA.md": `${GOVERNANCE_DOCS_PREFIX}COMO-USAR-GOBERNANZA-IA.md`,
};

/**
 * Normaliza rutas del scaffold al layout visible `docs/agent-governance/`.
 * Reescribe scaffolds legacy con `.cursor/` o `docs/*.md` sueltos.
 */
export function migrateGovernancePath(path: string): string {
  let normalized = path.replace(/^agent-governance\//i, "").replace(/^\/+/, "").trim();
  if (normalized.startsWith("cursor/")) {
    normalized = `.${normalized}`;
  }
  const legacyDoc = LEGACY_DOC_PATHS[normalized];
  if (legacyDoc) {
    return legacyDoc;
  }
  if (normalized.startsWith(".cursor/rules/")) {
    return `${GOVERNANCE_DOCS_PREFIX}rules/${normalized.slice(".cursor/rules/".length)}`;
  }
  if (normalized.startsWith(".cursor/skills/")) {
    return `${GOVERNANCE_DOCS_PREFIX}skills/${normalized.slice(".cursor/skills/".length)}`;
  }
  if (normalized.startsWith(".cursor/references/")) {
    return `${GOVERNANCE_DOCS_PREFIX}references/${normalized.slice(".cursor/references/".length)}`;
  }
  if (normalized.startsWith(".cursor/agents/")) {
    return `${GOVERNANCE_DOCS_PREFIX}agents/${normalized.slice(".cursor/agents/".length)}`;
  }
  if (normalized.startsWith(".cursor/commands/")) {
    return `${GOVERNANCE_DOCS_PREFIX}commands/${normalized.slice(".cursor/commands/".length)}`;
  }
  if (normalized === ".cursor/mcp.json" || normalized === "mcp.json.example") {
    return `${GOVERNANCE_DOCS_PREFIX}mcp.json.example`;
  }
  return normalized;
}

/** Indica si la ruta pertenece al árbol legacy `.cursor/` (pre-2.0). */
export function isLegacyCursorGovernancePath(path: string): boolean {
  const migrated = migrateGovernancePath(path);
  return migrated !== path || path.startsWith(".cursor/");
}

export {
  governanceInstallTarget,
  buildGovernanceInstallMapForTarget as buildGovernanceInstallMap,
  buildMultiTargetInstallMaps,
  type GovernanceTarget,
} from "./governance-targets.js";

/** @deprecated Import from `./governance-targets.js` — alias cursor-only. */
export { buildGovernanceInstallMapForTarget } from "./governance-targets.js";
