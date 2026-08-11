import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import {
  isMddLlmQuotaError,
  isMddPersistOnlyGateError,
  isMddUserCancellationError,
  toMddJobError,
} from "./mdd-job-error.util.js";

test("isMddUserCancellationError detects cancel message", () => {
  assert.equal(isMddUserCancellationError(new Error("Cancelado por el usuario")), true);
  assert.equal(isMddUserCancellationError(new Error("timeout")), false);
});

test("toMddJobError wraps cancel as UnrecoverableError", () => {
  const wrapped = toMddJobError(new Error("Cancelado por el usuario"));
  assert.ok(wrapped instanceof UnrecoverableError);
});

test("toMddJobError wraps persist gate as UnrecoverableError (no retry pipeline)", () => {
  const err = new BadRequestException({ code: "ERR_MDD_DELIVERY_GATE", message: "gate fail" });
  assert.equal(isMddPersistOnlyGateError(err), true);
  assert.ok(toMddJobError(err) instanceof UnrecoverableError);
});

test("isMddLlmQuotaError detects OpenRouter 403 key limit", () => {
  assert.equal(
    isMddLlmQuotaError(new Error("403 Key limit exceeded for model anthropic/claude-3.5-sonnet")),
    true,
  );
  assert.equal(isMddLlmQuotaError(new Error("403 Forbidden")), false);
});

test("toMddJobError wraps LLM quota as UnrecoverableError", () => {
  const wrapped = toMddJobError(new Error("403 Key limit exceeded"));
  assert.ok(wrapped instanceof UnrecoverableError);
});
