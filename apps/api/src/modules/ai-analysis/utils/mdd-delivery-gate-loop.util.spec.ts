import { describe, it } from "node:test";
import assert from "node:assert";
import {
  formatDeliveryGateBlockersFeedback,
  resolveDeliveryGateFixTarget,
  shouldContinueDeliveryGateLoop,
} from "./mdd-delivery-gate-loop.util.js";

describe("mdd-delivery-gate-loop.util", () => {
  it("resolveDeliveryGateFixTarget elige integration para blockers §7/JWT", () => {
    assert.equal(
      resolveDeliveryGateFixTarget(["§6/§7: algoritmo JWT incoherente (§6=RS256, §7=HS256)"]),
      "integration",
    );
  });

  it("resolveDeliveryGateFixTarget elige software_architect para blockers §3/SQL", () => {
    assert.equal(
      resolveDeliveryGateFixTarget(["§3: tablas outbox-like duplicadas (eventos, outbox)"]),
      "software_architect",
    );
  });

  it("shouldContinueDeliveryGateLoop respeta max intentos", () => {
    assert.equal(shouldContinueDeliveryGateLoop({ ok: false, score: 50, blockers: ["x"], warnings: [] }, 0), true);
    assert.equal(shouldContinueDeliveryGateLoop({ ok: false, score: 50, blockers: ["x"], warnings: [] }, 2), true);
    assert.equal(shouldContinueDeliveryGateLoop({ ok: false, score: 50, blockers: ["x"], warnings: [] }, 3), false);
    assert.equal(shouldContinueDeliveryGateLoop({ ok: true, score: 95, blockers: [], warnings: [] }, 0), false);
  });

  it("formatDeliveryGateBlockersFeedback en español", () => {
    const fb = formatDeliveryGateBlockersFeedback(["Bloque SQL contiene prosa inválida"]);
    assert.ok(fb.includes("Gate de entrega"));
    assert.ok(fb.includes("prosa inválida"));
  });
});
