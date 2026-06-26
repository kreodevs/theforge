import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { awaitWithNdjsonHeartbeat } from "./ndjson-heartbeat.util.js";

describe("awaitWithNdjsonHeartbeat", () => {
  it("emite ticks mientras la promesa está pendiente", async () => {
    let resolveWork!: (v: string) => void;
    const work = new Promise<string>((r) => {
      resolveWork = r;
    });
    const gen = awaitWithNdjsonHeartbeat(
      work,
      () => ({ type: "progress", agent: "Test", message: "tick" }),
      5,
    );
    const ticks: string[] = [];
    const run = (async () => {
      while (true) {
        const step = await gen.next();
        if (step.done) return step.value;
        ticks.push(step.value.message);
      }
    })();
    await new Promise((r) => setTimeout(r, 12));
    resolveWork("ok");
    const result = await run;
    assert.equal(result, "ok");
    assert.ok(ticks.length >= 1);
  });
});
