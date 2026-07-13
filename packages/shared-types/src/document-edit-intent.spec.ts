import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasEmbeddedSpecificationBlock,
  isHypotheticalDocumentEditOffer,
  isUserExploringDbgaIntent,
  looksLikeDbgaDocumentBody,
  looksLikeDbgaEditRequest,
  looksLikeDbgaSpecIntegrationRequest,
} from "./document-edit-intent.js";

describe("looksLikeDbgaEditRequest", () => {
  it("detecta edición explícita al documento", () => {
    assert.ok(
      looksLikeDbgaEditRequest(
        "Haz las modificaciones al documento. Integrar Kill Switch y tablero de aprobación humana.",
      ),
    );
  });

  it("detecta tenant con verbo de cambio", () => {
    assert.ok(
      looksLikeDbgaEditRequest(
        "Hay que hacer modificaciones. El catálogo debe ser multi tenant con tenant_id en OBP y OBP4MO",
      ),
    );
  });

  it("no trata brainstorming de arquitectura como edición DBGA", () => {
    assert.equal(
      looksLikeDbgaEditRequest(
        "Tenemos que aislar el núcleo del negocio de la infraestructura de las APIs. Vamos a usar adaptadores. Tendríamos que definir si cada agente tiene su propio modelo o cada tarea tiene un modelo.",
      ),
      false,
    );
  });

  it("no trata pregunta condicional con «en el DBGA» como edición inmediata", () => {
    const msg =
      "Hay un gap crítico: Migración de datos entre tiers. ¿Qué sugieres hacer? " +
      "¿Te parece bien esta aproximación? Si es así, la integro en el DBGA y la saco de omisiones críticas.";
    assert.ok(isUserExploringDbgaIntent(msg));
    assert.equal(looksLikeDbgaEditRequest(msg), false);
  });

  it("sigue detectando cubrir gap como edición explícita", () => {
    assert.ok(
      looksLikeDbgaEditRequest(
        "Cubre el gap de Auditoría de acciones de cliente en Seguridad y elimínalo de omisiones críticas.",
      ),
    );
  });

  it("detecta integración de spec pegada (Portal de Licencias)", () => {
    const spec =
      "# Especificación del Portal de Licencias\n\n**Versión:** 1.0.0\n\n---\n\n## 1. Visión General\n\n" +
      "El Portal de Licencias valida licencias comerciales.\n\n## 2. Base URL\n\nPOST /licenses/validate\n\n".repeat(
        12,
      );
    const message =
      "lo ideal es que nuestro portal, en licenciamiento, pudiera complir con estas especificaciones\n\n" +
      spec;
    assert.ok(hasEmbeddedSpecificationBlock(message));
    assert.ok(looksLikeDbgaSpecIntegrationRequest(message));
    assert.ok(looksLikeDbgaEditRequest(message));
  });
});

describe("looksLikeDbgaDocumentBody", () => {
  it("detecta outline numerado de DBGA en el chat", () => {
    const body =
      "1. Resumen Ejecutivo\n\nForgeOps es una plataforma SaaS.\n\n2. Benchmark de Industria\n\nComparativa.\n\n".repeat(
        20,
      );
    assert.ok(looksLikeDbgaDocumentBody(body));
  });
});

describe("isHypotheticalDocumentEditOffer", () => {
  it("detecta pregunta de incorporar al DBGA", () => {
    assert.ok(
      isHypotheticalDocumentEditOffer(
        "¿Prefieres que profundice en esta arquitectura y la incorpore al DBGA como una sección de Capa de Abstracción?",
      ),
    );
  });

  it("no confunde afirmación de cambio aplicado", () => {
    assert.equal(
      isHypotheticalDocumentEditOffer(
        "He actualizado el documento completo integrando la sección de adaptadores en el DBGA.",
      ),
      false,
    );
  });
});
