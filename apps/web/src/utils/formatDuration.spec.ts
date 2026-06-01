import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDurationMs } from "./formatDuration.ts";

describe("formatDurationMs", () => {
  it("formats sub-minute durations with one decimal second", () => {
    assert.equal(formatDurationMs(45234), "45.2s");
    assert.equal(formatDurationMs(59000), "59.0s");
  });

  it("formats minute-tier compound durations", () => {
    assert.equal(formatDurationMs(60000), "1m");
    assert.equal(formatDurationMs(100500), "1m 40s");
    assert.equal(formatDurationMs(119000), "1m 59s");
    assert.equal(formatDurationMs(120000), "2m");
    assert.equal(formatDurationMs(3599000), "59m 59s");
  });

  it("formats hour-tier compound durations", () => {
    assert.equal(formatDurationMs(3600000), "1h");
    assert.equal(formatDurationMs(7200000), "2h");
    assert.equal(formatDurationMs(5400000), "1h 30m");
  });
});
