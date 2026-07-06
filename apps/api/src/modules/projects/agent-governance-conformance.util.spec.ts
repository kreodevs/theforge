import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkAgentGovernanceVsMdd } from "./agent-governance-conformance.util.js";
import type { AgentGovernanceScaffold } from "@theforge/shared-types";

describe("checkAgentGovernanceVsMdd", () => {
  it("detecta rule api-contracts ausente cuando hay contratos", () => {
    const scaffold: AgentGovernanceScaffold = {
      manifest: { templateVersion: "2.0.0", files: ["AGENTS.md"] },
      files: [
        {
          path: "AGENTS.md",
          content: "# AGENTS\n\n## Documentos SDD (layout dual)\n",
        },
        { path: "PROMPT-INICIAL.md", content: "# Prompt\n" },
        { path: "IMPLEMENT.md", content: "# Implement\n" },
      ],
    };
    const result = checkAgentGovernanceVsMdd(scaffold, {
      mddMarkdown: "# MDD\n## 2\nNestJS\n",
      apiContractsMarkdown: "### GET /users\n",
      complexity: "MEDIUM",
    });
    assert.equal(result.ok, false);
    assert.ok(result.gaps.some((g) => g.includes("api-contracts")));
  });
});
