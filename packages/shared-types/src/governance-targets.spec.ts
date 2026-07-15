import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GOVERNANCE_DOCS_PREFIX } from "./agent-governance.js";
import { GOVERNANCE_INSTALL_TARGETS_PREFIX } from "./governance-targets.js";
import {
  buildGovernanceInstallMapForTarget,
  buildMultiTargetInstallMaps,
  expectedPromptInicialPaths,
  governanceInstallTarget,
  installTargetBundlePrefix,
  normalizeGovernanceTargetAlias,
  promptInicialFilename,
} from "./governance-targets.js";

describe("governance-targets", () => {
  it("promptInicialFilename genera nombres por target", () => {
    assert.equal(promptInicialFilename("cursor"), "PROMPT-INICIAL.cursor.md");
    assert.equal(promptInicialFilename("antigravity"), "PROMPT-INICIAL.antigravity.md");
    assert.equal(promptInicialFilename("codex"), "PROMPT-INICIAL.codex.md");
  });

  it("normalizeGovernanceTargetAlias resuelve aliases MCP", () => {
    assert.equal(normalizeGovernanceTargetAlias("gemini"), "antigravity");
    assert.equal(normalizeGovernanceTargetAlias("devin"), "windsurf");
    assert.equal(normalizeGovernanceTargetAlias("claude"), "claude-code");
    assert.equal(normalizeGovernanceTargetAlias(undefined), "cursor");
  });

  it("governanceInstallTarget — cursor canónico (backward compat)", () => {
    const rule = `${GOVERNANCE_DOCS_PREFIX}rules/git-commits.mdc`;
    assert.equal(governanceInstallTarget(rule), ".cursor/rules/git-commits.mdc");
    assert.equal(governanceInstallTarget(rule, "cursor"), ".cursor/rules/git-commits.mdc");
    const mcp = `${GOVERNANCE_DOCS_PREFIX}mcp.json.example`;
    assert.equal(governanceInstallTarget(mcp), ".cursor/mcp.json");
  });

  it("governanceInstallTarget — antigravity bundle → .agents/", () => {
    const skill = `${installTargetBundlePrefix("antigravity")}skills/demo/SKILL.md`;
    assert.equal(governanceInstallTarget(skill, "antigravity"), ".agents/skills/demo/SKILL.md");
    const rule = `${installTargetBundlePrefix("antigravity")}skills/git-commits/SKILL.md`;
    assert.equal(governanceInstallTarget(rule, "antigravity"), ".agents/skills/git-commits/SKILL.md");
  });

  it("governanceInstallTarget — claude-code rules .md", () => {
    const rule = `${GOVERNANCE_DOCS_PREFIX}rules/stack.mdc`;
    assert.equal(governanceInstallTarget(rule, "claude-code"), ".claude/rules/stack.md");
  });

  it("governanceInstallTarget — github-copilot instructions", () => {
    const rule = `${GOVERNANCE_DOCS_PREFIX}rules/api-contracts.mdc`;
    assert.equal(
      governanceInstallTarget(rule, "github-copilot"),
      ".github/instructions/api-contracts.instructions.md",
    );
  });

  it("buildGovernanceInstallMapForTarget filtra por prefijo bundle", () => {
    const paths = [
      `${GOVERNANCE_DOCS_PREFIX}rules/a.mdc`,
      `${installTargetBundlePrefix("antigravity")}skills/b/SKILL.md`,
      "AGENTS.md",
    ];
    const antigravity = buildGovernanceInstallMapForTarget(paths, "antigravity");
    assert.equal(antigravity.length, 1);
    assert.ok(antigravity[0]!.source.includes("install-targets/antigravity"));
    const cursor = buildGovernanceInstallMapForTarget(paths, "cursor");
    assert.ok(cursor.some((e) => e.target.startsWith(".cursor/")));
  });

  it("buildMultiTargetInstallMaps agrupa por target", () => {
    const paths = [
      `${GOVERNANCE_DOCS_PREFIX}rules/x.mdc`,
      `${installTargetBundlePrefix("cursor")}rules/x.mdc`,
      `${installTargetBundlePrefix("openhands")}rules/x.mdc`,
    ];
    const maps = buildMultiTargetInstallMaps(paths);
    assert.ok(maps.cursor?.length);
    assert.ok(maps.openhands?.length);
  });

  it("expectedPromptInicialPaths incluye índice y 7 variantes", () => {
    const paths = expectedPromptInicialPaths();
    assert.ok(paths.includes("PROMPT-INICIAL.md"));
    assert.ok(paths.includes("PROMPT-INICIAL.antigravity.md"));
    assert.equal(paths.filter((p) => /^PROMPT-INICIAL\.[a-z0-9-]+\.md$/.test(p)).length, 7);
  });

  it("installTargetBundlePrefix sin dotfiles", () => {
    assert.equal(
      installTargetBundlePrefix("cursor"),
      `${GOVERNANCE_INSTALL_TARGETS_PREFIX}cursor/`,
    );
    assert.equal(installTargetBundlePrefix("cursor").startsWith("."), false);
  });
});
