import { z } from "zod";
import {
  GOVERNANCE_DOCS_PREFIX,
  type AgentGovernanceInstallEntry,
} from "./agent-governance.js";

/** Prefijo visible en ZIP para bundles pre-mapeados por IDE (sin dotfiles ocultos). */
export const GOVERNANCE_INSTALL_TARGETS_PREFIX = "install-targets/";

/** Targets soportados en export multi-IDE (fase 1). */
export const governanceTargetSchema = z.enum([
  "cursor",
  "antigravity",
  "claude-code",
  "github-copilot",
  "windsurf",
  "openhands",
  "codex",
  "hermes",
]);

export type GovernanceTarget = z.infer<typeof governanceTargetSchema>;

/** Orden estable para UI, MANIFEST e índice PROMPT-INICIAL. */
export const GOVERNANCE_TARGETS_ORDER = [
  "cursor",
  "antigravity",
  "claude-code",
  "github-copilot",
  "windsurf",
  "openhands",
  "codex",
] as const satisfies readonly GovernanceTarget[];

/** Targets con carpeta `install-targets/{target}/` en el ZIP. */
export const GOVERNANCE_TARGETS_WITH_INSTALL_BUNDLE = GOVERNANCE_TARGETS_ORDER.filter(
  (t) => t !== "codex",
) as Exclude<GovernanceTarget, "codex" | "hermes">[];

export const GOVERNANCE_TARGET_LABELS: Record<GovernanceTarget, string> = {
  cursor: "Cursor",
  antigravity: "Antigravity (Gemini)",
  "claude-code": "Claude Code",
  "github-copilot": "GitHub Copilot",
  windsurf: "Windsurf / Devin",
  openhands: "OpenHands",
  codex: "Codex",
  hermes: "Hermes (OpenHands runner)",
};

/** Nombre de archivo PROMPT-INICIAL por target (paste-ready). */
export function promptInicialFilename(target: GovernanceTarget): string {
  return target === "cursor"
    ? "PROMPT-INICIAL.cursor.md"
    : `PROMPT-INICIAL.${target}.md`;
}

/** Prefijo bundle ZIP para un target (`install-targets/cursor/`). */
export function installTargetBundlePrefix(target: GovernanceTarget): string {
  return `${GOVERNANCE_INSTALL_TARGETS_PREFIX}${target}/`;
}

/** Alias de detección MCP / clientName → target canónico. */
export function normalizeGovernanceTargetAlias(raw: string | undefined | null): GovernanceTarget {
  const name = (raw ?? "").trim().toLowerCase();
  if (!name) return "cursor";
  if (name === "hermes") return "hermes";
  if (name === "openhands" || name === "open-hands") return "openhands";
  if (name === "antigravity" || name === "gemini" || name === "google-antigravity") return "antigravity";
  if (name === "claude" || name === "claude-code" || name === "claude_code") return "claude-code";
  if (name === "copilot" || name === "github-copilot" || name === "github_copilot") return "github-copilot";
  if (name === "windsurf" || name === "devin" || name === "cascade") return "windsurf";
  if (name === "codex" || name === "openai-codex") return "codex";
  if (name === "cursor") return "cursor";
  return "cursor";
}

type SubdirKey = "rules" | "skills" | "references" | "agents" | "commands" | "mcp";

const CANONICAL_SUBDIRS: SubdirKey[] = [
  "rules",
  "skills",
  "references",
  "agents",
  "commands",
  "mcp",
];

/** Destino en repo para subcarpeta canónica bajo `docs/agent-governance/`. */
function repoSubdirForTarget(target: GovernanceTarget, subdir: SubdirKey): string | null {
  switch (target) {
    case "cursor":
      if (subdir === "mcp") return ".cursor/mcp.json";
      return `.cursor/${subdir}/`;
    case "antigravity":
      if (subdir === "rules" || subdir === "skills") return ".agents/skills/";
      if (subdir === "references") return ".agents/references/";
      if (subdir === "agents") return ".agents/agents/";
      if (subdir === "commands") return ".agents/commands/";
      if (subdir === "mcp") return ".gemini/config/mcp_config.json";
      return null;
    case "claude-code":
      if (subdir === "mcp") return ".mcp.json";
      if (subdir === "rules") return ".claude/rules/";
      if (subdir === "skills") return ".claude/skills/";
      if (subdir === "references") return ".claude/references/";
      if (subdir === "agents") return ".claude/agents/";
      if (subdir === "commands") return ".claude/commands/";
      return null;
    case "github-copilot":
      if (subdir === "rules") return ".github/instructions/";
      if (subdir === "skills") return ".github/instructions/";
      if (subdir === "references") return ".github/instructions/";
      if (subdir === "mcp") return null;
      return ".github/instructions/";
    case "windsurf":
      if (subdir === "mcp") return null;
      if (subdir === "rules") return ".devin/rules/";
      if (subdir === "skills") return ".devin/skills/";
      return `.devin/${subdir}/`;
    case "openhands":
      if (subdir === "mcp") return ".openhands/mcp.json";
      return `.openhands/${subdir}/`;
    case "hermes":
      if (subdir === "mcp") return ".hermes/mcp.json.example";
      if (subdir === "rules" || subdir === "skills") return ".hermes/skills/";
      return `.hermes/${subdir}/`;
    case "codex":
      return null;
    default:
      return null;
  }
}

