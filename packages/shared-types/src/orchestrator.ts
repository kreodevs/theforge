import { z } from "zod";
import { sessionResponseSchema } from "./session.js";

/** Respuesta de POST /ai-orchestrator/chat (entrevista). */
export const chatOrchestratorResponseSchema = z.object({
  session: sessionResponseSchema,
  project: z.unknown().optional(),
  uxUiGuideContent: z.string().optional(),
  /** Presente si `AGENT_EVALUATOR_LEGACY=true` y el evaluador rechaza el plan legacy. */
  evaluatorCritique: z.string().optional(),
});

export type ChatOrchestratorResponse = z.infer<typeof chatOrchestratorResponseSchema>;
