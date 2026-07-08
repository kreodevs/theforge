import { describe, it } from "node:test";
import assert from "node:assert";
import { repairGluedMarkdownHeadings } from "./repair-glued-headings.js";
import { formatDocumentMarkdown } from "./format-document-markdown.js";

const COPIlOTO_SECTION1 = `## 1. Contexto y Alcance ### Propósito del Proyecto

El Copiloto Inteligente Multi-MCP es un sistema centralizado que orquesta la interacción entre empleados autorizados y sistemas corporativos (inicialmente Bitrix24) mediante canales de mensajería natural como WhatsApp. El objetivo es eliminar la ineficiencia operativa causada por la fragmentación de información entre múltiples plataformas, permitiendo a los usuarios acceder datos y ejecutar acciones simples directamente desde su canal de comunicación preferido. ### Alcance y Fronteras #### Servicios Core (Dentro del Alcance)

    Copiloto Central: Microservicio que clasifica solicitudes
`;

describe("repairGluedMarkdownHeadings", () => {
  it("despega H2/H3/H4 pegados en §1 estilo Copiloto", () => {
    const out = repairGluedMarkdownHeadings(COPIlOTO_SECTION1);
    assert.match(out, /## 1\. Contexto y Alcance\n\n### Propósito del Proyecto/);
    assert.match(out, /preferido\.\n\n### Alcance y Fronteras\n\n#### Servicios Core/);
    assert.doesNotMatch(out, /Contexto y Alcance ###/);
    assert.doesNotMatch(out, /Fronteras ####/);
  });

  it("formatDocumentMarkdown aplica la misma reparación", () => {
    const out = formatDocumentMarkdown(COPIlOTO_SECTION1);
    assert.match(out, /## 1\. Contexto y Alcance\n\n### Propósito del Proyecto/);
    assert.doesNotMatch(out, /Contexto y Alcance ###/);
  });

  it("parte título de heading y prosa en la misma línea", () => {
    const raw =
      "### Declaración de Independencia Este sistema es la raíz de la arquitectura.";
    const out = repairGluedMarkdownHeadings(raw);
    assert.match(out, /### Declaración de Independencia\n\nEste sistema es la raíz/);
  });

  it("promueve §1 sin ## y despega subheadings (muestra Copiloto pegada)", () => {
    const raw = `1. Contexto y Alcance ### Propósito del Proyecto

Texto. ### Alcance y Fronteras #### Servicios Core (Dentro del Alcance)

    item
    Autenticación SSO: Integración #### Servicios Extensiones (Fuera del Alcance)
    más texto ### Declaración de Independencia Este sistema es la raíz. ### Audiencia Técnica Desarrolladores Fullstack:`;
    const out = repairGluedMarkdownHeadings(raw);
    assert.match(out, /^## 1\. Contexto y Alcance\n\n### Propósito del Proyecto/m);
    assert.doesNotMatch(out, /Contexto y Alcance ###/);
    assert.doesNotMatch(out, /Técnica Desarrolladores/);
    assert.match(out, /### Audiencia Técnica\n\nDesarrolladores Fullstack/);
  });
});
