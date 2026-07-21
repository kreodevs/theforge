import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Status } from "@theforge/database";
import {
  dbStatusToLiveSemaphore,
  liveSemaphoreToDbStatus,
} from "./live-semaphore-status.util.js";

describe("liveSemaphoreToDbStatus", () => {
  it("maps green/yellow/red to VERDE/AMARILLO/ROJO", () => {
    assert.equal(liveSemaphoreToDbStatus("green"), Status.VERDE);
    assert.equal(liveSemaphoreToDbStatus("yellow"), Status.AMARILLO);
    assert.equal(liveSemaphoreToDbStatus("red"), Status.ROJO);
  });
});

describe("dbStatusToLiveSemaphore", () => {
  it("round-trips with liveSemaphoreToDbStatus", () => {
    for (const live of ["green", "yellow", "red"] as const) {
      assert.equal(dbStatusToLiveSemaphore(liveSemaphoreToDbStatus(live)), live);
    }
  });
});
