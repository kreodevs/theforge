import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isUxGuideCapabilityOrExploratoryQuestion,
  isUxGuideExplicitModifyRequest,
  shouldPersistUxGuideFromChat,
  responseLooksConversationalOnly,
  gateUxGuideSplitResult,
  buildUxGuideChatAck,
  uxGuideAssistantChatMessage,
} from "./ux-ui-guide-chat-intent.util.js";

describe("ux-ui-guide-chat-intent", () => {
  it("trata «¿puedes hacer cambios de los colores?» como consulta", () => {
    const q = "puedes hacer cambios de los colores?";
    assert.equal(isUxGuideCapabilityOrExploratoryQuestion(q), true);
    assert.equal(isUxGuideExplicitModifyRequest(q), false);
    assert.equal(shouldPersistUxGuideFromChat(q, true), false);
  });

  it("trata orden con hex como modificación", () => {
    const q = "pon el primario en #1B3A5C";
    assert.equal(isUxGuideExplicitModifyRequest(q), true);
    assert.equal(shouldPersistUxGuideFromChat(q, true), true);
  });

  it("trata confirmación como modificación", () => {
    assert.equal(shouldPersistUxGuideFromChat("sí, aplica", true), true);
    assert.equal(shouldPersistUxGuideFromChat("Aplicalos", true), true);
  });

  it("detecta respuesta conversacional corta", () => {
    const r =
      "He ajustado la paleta a un azul profundo corporativo. Los contrastes superan 4.5:1.";
    assert.equal(responseLooksConversationalOnly(r), true);
  });

  it("anula persistencia si hubo FIN_UX_UI pero el usuario solo preguntó capacidad", () => {
    const doc = "---\nname: Test\ncolors:\n  primary: \"#000\"\n---\n\n## Overview\n\nx";
    const full = `${doc}\n---FIN_UX_UI---\nResumen breve.`;
    const gated = gateUxGuideSplitResult(
      "puedes hacer cambios de los colores?",
      true,
      true,
      doc,
      { docPart: doc, chatPart: "Resumen breve." },
      full,
      "Resumen breve.",
    );
    assert.equal(gated.hasUx, false);
    assert.equal(gated.uxDocPart, undefined);
    assert.equal(gated.rawChat, "Resumen breve.");
  });

  it("confirma en chat cuando el doc se persiste sin mensaje tras FIN_UX_UI", () => {
    const doc = "---\nname: Test\ncolors:\n  primary: \"#1B2A4B\"\n---\n\n## Overview\n\nx";
    const gated = gateUxGuideSplitResult(
      "Cambia el color principal 1B2A4B",
      true,
      true,
      doc,
      { docPart: doc, chatPart: "" },
      `${doc}\n---FIN_UX_UI---`,
      "",
    );
    assert.equal(gated.hasUx, true);
    assert.match(gated.rawChat, /#1B2A4B/i);
    assert.match(gated.rawChat, /actualizada/i);
  });

  it("uxGuideAssistantChatMessage rellena ack si el panel recibió contenido", () => {
    const msg = uxGuideAssistantChatMessage("", "---\ncolors:\n  primary: \"#1B2A4B\"\n---", "pon el primario en #1B2A4B");
    assert.match(msg, /#1B2A4B/);
    assert.match(msg, /actualizada/i);
  });

  it("buildUxGuideChatAck menciona hex del mensaje del usuario", () => {
    const ack = buildUxGuideChatAck("Cambia el color principal 1B2A4B");
    assert.equal(ack.includes("#1B2A4B"), true);
  });
});