function mapCanonicalGovernancePath(source: string, target: GovernanceTarget): string | null {
  if (source === `${GOVERNANCE_DOCS_PREFIX}mcp.json.example`) {
    return repoSubdirForTarget(target, "mcp");
  }
  for (const subdir of CANONICAL_SUBDIRS) {
    if (subdir === "mcp") continue;
    const prefix = `${GOVERNANCE_DOCS_PREFIX}${subdir}/`;
    if (source.startsWith(prefix)) {
      const repoPrefix = repoSubdirForTarget(target, subdir);
      if (!repoPrefix) return null;
      const rest = source.slice(prefix.length);
      if (target === "github-copilot" && subdir === "rules") {
        const base = rest.replace(/\.mdc$/i, "");
        return `.github/instructions/${base}.instructions.md`;
      }
      if (target === "claude-code" && subdir === "rules" && rest.endsWith(".mdc")) {
        return `.claude/rules/${rest.replace(/\.mdc$/i, ".md")}`;
      }
      if (target === "windsurf" && subdir === "rules" && rest.endsWith(".mdc")) {
        return `.devin/rules/${rest.replace(/\.mdc$/i, ".md")}`;
      }
      if ((target === "antigravity" || target === "hermes") && subdir === "rules") {
        const skillName = rest.replace(/\.mdc$/i, "").replace(/\//g, "-");
        return `${repoPrefix}${skillName}/SKILL.md`;
      }
      return `${repoPrefix}${rest}`;
    }
  }
  return null;
}

function mapInstallTargetBundlePath(source: string, target: GovernanceTarget): string | null {
  const prefix = installTargetBundlePrefix(target);
  if (!source.startsWith(prefix)) return null;
  const relative = source.slice(prefix.length);
  if (!relative) return null;

  if (relative === "mcp.json.example" || relative.endsWith("/mcp.json.example")) {
    return repoSubdirForTarget(target, "mcp");
  }

  for (const subdir of CANONICAL_SUBDIRS) {
    if (subdir === "mcp") continue;
    const subPrefix = `${subdir}/`;
    if (relative.startsWith(subPrefix)) {
      const repoPrefix = repoSubdirForTarget(target, subdir);
      if (!repoPrefix) return null;
      const rest = relative.slice(subPrefix.length);
      return `${repoPrefix}${rest}`;
    }
  }

  return null;
}

/**
 * Destino en repo destino para un archivo del ZIP.
 * - Rutas canónicas `docs/agent-governance/` → destino según `target` (default cursor).
 * - Rutas `install-targets/{target}/` → destino real (`.cursor/`, `.agents/`, etc.).
 */
export function governanceInstallTarget(
  source: string,
  target: GovernanceTarget = "cursor",
): string | null {
  const normalized = source.replace(/\\/g, "/").trim();
  const fromBundle = mapInstallTargetBundlePath(normalized, target);
  if (fromBundle) return fromBundle;
  if (normalized.startsWith(installTargetBundlePrefix(target))) {
    return mapInstallTargetBundlePath(normalized, target);
  }
  if (target === "cursor" || normalized.startsWith(GOVERNANCE_DOCS_PREFIX)) {
    return mapCanonicalGovernancePath(normalized, target);
  }
  return null;
}

/** Construye `installMap` para un target a partir de rutas del ZIP. */
export function buildGovernanceInstallMapForTarget(
  zipPaths: string[],
  target: GovernanceTarget,
): AgentGovernanceInstallEntry[] {
  const entries: AgentGovernanceInstallEntry[] = [];
  const bundlePrefix = installTargetBundlePrefix(target);
  for (const source of zipPaths) {
    const normalized = source.replace(/\\/g, "/");
    const isBundlePath = normalized.startsWith(bundlePrefix);
    const isCanonicalForCursor =
      target === "cursor" && normalized.startsWith(GOVERNANCE_DOCS_PREFIX);
    if (!isBundlePath && !isCanonicalForCursor) continue;
    const dest = governanceInstallTarget(normalized, target);
    if (dest) entries.push({ source: normalized, target: dest });
  }
  return entries.sort((a, b) => a.source.localeCompare(b.source));
}

/** `installMaps` multi-target para MANIFEST.json (bundle pre-mapeado). */
export function buildMultiTargetInstallMaps(
  zipPaths: string[],
): Partial<Record<GovernanceTarget, AgentGovernanceInstallEntry[]>> {
  const out: Partial<Record<GovernanceTarget, AgentGovernanceInstallEntry[]>> = {};
  for (const target of GOVERNANCE_TARGETS_WITH_INSTALL_BUNDLE) {
    const map = buildGovernanceInstallMapForTarget(zipPaths, target);
    if (map.length > 0) out[target] = map;
  }
  if (zipPaths.some((p) => p.startsWith(GOVERNANCE_DOCS_PREFIX))) {
    const cursorLegacy = buildGovernanceInstallMapForTarget(zipPaths, "cursor");
    if (cursorLegacy.length > 0) out.cursor = cursorLegacy;
  }
  return out;
}

/** Lista de rutas PROMPT-INICIAL esperadas en export multi-target. */
export function expectedPromptInicialPaths(): string[] {
  return [
    "PROMPT-INICIAL.md",
    ...GOVERNANCE_TARGETS_ORDER.map((t) => promptInicialFilename(t)),
  ];
}
