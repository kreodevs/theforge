import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveTasksUpstreamActions,
  prepareSpecMarkdownForTasks,
} from "./tasks-upstream-prep.util.js";
import { computeDocAccuracy } from "../engine/cascade-accuracy.util.js";

describe("tasks-upstream-prep", () => {
  it("prepareSpecMarkdownForTasks detecta headings vacíos", () => {
    const raw = "## 1.\n\n**Journey:** flujo.\n\n" + "x".repeat(80);
    const prep = prepareSpecMarkdownForTasks(raw);
    assert.equal(prep.changed, true);
    assert.match(prep.normalized, /- \*\*Journey:\*\*/);
  });

  it("deriveTasksUpstreamActions sugiere api-contracts vacío", () => {
    const doc = computeDocAccuracy({
      mddMarkdown: "## 1.\n\n" + "x".repeat(220) + "\n## 4. API\n\nREST",
      specMarkdown: "# Spec\n\n" + "z".repeat(120),
      apiContractsMarkdown: "",
      uiScreensRequired: false,
    });
    const actions = deriveTasksUpstreamActions(doc, {
      apiContractsMarkdown: "",
      mddHasApiSection: true,
    });
    assert.ok(actions.some((a) => a.artifact === "api_contracts" && a.autoRepairable));
  });
});
