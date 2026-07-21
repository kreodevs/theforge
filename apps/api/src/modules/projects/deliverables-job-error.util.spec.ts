import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import {
  isUnrecoverableDeliverablesError,
  isUserCancellationError,
  toDeliverablesJobError,
} from "./deliverables-job-error.util.js";

test("isUserCancellationError detects cancel message", () => {
  assert.equal(isUserCancellationError(new Error("Cancelado por el usuario")), true);
  assert.equal(isUserCancellationError(new Error("timeout")), false);
});

test("isUnrecoverableDeliverablesError — TASKS_QUALITY_BLOCKED", () => {
  const err = new BadRequestException({
    code: "TASKS_QUALITY_BLOCKED",
    message: "Tasks no cumple umbral de calidad estructural/determinístico/auditor.",
  });
  assert.equal(isUnrecoverableDeliverablesError(err), true);
});

test("isUnrecoverableDeliverablesError — TASKS_PREFLIGHT_BLOCKED", () => {
  const err = new BadRequestException({
    code: "TASKS_PREFLIGHT_BLOCKED",
    message: "DocAccuracy insuficiente.",
  });
  assert.equal(isUnrecoverableDeliverablesError(err), true);
});

test("isUnrecoverableDeliverablesError — generic Error is recoverable", () => {
  assert.equal(isUnrecoverableDeliverablesError(new Error("503 Service Unavailable")), false);
});

test("toDeliverablesJobError wraps unrecoverable as UnrecoverableError", () => {
  const wrapped = toDeliverablesJobError(
    new BadRequestException({
      code: "TASKS_QUALITY_BLOCKED",
      message: "Tasks no cumple umbral de calidad.",
    }),
  );
  assert.ok(wrapped instanceof UnrecoverableError);
  assert.match(wrapped.message, /Tasks no cumple umbral/);
});

test("toDeliverablesJobError passes through recoverable Error", () => {
  const original = new Error("rate limit 429");
  const out = toDeliverablesJobError(original);
  assert.equal(out, original);
  assert.equal(out instanceof UnrecoverableError, false);
});
