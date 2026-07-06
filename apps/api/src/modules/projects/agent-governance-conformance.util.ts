import type { AgentGovernanceScaffold, ConformanceResult } from "@theforge/shared-types";
import type { SuggestAgentGovernanceInput } from "../ai/utils/suggest-agent-governance-artifacts.js";
import { suggestAgentGovernanceArtifacts } from "../ai/utils/suggest-agent-governance-artifacts.js";

const RULE_PATH_HINTS: Array<{ id: string; pathSuffix: string; when: (input: SuggestAgentGovernanceInput) => boolean }> =
  [
    {
      id: "api-contracts",
      pathSuffix: "rules/api-contracts.mdc",
      when: (i) => !!i.apiContractsMarkdown?.trim(),
    },
    {
      id: "ui-pantallas",
      pathSuffix: "rules/ui-pantallas.mdc",
      when: (i) => !!i.uiScreensMarkdown?.trim(),
    },
    {
      id: "security-auth",
      pathSuffix: "rules/security-auth.mdc",
      when: (i) => /jwt|oauth|auth|bcrypt|passport/i.test(i.mddMarkdown ?? ""),
    },
  ];

/**
 * Conformance ligera gobernania ↔ MDD/entregables: rules/skills sugeridas presentes en el scaffold.
 */
export function checkAgentGovernanceVsMdd(
  scaffold: AgentGovernanceScaffold,
  input: SuggestAgentGovernanceInput,
): ConformanceResult {
  const gaps: string[] = [];
  const paths = new Set(scaffold.files.map((f) => f.path.replace(/\\/g, "/")));
  const suggestions = suggestAgentGovernanceArtifacts(input);

  for (const rule of suggestions.suggestedRules) {
    const normalized = rule.path.replace(/\\/g, "/");
    if (!paths.has(normalized)) {
      gaps.push(`Rule sugerida ausente en scaffold: ${normalized}`);
    }
  }

  for (const { id, pathSuffix, when } of RULE_PATH_HINTS) {
    if (!when(input)) continue;
    const hasRule = [...paths].some((p) => p.endsWith(pathSuffix));
    if (!hasRule) {
      gaps.push(
        `Entregable presente (${id}) pero falta rule alineada (*${pathSuffix}) en gobernanza`,
      );
    }
  }

  if (!paths.has("PROMPT-INICIAL.md")) {
    gaps.push("Falta PROMPT-INICIAL.md (sesión 0 paste-ready)");
  }
  if (!paths.has("IMPLEMENT.md") && !paths.has("docs/agent-governance/IMPLEMENT.md")) {
    gaps.push("Falta IMPLEMENT.md en el handoff de gobernania");
  }

  const agentsMd = scaffold.files.find((f) => f.path === "AGENTS.md")?.content ?? "";
  if (!agentsMd.includes("Documentos SDD (layout dual)")) {
    gaps.push("AGENTS.md sin sección canónica «Documentos SDD (layout dual)»");
  }

  return { ok: gaps.length === 0, gaps };
}
