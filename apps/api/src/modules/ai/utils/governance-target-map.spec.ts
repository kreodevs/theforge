import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GOVERNANCE_DOCS_PREFIX, type AgentGovernanceScaffold } from "@theforge/shared-types";
import { buildMultiTargetBundle } from "./governance-target-map.js";

const baseScaffold: AgentGovernanceScaffold = {
  manifest: { templateVersion: "2.0.0", files: [] },
  files: [
    { path: "AGENTS.md", content: "# AGENTS\n" },
    {
      path: `${GOVERNANCE_DOCS_PREFIX}rules/git-commits.mdc`,
      content: "---\nalwaysApply: true\n---\n# Git\n",
    },
    {
      path: `${GOVERNANCE_DOCS_PREFIX}skills/demo/SKILL.md`,
      content: "---\nname: demo\n---\n",
    },
    {
      path: `${GOVERNANCE_DOCS_PREFIX}mcp.json.example`,
      content: "{}\n",
    },
  ],
};

describe("governance-target-map", () => {
  it("buildMultiTargetBundle genera install-targets por IDE", () => {
    const bundles = buildMultiTargetBundle(baseScaffold);
    assert.ok(bundles.has("cursor"));
    assert.ok(bundles.has("antigravity"));
    const antigravity = bundles.get("antigravity")!;
    assert.ok(antigravity.some((f) => f.path.startsWith("install-targets/antigravity/skills/")));
    assert.equal(
      antigravity.some((f) => f.path.includes(".cursor")),
      false,
    );
    const cursor = bundles.get("cursor")!;
    assert.ok(cursor.some((f) => f.path === "install-targets/cursor/rules/git-commits.mdc"));
  });

  it("github-copilot transforma rules a instructions", () => {
    const bundles = buildMultiTargetBundle(baseScaffold);
    const copilot = bundles.get("github-copilot")!;
    assert.ok(
      copilot.some((f) => f.path.endsWith("git-commits.instructions.md")),
    );
  });
});
