import {
  formatDocumentPathMapTable,
  formatDocumentPathMapTableStatic,
  GOVERNANCE_INSTALL_TARGETS_PREFIX,
  GOVERNANCE_TARGET_LABELS,
  GOVERNANCE_TARGETS_ORDER,
  installTargetBundlePrefix,
} from "@theforge/shared-types";

export function defaultInstallMapTableRows(): string {
  return (
    "| `docs/agent-governance/rules/*.mdc` | `.cursor/rules/*.mdc` |\n" +
    "| `docs/agent-governance/skills/*/SKILL.md` | `.cursor/skills/*/SKILL.md` |\n" +
    "| `docs/agent-governance/references/*` | `.cursor/references/*` |\n" +
    "| `docs/agent-governance/agents/*` | `.cursor/agents/*` |\n" +
    "| `docs/agent-governance/commands/*` | `.cursor/commands/*` |\n" +
    "| `docs/agent-governance/mcp.json.example` | `.cursor/mcp.json` |\n"
  );
}

export function defaultDocumentPathMapTable(featureDir?: string): string {
  if (featureDir?.trim()) {
    return formatDocumentPathMapTable(featureDir.trim());
  }
  return formatDocumentPathMapTableStatic();
}

export function replaceFeatureDirPlaceholders(content: string, featureDir: string): string {
  return content
    .replace(/\{featureDir\}/g, featureDir)
    .replace(/specs\/NNN-slug/g, featureDir);
}
export function defaultMultiTargetInstallTableRows(): string {
  const rows: string[] = [
    "| Target | Script | Destino repo |",
    "|--------|--------|--------------|",
  ];
  for (const target of GOVERNANCE_TARGETS_ORDER) {
    if (target === "codex") {
      rows.push(`| ${GOVERNANCE_TARGET_LABELS[target]} | _(solo prompt)_ | \`AGENTS.md\` + SSOT |`);
      continue;
    }
    const script =
      target === "cursor"
        ? "install-governance-cursor.sh"
        : `install-governance-${target}.sh`;
    const dest =
      target === "cursor"
        ? "`.cursor/`"
        : target === "antigravity"
          ? "`.agents/skills/`"
          : target === "claude-code"
            ? "`.claude/`"
            : target === "github-copilot"
              ? "`.github/instructions/`"
              : target === "windsurf"
                ? "`.devin/`"
                : target === "openhands"
                  ? "`.openhands/`"
                  : installTargetBundlePrefix(target);
    rows.push(`| ${GOVERNANCE_TARGET_LABELS[target]} | \`scripts/${script}\` | ${dest} |`);
  }
  rows.push(
    "",
    "El ZIP incluye carpetas pre-mapeadas bajo `" +
      GOVERNANCE_INSTALL_TARGETS_PREFIX +
      "{target}/` (visibles en Finder).",
  );
  return rows.join("\n");
}
