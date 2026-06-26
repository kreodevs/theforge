import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isHypotheticalDocumentEditOffer,
  looksLikeDbgaEditRequest,
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
