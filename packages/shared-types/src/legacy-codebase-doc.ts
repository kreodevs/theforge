import { z } from "zod";

/** Modo `ask_codebase` (Ariadne) para generar documentación de partida (`generate-codebase-doc`). */
export const codebaseDocResponseModeSchema = z.enum(["default", "evidence_first", "raw_evidence"]);
export type CodebaseDocResponseMode = z.infer<typeof codebaseDocResponseModeSchema>;

export const generateCodebaseDocRequestSchema = z
  .object({
    responseMode: codebaseDocResponseModeSchema.optional(),
  })
  .strict();

export type GenerateCodebaseDocRequest = z.infer<typeof generateCodebaseDocRequestSchema>;
