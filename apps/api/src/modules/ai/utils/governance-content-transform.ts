import type { GovernanceTarget } from "@theforge/shared-types";

/** Convierte frontmatter `.mdc` (Cursor) a `.md` con metadatos por IDE. */
export function transformMdcToMd(content: string, target: GovernanceTarget): string {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return content;

  const endIdx = trimmed.indexOf("---", 3);
  if (endIdx < 0) return content;

  const frontmatter = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trimStart();
  const lines = frontmatter.split("\n");
  const kv: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^([\w-]+)\s*:\s*(.+)$/);
    if (m) kv[m[1]!.toLowerCase()] = m[2]!.trim();
  }

  const alwaysApply = kv.alwaysapply === "true" || kv.always_apply === "true";
  const globs = kv.globs ?? kv.paths ?? "";

  let header = "---\n";
  switch (target) {
    case "claude-code":
      header += alwaysApply ? "paths: \"**/*\"\n" : globs ? `paths: "${globs}"\n` : "";
      header += "---\n\n";
      break;
    case "windsurf":
    case "github-copilot":
      header += alwaysApply ? "trigger: always_on\n" : globs ? `applyTo: "${globs}"\n` : "";
      header += "---\n\n";
      break;
    default:
      header = "";
      break;
  }

  if (!header && alwaysApply && target === "windsurf") {
    return `---\ntrigger: always_on\n---\n\n${body}`;
  }

  return header ? `${header}${body}` : body || content;
}

/** Renombra extensión `.mdc` → `.md` cuando el target no usa Cursor rules. */
export function transformRulePathForTarget(path: string, target: GovernanceTarget): string {
  if (!path.endsWith(".mdc")) return path;
  if (target === "cursor" || target === "openhands" || target === "hermes") return path;
  if (target === "github-copilot") {
    const base = path.replace(/\.mdc$/i, "");
    const name = base.split("/").pop() ?? base;
    return path.replace(/rules\/[^/]+\.mdc$/i, `instructions/${name}.instructions.md`);
  }
  return path.replace(/\.mdc$/i, ".md");
}

/** Convierte rule `.mdc` en skill Antigravity/Hermes (carpeta + SKILL.md). */
export function rulePathToSkillPath(rulePath: string, _target: GovernanceTarget): string {
  const match = rulePath.match(/rules\/(.+)\.mdc$/i);
  if (!match) return rulePath;
  const skillName = match[1]!.replace(/\//g, "-");
  return `skills/${skillName}/SKILL.md`;
}

/** Ajusta contenido al copiar rule → skill (Antigravity). */
export function transformRuleToSkillContent(content: string, ruleName: string): string {
  const body = transformMdcToMd(content, "antigravity");
  if (body.includes("name:") && body.trimStart().startsWith("---")) return body;
  return (
    "---\n" +
    `name: ${ruleName.replace(/\//g, "-")}\n` +
    "description: Regla de gobernanza TheForge (adaptada desde rule Cursor).\n" +
    "---\n\n" +
    body.replace(/^---[\s\S]*?---\n*/m, "").trimStart()
  );
}

/** Frontmatter Copilot para `*.instructions.md`. */
export function transformContentForCopilot(content: string, filename: string): string {
  const base = filename.replace(/\.instructions\.md$/i, "").replace(/\.mdc$/i, "");
  const body = transformMdcToMd(content, "github-copilot");
  if (body.trimStart().startsWith("---")) return body;
  return (
    "---\n" +
    `applyTo: "**/*"\n` +
    `description: ${base} — gobernanza TheForge\n` +
    "---\n\n" +
    body
  );
}

/** Aplica transformación de contenido según target y tipo de archivo. */
export function transformGovernanceContent(
  path: string,
  content: string,
  target: GovernanceTarget,
): string {
  if (path.endsWith(".mdc")) {
    if (target === "github-copilot") {
      return transformContentForCopilot(content, path.split("/").pop() ?? "rule");
    }
    if (target === "antigravity" || target === "hermes") {
      const name = path.match(/rules\/(.+)\.mdc$/i)?.[1] ?? "rule";
      return transformRuleToSkillContent(content, name);
    }
    return transformMdcToMd(content, target);
  }
  return content;
}
