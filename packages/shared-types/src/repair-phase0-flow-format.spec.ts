import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { repairPhase0FlowFormat } from "./repair-phase0-flow-format.js";
import { formatDocumentMarkdown } from "./format-document-markdown.js";

const BROKEN_FLOWS = `## 4. Flujos Principales

### Inicio de chat y autenticación
## 1. Un usuario envía un mensaje de WhatsApp al número asociado a una empresa.

## 2. El middleware de WhatsApp recibe el mensaje.

## 5. Se asigna el chat a una cola de procesamiento.

### La cola es gestionada por Redis y atendida por el worker de Celery.

### Procesamiento de mensaje (con ejecución asíncrona en Celery)

## 1. Usuario envía un mensaje.

## 2. El mensaje se añade al chat.

## 5. Roles y Permisos

- **Usuario final:** Iniciar chats
`;

describe("repairPhase0FlowFormat", () => {
  it("convierte pasos ## N. a listas ordenadas dentro de §4", () => {
    const out = repairPhase0FlowFormat(BROKEN_FLOWS);
    assert.match(out, /### Inicio de chat y autenticación\n1\. Un usuario envía/);
    assert.match(out, /\n2\. El middleware de WhatsApp recibe/);
    assert.doesNotMatch(out, /## 1\. Un usuario envía/);
    assert.doesNotMatch(out, /## 2\. El middleware/);
  });

  it("convierte notas ### La/El… tras un paso numerado en viñeta", () => {
    const out = repairPhase0FlowFormat(BROKEN_FLOWS);
    assert.match(out, /5\. Se asigna el chat[\s\S]*- La cola es gestionada por Redis/);
    assert.doesNotMatch(out, /### La cola es gestionada/);
  });

  it("conserva títulos ### de sub-flujos", () => {
    const out = repairPhase0FlowFormat(BROKEN_FLOWS);
    assert.match(out, /### Procesamiento de mensaje \(con ejecución asíncrona en Celery\)/);
  });

  it("no altera secciones posteriores (## 5. Roles)", () => {
    const out = repairPhase0FlowFormat(BROKEN_FLOWS);
    assert.match(out, /## 5\. Roles y Permisos/);
  });

  it("formatDocumentMarkdown aplica la reparación de flujos Fase 0", () => {
    const doc = `# Fase 0 — Especificación Inicial\n\n${BROKEN_FLOWS}`;
    const out = formatDocumentMarkdown(doc);
    assert.match(out, /1\. Un usuario envía un mensaje de WhatsApp/);
    assert.doesNotMatch(out, /## 1\. Un usuario envía/);
  });
});
