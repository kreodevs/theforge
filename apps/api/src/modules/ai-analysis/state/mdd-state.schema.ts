import { z } from "zod";
import { mddStructuredSchema } from "./mdd-structured.schema.js";

/** Auditor decision: loop back to Clarifier with feedback or finish. */
export const mddAuditorDecisionSchema = z.enum(["clarifier", "done"]);
export type MDDAuditorDecision = z.infer<typeof mddAuditorDecisionSchema>;

/** Un paso del plan explícito (patrón Planner–Executor). El Executor ejecuta en orden. */
export const mddPlanStepSchema = z.object({
  step_id: z.string().describe("Identificador del paso (ej. '1', '2')"),
  task_description: z.string().describe("Descripción breve de la tarea"),
  node: z.string().describe("Nombre del nodo del grafo que ejecuta este paso"),
  /** Objetivo de este paso derivado de la solicitud del usuario (inyectado en contexto del agente). */
  goal: z.string().optional(),
  /** 4.3 Least privilege: solo estas tools para este paso (nombres de tool). Si no se define, el nodo usa todas sus tools. */
  required_tools: z.array(z.string()).optional(),
});
export type MddPlanStep = z.infer<typeof mddPlanStepSchema>;

/**
 * Shared state for the MDD (Master Design Document) agent pipeline.
 * Input: dbgaContent (Benchmark & Gap Analysis). Output: mddDraft.
 * mddStructured is the source of truth when present; mddDraft is derived via mddStructuredToMarkdown.
 * Flow: Clarifier → Security Architect → Integration Engineer → Auditor → (score < 95 ? Clarifier : END).
 */
