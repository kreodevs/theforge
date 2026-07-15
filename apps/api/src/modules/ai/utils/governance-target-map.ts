import {
  GOVERNANCE_DOCS_PREFIX,
  GOVERNANCE_INSTALL_TARGETS_PREFIX,
  GOVERNANCE_TARGETS_WITH_INSTALL_BUNDLE,
  installTargetBundlePrefix,
  type AgentGovernanceFile,
  type AgentGovernanceScaffold,
  type GovernanceTarget,
} from "@theforge/shared-types";
import {
  rulePathToSkillPath,
  transformGovernanceContent,
  transformRulePathForTarget,
} from "./governance-content-transform.js";

export { GOVERNANCE_INSTALL_TARGETS_PREFIX as INSTALL_TARGETS_PREFIX };

type PathRule = {
  from: RegExp;
  to: string | ((match: RegExpMatchArray) => string);
};

/** Reglas de renombre canónico → destino repo (export single-target legacy). */
const TARGET_PATH_MAP: Record<GovernanceTarget, PathRule[]> = {
  cursor: [{ from: /^\.cursor\//, to: `${GOVERNANCE_DOCS_PREFIX}` }],
  openhands: [
    {
      from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}rules/(.+\\.mdc)$`),
      to: ".openhands/rules/$1",
    },
    {
      from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}skills/(.+)/SKILL\\.md$`),
      to: ".openhands/skills/$1/SKILL.md",
    },
    { from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}references/`), to: ".openhands/references/" },
    { from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}agents/`), to: ".openhands/agents/" },
    { from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}commands/`), to: ".openhands/commands/" },
    {
      from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}mcp\\.json\\.example$`),
      to: ".openhands/mcp.json",
    },
    { from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}`), to: ".openhands/" },
    { from: /^CLAUDE\.md$/, to: "" },
    { from: /^\.cursor\//, to: ".openhands/" },
  ],
  hermes: [
    {
      from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}rules/(.+)\\.mdc$`),
      to: ".hermes/skills/$1/SKILL.md",
    },
    {
      from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}skills/(.+)/SKILL\\.md$`),
      to: ".hermes/skills/$1/SKILL.md",
    },
    { from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}references/`), to: ".hermes/references/" },
    { from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}agents/`), to: ".hermes/agents/" },
    { from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}commands/`), to: ".hermes/commands/" },
    {
      from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}mcp\\.json\\.example$`),
      to: ".hermes/mcp.json.example",
    },
    { from: new RegExp(`^${GOVERNANCE_DOCS_PREFIX}`), to: ".hermes/" },
    { from: /^CLAUDE\.md$/, to: "" },
    { from: /^\.cursor\//, to: ".hermes/" },
  ],
  antigravity: [],
  "claude-code": [],
  "github-copilot": [],
  windsurf: [],
  codex: [],
};

function remapPathForTarget(rawPath: string, target: GovernanceTarget): string {
  const normalized = rawPath.trim();
  const rules = TARGET_PATH_MAP[target];
  for (const rule of rules) {
    const match = normalized.match(rule.from);
    if (match) {
      if (typeof rule.to === "function") return rule.to(match);
      return rule.to;
    }
  }
  return normalized;
}

/** Canonical subpath → bundle path under `install-targets/{target}/`. */
function canonicalToBundlePath(
  canonicalPath: string,
  target: GovernanceTarget,
): string | null {
  if (!canonicalPath.startsWith(GOVERNANCE_DOCS_PREFIX)) return null;
  const relative = canonicalPath.slice(GOVERNANCE_DOCS_PREFIX.length);
  const bundlePrefix = installTargetBundlePrefix(target);

  if (relative === "mcp.json.example") {
    return `${bundlePrefix}mcp.json.example`;
  }

  if (relative.startsWith("rules/") && relative.endsWith(".mdc")) {
    if (target === "antigravity" || target === "hermes") {
      return `${bundlePrefix}${rulePathToSkillPath(relative, target)}`;
    }
    if (target === "github-copilot") {
      const name = relative.slice("rules/".length).replace(/\.mdc$/i, "");
      return `${bundlePrefix}instructions/${name}.instructions.md`;
    }
    const transformed = transformRulePathForTarget(relative, target);
    return `${bundlePrefix}${transformed}`;
  }

  return `${bundlePrefix}${relative}`;
}

function bundleFileForTarget(
  file: AgentGovernanceFile,
  target: GovernanceTarget,
): AgentGovernanceFile | null {
  const bundlePath = canonicalToBundlePath(file.path, target);
  if (!bundlePath) return null;

  let content = file.content;
  if (file.path.includes("/rules/") && file.path.endsWith(".mdc")) {
    content = transformGovernanceContent(file.path, file.content, target);
  } else if (target === "github-copilot" && bundlePath.includes("/instructions/")) {
    content = transformGovernanceContent(file.path, file.content, target);
  } else if (
    (target === "antigravity" || target === "hermes") &&
    bundlePath.includes("/skills/") &&
    file.path.endsWith(".mdc")
  ) {
    content = transformGovernanceContent(file.path, file.content, target);
  } else if (target === "claude-code" && bundlePath.endsWith(".md")) {
    content = transformGovernanceContent(file.path, file.content, target);
  } else if (target === "windsurf" && bundlePath.includes("/rules/")) {
    content = transformGovernanceContent(file.path, file.content, target);
  }

  return { path: bundlePath, content };
}

/**
 * Transforma scaffold canónico al layout de un target (legacy export).
 * Omite archivos cuyo path queda vacío.
 */
export function remapGovernanceScaffold(
  scaffold: AgentGovernanceScaffold,
  target: GovernanceTarget,
): AgentGovernanceScaffold {
  if (target === "cursor") return scaffold;

  const remappedFiles: AgentGovernanceFile[] = [];
  const remappedManifestPaths: string[] = [];

  for (const file of scaffold.files) {
    const newPath = remapPathForTarget(file.path, target);
    if (!newPath) continue;
    remappedFiles.push({ ...file, path: newPath });
    remappedManifestPaths.push(newPath);
  }

  return {
    ...scaffold,
    manifest: {
      ...scaffold.manifest,
      files: remappedManifestPaths,
    },
    files: remappedFiles,
  };
}

/** Genera archivos bajo `install-targets/{target}/` para cada IDE con bundle. */
export function buildMultiTargetBundle(
  scaffold: AgentGovernanceScaffold,
): Map<GovernanceTarget, AgentGovernanceFile[]> {
  const result = new Map<GovernanceTarget, AgentGovernanceFile[]>();
  const canonicalFiles = scaffold.files.filter(
    (f) => f.path.startsWith(GOVERNANCE_DOCS_PREFIX) || f.path.startsWith(".cursor/"),
  );

  for (const target of GOVERNANCE_TARGETS_WITH_INSTALL_BUNDLE) {
    const bundleFiles: AgentGovernanceFile[] = [];
    for (const file of canonicalFiles) {
      const normalized = file.path.startsWith(".cursor/")
        ? `${GOVERNANCE_DOCS_PREFIX}${file.path.replace(/^\.cursor\//, "")}`
        : file.path;
      const bundled = bundleFileForTarget({ ...file, path: normalized }, target);
      if (bundled) bundleFiles.push(bundled);
    }
    if (bundleFiles.length > 0) result.set(target, bundleFiles);
  }

  return result;
}
