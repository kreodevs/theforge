import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeTaskLists, hasTaskLists, countTaskItems } from "./gfm-task-lists.js";

describe("normalizeTaskLists", () => {
  it("normalizes uppercase X to lowercase x", () => {
    const result = normalizeTaskLists("- [X] Done");
    assert.equal(result, "- [x] Done");
  });

  it("normalizes checkmark to x", () => {
    const result = normalizeTaskLists("- [✓] Done");
    assert.equal(result, "- [x] Done");
  });

  it("normalizes heavy checkmark to x", () => {
    const result = normalizeTaskLists("- [✔] Done");
    assert.equal(result, "- [x] Done");
  });

  it("preserves unchecked items", () => {
    const result = normalizeTaskLists("- [ ] Todo");
    assert.equal(result, "- [ ] Todo");
  });

  it("handles mixed items", () => {
    const input = "- [X] Done\n- [ ] Todo\n- [x] Also done";
    const result = normalizeTaskLists(input);
    assert.equal(result, "- [x] Done\n- [ ] Todo\n- [x] Also done");
  });

  it("handles nested task items", () => {
    const input = "  - [X] Indented\n    - [ ] Deep";
    const result = normalizeTaskLists(input);
    assert.equal(result, "  - [x] Indented\n    - [ ] Deep");
  });

  it("does not modify non-task lines", () => {
    const input = "Regular text\n- [ ] Todo\n- Not a task";
    const result = normalizeTaskLists(input);
    assert.ok(result.includes("Regular text"));
    assert.ok(result.includes("- [ ] Todo"));
    assert.ok(result.includes("- Not a task"));
  });
});

describe("hasTaskLists", () => {
  it("detects task lists", () => {
    assert.ok(hasTaskLists("- [ ] Todo"));
    assert.ok(hasTaskLists("- [x] Done"));
  });

  it("returns false for no tasks", () => {
    assert.ok(!hasTaskLists("Regular text\n- Not a task"));
  });
});

describe("countTaskItems", () => {
  it("counts checked and unchecked", () => {
    const result = countTaskItems("- [x] Done\n- [ ] Todo\n- [X] Done2");
    assert.equal(result.total, 3);
    assert.equal(result.checked, 2);
    assert.equal(result.unchecked, 1);
  });

  it("returns zeros for no tasks", () => {
    const result = countTaskItems("No tasks here");
    assert.equal(result.total, 0);
  });
});
