import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { documentationGapStatusSchema } from "@theforge/shared-types";
import { isDocGapAutoApplyEnabled } from "./documentation-gap.service.js";

describe("isDocGapAutoApplyEnabled", () => {
  const original = process.env.DOC_GAP_AUTO_APPLY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DOC_GAP_AUTO_APPLY;
    } else {
      process.env.DOC_GAP_AUTO_APPLY = original;
    }
  });

  it("devuelve false por defecto (HITL activo)", () => {
    delete process.env.DOC_GAP_AUTO_APPLY;
    assert.equal(isDocGapAutoApplyEnabled(), false);
  });

  it("devuelve true solo con DOC_GAP_AUTO_APPLY=1", () => {
    process.env.DOC_GAP_AUTO_APPLY = "1";
    assert.equal(isDocGapAutoApplyEnabled(), true);
    process.env.DOC_GAP_AUTO_APPLY = "true";
    assert.equal(isDocGapAutoApplyEnabled(), false);
  });
});

describe("documentationGapStatusSchema", () => {
  it("incluye PENDING_APPROVAL", () => {
    const parsed = documentationGapStatusSchema.safeParse("PENDING_APPROVAL");
    assert.equal(parsed.success, true);
  });
});
