import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMddSectionDelegateAssistantMessage,
  extractMddJobIdFromAssistantMessage,
  inferMddSectionFromEditMessage,
  MDD_CHAT_SECTION_DEFAULT,
} from "./mdd-chat-section.util.js";

describe("inferMddSectionFromEditMessage", () => {
  it("resuelve slash /seguridad → §6", () => {
    assert.equal(inferMddSectionFromEditMessage("/seguridad"), 6);
  });

  it("resuelve lenguaje natural «regenera la sección 4»", () => {
    assert.equal(inferMddSectionFromEditMessage("regenera la sección 4 del mdd"), 4);
  });

  it("infere §3 por keywords sql/modelo", () => {
    assert.equal(inferMddSectionFromEditMessage("añade la tabla usuarios al modelo de datos"), 3);
  });

  it("infere §6 por keyword seguridad", () => {
    assert.equal(inferMddSectionFromEditMessage("integra OAuth en la sección de seguridad"), 6);
  });

  it("default software_architect cuando no hay pistas", () => {
    assert.equal(inferMddSectionFromEditMessage("aplica los cambios al documento"), MDD_CHAT_SECTION_DEFAULT);
  });
});

describe("buildMddSectionDelegateAssistantMessage", () => {
  it("incluye jobId embebido para polling", () => {
    const msg = buildMddSectionDelegateAssistantMessage(3, "abc-123");
    assert.match(msg, /Regenerando §3/);
    assert.equal(extractMddJobIdFromAssistantMessage(msg), "abc-123");
  });
});
