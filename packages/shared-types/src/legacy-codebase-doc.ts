import { z } from "zod";

/**
 * Modo `ask_codebase` (Ariadne) para generar documentación de partida (`generate-codebase-doc`).
 * - `ingest_mdd`: una sola llamada `evidence_first` (MDD 7§ del orchestrator/ingest), sin síntesis Nest ni 4 rondas clásicas.
 */
export const codebaseDocResponseModeSchema = z.enum([
  "default",
  "evidence_first",
  "raw_evidence",
  "ingest_mdd",
]);
export type CodebaseDocResponseMode = z.infer<typeof codebaseDocResponseModeSchema>;

export const generateCodebaseDocRequestSchema = z
  .object({
    responseMode: codebaseDocResponseModeSchema.optional(),
  })
  .strict();

export type GenerateCodebaseDocRequest = z.infer<typeof generateCodebaseDocRequestSchema>;
