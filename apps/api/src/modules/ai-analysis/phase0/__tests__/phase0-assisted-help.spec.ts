import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyPhase0Document } from "../phase0-normalize.util.js";
import {
  applyAssistedGapSynthesis,
  assistedGapKind,
  assistedHelpDeclinedMessage,
  hasAssistedSynthesisContext,
  heuristicSynthesizeUat,
  isAssistedHelpRequest,
} from "../phase0-assisted-help.util.js";
import { analyzeGaps } from "../phase0-gap-analyzer.js";
import type { Phase0Gap, Phase0InterviewState } from "../phase0.types.js";

describe("phase0 assisted help", () => {
  it("isAssistedHelpRequest detecta petición de generación", () => {
    assert.equal(
      isAssistedHelpRequest("con la información que tienes, puedes ayudarme a generarlos?"),
      true,
    );
    assert.equal(isAssistedHelpRequest("solo 2 personas, mi hermano y yo"), false);
  });

  it("heuristicSynthesizeUat produce escenarios desde flujos", () => {
    const borrador = emptyPhase0Document();
    borrador.proposito.problema = "Automatizar trading semanal con reglas claras.";
    borrador.proposito.usuarios = ["Inversor retail"];
    borrador.flujos = [{ nombre: "Ejecución semanal", pasos: ["Evaluar señales", "Ejecutar órdenes"] }];
    borrador.reglasNegocio = ["R5.1 Ventana semanal", "R5.2 Idempotencia"];
    const uat = heuristicSynthesizeUat(borrador);
    assert.ok(uat.length >= 2);
    assert.match(uat[0]!.descripcion, /Dado/i);
  });

  it("applyAssistedGapSynthesis cierra gap UAT", () => {
    const gap: Phase0Gap = {
      seccion: "proposito",
      criticidad: "importante",
      descripcion: "No se han definido criterios de aceptación de negocio (UAT)",
      razon: "test",
      sugerenciaPregunta: "¿Cuáles son los escenarios UAT?",
    };
    const state: Phase0InterviewState = {
      projectId: "p1",
      threadId: "t1",
      borrador: emptyPhase0Document(),
      gaps: [gap],
      preguntasRealizadas: 2,
      maxPreguntas: 5,
      questionPlan: [gap],
      planCursor: 0,
      status: "interviewing",
      inputRaw: "",
      inputType: "external_doc",
      historial: [],
      mode: "assisted",
      sourceFormat: "freeform_dbga",
      workingMarkdown: "## 1. Propósito\n\n**Problema:** Trading\n",
      ultimaPregunta: gap.sugerenciaPregunta,
    };
    state.borrador.proposito.problema = "Automatizar trading semanal.";
    state.borrador.flujos = [{ nombre: "Compra", pasos: ["Señal", "Orden"] }];

    const result = applyAssistedGapSynthesis({
      state,
      kind: "uat",
      criteriosUAT: heuristicSynthesizeUat(state.borrador),
      templateKind: "freeform_dbga",
      source: "heuristic",
    });

    assert.ok(result.cambios.includes("criteriosUAT"));
    assert.equal(
      analyzeGaps(state.borrador).some((g) => g.descripcion.includes("criterios de aceptación")),
      false,
    );
  });

  it("assistedHelpDeclinedMessage es explícito para UAT", () => {
    const msg = assistedHelpDeclinedMessage(undefined, assistedGapKind(undefined));
    assert.match(msg, /necesito tu respuesta/i);
  });

  it("hasAssistedSynthesisContext usa longitud de documento", () => {
    const borrador = emptyPhase0Document();
    const md = "x".repeat(3000);
    assert.equal(hasAssistedSynthesisContext(borrador, md, "uat"), true);
    assert.equal(hasAssistedSynthesisContext(borrador, "corto", "uat"), false);
  });
});
