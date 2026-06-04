import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractHexFromUxGuideMessage,
  resolveUxGuideColorKeys,
  tryApplyUxGuideLocalPatch,
  extractColorMapFromProposal,
  getLastAssistantChatContent,
  responseClaimsUxGuideAppliedWithoutDoc,
} from "./ux-ui-guide-local-patch.util.js";
import {
  isUxGuideConfirmationMessage,
  shouldPersistUxGuideFromChat,
} from "./ux-ui-guide-chat-intent.util.js";

const SAMPLE = `---
name: Orbit KMS Edition
colors:
  primary: "#1B2A4B"
  secondary: "#1E6F4F"
  tertiary: "#D69E2E"
  accent: "#1B2A4B"
  background: "#FFFFFF"
  muted: "#DDDFE4"
  danger: "#C53D3B"
---

## Overview

Identidad B2B.

## Colors

| Token | Hex | Uso |
| Primary | #1B2A4B | Marca principal |
| Secondary | #1E6F4F | Acento secundario |
| Tertiary | #D69E2E | Acento cálido |
`;

const ASSISTANT_PROPOSAL = `
Propongo esta paleta WCAG AA:
- **Azul (Primary):** \`#1B2A4D\`
- **Verde (Secondary):** \`#1E6F4F\`
- **Ámbar (Tertiary/Accent):** \`#D69E2E\`
- **Rojo (Danger):** \`#C53D3B\`
- **Fondo (Background):** \`#F3F6FA\`

¿Quieres que aplique esta paleta de 12 colores en la Guía UX/UI actualizando el YAML front matter?
`;

describe("ux-ui-guide-local-patch", () => {
  it("extrae hex con o sin numeral", () => {
    assert.equal(extractHexFromUxGuideMessage("Cambia el color principal 1B2A4A"), "#1B2A4A");
    assert.equal(extractHexFromUxGuideMessage("pon #1B2A4A"), "#1B2A4A");
  });

  it("resuelve primary + accent para color principal", () => {
    assert.deepEqual(resolveUxGuideColorKeys("Modifica el color principal a 1B2A4A"), [
      "primary",
      "accent",
    ]);
  });

  it("parchea YAML y tabla markdown (un color)", () => {
    const result = tryApplyUxGuideLocalPatch(
      SAMPLE,
      "Modifica el color principal a 1B2A4A",
    );
    assert.ok(result);
    assert.match(result!.content, /primary: "#1B2A4A"/);
    assert.match(result!.content, /accent: "#1B2A4A"/);
    assert.match(result!.message, /#1B2A4A/);
  });

  it("detecta confirmación del usuario", () => {
    assert.equal(isUxGuideConfirmationMessage("Si aplicalos"), true);
    assert.equal(isUxGuideConfirmationMessage("Aplicalos"), true);
    assert.equal(isUxGuideConfirmationMessage("Aplícalos"), true);
    assert.equal(isUxGuideConfirmationMessage("sí, haz los cambios"), true);
    assert.equal(shouldPersistUxGuideFromChat("Aplicalos", true), true);
  });

  it("extrae paleta de la propuesta del asistente", () => {
    const map = extractColorMapFromProposal(ASSISTANT_PROPOSAL);
    assert.equal(map.primary, "#1B2A4D");
    assert.equal(map.secondary, "#1E6F4F");
    assert.equal(map.tertiary, "#D69E2E");
    assert.equal(map.danger, "#C53D3B");
    assert.equal(map.background, "#F3F6FA");
  });

  it("aplica paleta cuando el usuario confirma tras propuesta", () => {
    const result = tryApplyUxGuideLocalPatch(SAMPLE, "Si aplicalos", ASSISTANT_PROPOSAL);
    assert.ok(result);
    assert.match(result!.content, /primary: "#1B2A4D"/);
    assert.match(result!.content, /secondary: "#1E6F4F"/);
    assert.match(result!.content, /tertiary: "#D69E2E"/);
    assert.match(result!.content, /danger: "#C53D3B"/);
    assert.match(result!.message, /actualizada/i);

    const bare = tryApplyUxGuideLocalPatch(SAMPLE, "Aplicalos", ASSISTANT_PROPOSAL);
    assert.ok(bare);
    assert.match(bare!.content, /primary: "#1B2A4D"/);
  });

  it("extrae paleta de tabla markdown del asistente", () => {
    const tableProposal = `
| Token | Hex propuesto | Justificación |
| primary | #0F2B4A | Marca |
| secondary | #2B6B5E | Acento |
| tertiary | #C8923F | Cálido |
| danger | #B33A3A | Error |
`;
    const map = extractColorMapFromProposal(tableProposal);
    assert.equal(map.primary, "#0F2B4A");
    assert.equal(map.secondary, "#2B6B5E");
    assert.equal(map.tertiary, "#C8923F");
    assert.equal(map.danger, "#B33A3A");
  });

  it("obtiene último mensaje del asistente del historial", () => {
    const prior = getLastAssistantChatContent([
      { role: "user", content: "hola" },
      { role: "assistant", content: ASSISTANT_PROPOSAL },
    ]);
    assert.ok(prior?.includes("#1B2A4D"));
  });

  it("detecta afirmación falsa sin documento", () => {
    assert.equal(
      responseClaimsUxGuideAppliedWithoutDoc(
        "El color primario es ahora #1B2A4A. Todos los componentes se han actualizado.",
      ),
      true,
    );
    assert.equal(
      responseClaimsUxGuideAppliedWithoutDoc(
        "He aplicado la nueva paleta propuesta al DESIGN.md completo, actualizando el YAML.",
      ),
      true,
    );
  });
});
