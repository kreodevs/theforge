import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatNestApiError } from "./api-error.util.js";

describe("formatNestApiError structured MDD errors", () => {
  test("aplaniza message objeto con deliveryGate blockers", () => {
    const msg = formatNestApiError(
      400,
      JSON.stringify({
        statusCode: 400,
        message: {
          code: "ERR_MDD_DELIVERY_GATE",
          message: "Falta sección 6. Seguridad",
          deliveryGate: {
            ok: false,
            score: 42,
            blockers: ["Falta sección 6. Seguridad", "Sin contratos de API"],
            warnings: [],
          },
        },
      }),
    );
    assert.equal(
      msg,
      "Solicitud inválida (400): Falta sección 6. Seguridad · Sin contratos de API",
    );
  });

  test("mantiene mensaje string plano", () => {
    const msg = formatNestApiError(
      400,
      JSON.stringify({ statusCode: 400, message: "MDD inválido" }),
    );
    assert.equal(msg, "Solicitud inválida (400): MDD inválido");
  });

  test("usa code cuando no hay message legible", () => {
    const msg = formatNestApiError(
      400,
      JSON.stringify({
        statusCode: 400,
        message: { code: "ERR_MERMAID_SYNTAX" },
      }),
    );
    assert.equal(msg, "Solicitud inválida (400): ERR_MERMAID_SYNTAX");
  });
});
