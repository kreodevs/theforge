import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertRedisConfiguredForProduction,
  resolveMddWorkerConcurrency,
  resolveTheForgeRuntimeRole,
  shouldStartBullmqWorkers,
  shouldStartHttpServer,
} from "./bullmq-runtime.config.js";

describe("bullmq-runtime.config", () => {
  it("defaults to all role for local monolith", () => {
    assert.equal(resolveTheForgeRuntimeRole({}), "all");
    assert.equal(shouldStartHttpServer({}), true);
    assert.equal(shouldStartBullmqWorkers({}), true);
  });

  it("http role enqueues only", () => {
    const env = { THEFORGE_RUNTIME_ROLE: "http" };
    assert.equal(shouldStartHttpServer(env), true);
    assert.equal(shouldStartBullmqWorkers(env), false);
  });

  it("worker role consumes only", () => {
    const env = { THEFORGE_RUNTIME_ROLE: "worker" };
    assert.equal(shouldStartHttpServer(env), false);
    assert.equal(shouldStartBullmqWorkers(env), true);
  });

  it("requires REDIS_URL in production", () => {
    assert.throws(
      () => assertRedisConfiguredForProduction({ NODE_ENV: "production" }),
      /REDIS_URL is required/,
    );
    assert.doesNotThrow(() =>
      assertRedisConfiguredForProduction({
        NODE_ENV: "production",
        REDIS_URL: "redis://localhost:6379",
      }),
    );
  });

  it("parses MDD concurrency with bounds", () => {
    assert.equal(resolveMddWorkerConcurrency({}), 2);
    assert.equal(resolveMddWorkerConcurrency({ MDD_BULLMQ_CONCURRENCY: "4" }), 4);
    assert.equal(resolveMddWorkerConcurrency({ MDD_BULLMQ_CONCURRENCY: "99" }), 2);
  });
});