export const mddStateSchema = z.object({
  /** Input: Domain Benchmark & Gap Analysis markdown. */
  dbgaContent: z.string(),
  /** Clarified scope/requirements from Clarifier (feeds Security & Integration). */
  clarifiedScope: z.string(),
  /** Structured MDD (source of truth when present); markdown is derived from this. */
  mddStructured: mddStructuredSchema.optional(),
  /** Accumulated MDD document (each agent appends). Derived from mddStructured when present. */
  mddDraft: z.string(),
  /** Auditor quality score 0–100. If < 95, loop to Clarifier. */
  auditorScore: z.number().min(0).max(100),
  /** Feedback from Auditor when score < 95 (passed to Clarifier on loop). */
  auditorFeedback: z.string().optional(),
  /** Route: "clarifier" = loop with feedback, "done" = end. */
  auditorDecision: mddAuditorDecisionSchema.optional(),
  /** Loop counter: max iterations to avoid infinite cycle (e.g. 3). */
  mddIteration: z.number().int().min(0).optional(),
  /** Manager (Supervisor): preguntas para el usuario (generadas por Clarifier cuando requestQuestionsOnly). */
  managerQuestions: z.array(z.string()).optional(),
  /** Respuestas del usuario acumuladas (entrevista). */
  userInputAccumulated: z.string().optional(),
  /** Ronda de entrevista del Manager (0 = inicial). */
  managerRound: z.number().int().min(0).optional(),
  /** Último mensaje del usuario (para que el Manager responda o delegue). */
  lastUserMessage: z.string().optional(),
  /** Cuando true, Clarifier solo genera 2 preguntas para el usuario (no actualiza mddDraft). */
  requestQuestionsOnly: z.boolean().optional(),
  /** Cuando true, Clarifier acaba de generar preguntas; el grafo vuelve a Manager para interrupt. */
  clarifierJustGeneratedQuestions: z.boolean().optional(),
  /** Cuando true, ya se lanzó la pregunta inicial "¿Sobre qué tema o problema necesitas el MDD?" (Case 1); usado por ask_initial_topic para distinguir primera invocación vs resume. */
  askedInitialTopicQuestion: z.boolean().optional(),
  /** Cuando "clarifier_only", tras el Clarifier se fusiona solo la sección 1. Cuando "sections", solo se ejecutan los nodos en sectionsToRun. */
  delegateTarget: z.enum(["clarifier_only", "full_pipeline", "sections"]).optional(),
  /** Copia del mddDraft antes de delegar a Clarifier con delegateTarget=clarifier_only; se usa para fusionar solo sección 1. */
  previousMddDraftForMerge: z.string().optional(),
  /** Secuencia de nodos a ejecutar cuando delegateTarget="sections" (ej. ["software_architect", "security", "integration", ...]). */
  sectionsToRun: z.array(z.string()).optional(),
  /** Directiva concreta aceptada por el usuario (ej. "restricciones FK en todas las tablas"); el agente responsable debe aplicarla al MDD. */
  acceptedProposalDirective: z.string().optional(),
  /** Cuando un nodo falla (excepción/timeout), el servicio inyecta esto para que el Manager re-planifique al reanudar. */
  lastStepFailed: z
    .object({
      node: z.string().describe("Nombre del nodo que falló (ej. software_architect) o 'unknown'"),
      error: z.string().describe("Mensaje de error"),
    })
    .optional(),
  /** Plan estructurado (lista de pasos) generado al delegar; artefacto explícito para patrón Planner–Executor. */
  mddPlan: z.array(mddPlanStepSchema).optional(),
  /** Pendiente de aprobación humana (HITL 4.4): al reanudar con confirmación se ejecuta este plan. */
  pendingPlanApproval: z
    .object({
      mddPlan: z.array(mddPlanStepSchema),
      delegateTarget: z.enum(["clarifier_only", "full_pipeline", "sections"]),
      sectionsToRun: z.array(z.string()).optional(),
      previousMddDraftForMerge: z.string().optional(),
      goto: z.string(),
    })
    .optional(),
  /** Intención del usuario para este plan (rellenado al crear pendingPlanApproval); al confirmar se copia a acceptedProposalDirective. */
  planUserIntent: z.string().optional(),
  /** Modo Executor (Planner–Executor): el grafo ejecuta paso a paso según mddPlan; al terminar cada nodo vuelve al executor. */
  executorControlled: z.boolean().optional(),
  /** Índice del paso actual en mddPlan (0-based). El Executor avanza este valor tras cada paso. */
  mddPlanCurrentStep: z.number().int().min(-1).optional(),
  /** 4.3 Least privilege: solo estas tools para el paso actual (nombres). Lo setea el Executor antes de goto al nodo. */
  currentStepAllowedTools: z.array(z.string()).optional(),
  /** Goal del paso actual (del mddPlan); el agente lo recibe en su contexto. */
  currentStepGoal: z.string().optional(),
  /** Feedback del nodo Architect Critic cuando verdict === "gap"; el Software Architect lo usa para reintentar (una vez). */
  architectCriticFeedback: z.string().optional(),
  /** Número de veces que se ha pasado por Architect Critic en esta delegación (evita bucle infinito; máx. 1 reintento). */
  architectCriticAttempts: z.number().int().min(0).optional(),
});

export type MDDState = z.infer<typeof mddStateSchema>;

export const defaultMDDState: MDDState = {
  dbgaContent: "",
  clarifiedScope: "",
  mddStructured: undefined,
  mddDraft: "",
  auditorScore: 0,
  auditorFeedback: undefined,
  auditorDecision: undefined,
  mddIteration: 0,
  managerQuestions: undefined,
  userInputAccumulated: undefined,
  managerRound: 0,
  lastUserMessage: undefined,
  requestQuestionsOnly: undefined,
  clarifierJustGeneratedQuestions: undefined,
  askedInitialTopicQuestion: undefined,
  delegateTarget: undefined,
  previousMddDraftForMerge: undefined,
  sectionsToRun: undefined,
  acceptedProposalDirective: undefined,
  lastStepFailed: undefined,
  mddPlan: undefined,
  pendingPlanApproval: undefined,
  planUserIntent: undefined,
  executorControlled: undefined,
  mddPlanCurrentStep: undefined,
  currentStepAllowedTools: undefined,
  currentStepGoal: undefined,
  architectCriticFeedback: undefined,
  architectCriticAttempts: undefined,
};
