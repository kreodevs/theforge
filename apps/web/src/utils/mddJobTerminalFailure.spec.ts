import assert from "node:assert";
import { describe, it } from "node:test";
import { isMddJobTerminalFailure } from "./mddJobTerminalFailure.js";

describe("isMddJobTerminalFailure", () => {
  it("detecta cancelación, stall y recuperación por reinicio", () => {
    assert.equal(isMddJobTerminalFailure("Cancelado por el usuario"), true);
    assert.equal(isMddJobTerminalFailure("job stalled more than allowable limit"), true);
    assert.equal(
      isMddJobTerminalFailure("Recuperado tras reinicio del API (job huérfano)"),
      true,
    );
  });

  it("no trata errores genéricos como terminales", () => {
    assert.equal(isMddJobTerminalFailure("Error al generar MDD"), false);
    assert.equal(isMddJobTerminalFailure(undefined), false);
  });
});
