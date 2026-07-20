import {
  MDD_MAX_PLAN_DIRECTIVE_CHARS,
} from "@theforge/shared-types";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { Command, END, interrupt } from "@langchain/langgraph";
import type { LivePrecisionCalculator } from "../estimation/estimation.types.js";
import { MANAGER_MDD_PROMPT } from "../prompts/load-prompts.js";
import { mddStructuredToMarkdown } from "../render/mdd-structured-to-markdown.js";
import type { MDDStateType } from "../state/index.js";
import type { MddPlanStep } from "../state/mdd-state.schema.js";
import { getLastSubstantiveUserMessage, getPlanDirective, getUserBrief } from "../utils/mdd-user-brief.js";
import { parseJsonOrThrow } from "../utils/parse-json.js";
import { regenerateErDiagramFromSql } from "../utils/mdd-diagram-suggestions.js";
import {
  ensureContratosSection,
  hydrateStructuredFromDraft,
  logMddNodeOutput,
  finalizeMddDeliverable,
  normalizeMddFormat,
  replaceContextWhenOnlyMetadata,
  sanitizeContextKeyValueAndObject,
  sanitizeContextSection,
} from "../utils/mdd-sanitize.js";
import { reconcileUiUxDesignIntent } from "../utils/mdd-enrich-uiux-intent.js";
import { z } from "zod";
import { GraphMemoryService } from "../graph-memory/graph-memory.service.js";
import { generateImpactAnalysis } from "../utils/mdd-impact-analysis.js";
import { resolveCorrectionAgents } from "../utils/mdd-manager-routing.util.js";
import { detectLegacyIntegrationIntent, HANDOFF_SPEC_SUGGESTION } from "../utils/integration-intent.util.js";
import { getAgenticRagToolset } from "../tools/tool-registry.js";
import { runAgentToolsRound } from "../utils/mdd-agent-tools-invoke.js";
import type { ProjectsService } from "../../projects/projects.service.js";
import type { TheForgeService } from "../../theforge/theforge.service.js";
import type { AiService } from "../../ai/ai.service.js";
import {
  AUDITOR_RETRY_THRESHOLD,
  AUDIT_DOCUMENT_PATTERN,
  ASK_WHAT_NEEDED_FOR_85_PATTERN,
  FULL_MDD_REGENERATE_DIRECTIVE,
  MAX_MDD_ITERATIONS,
  PLAN_APPROVAL_CONFIRM_PATTERN,
  QUALITY_THRESHOLD,
  REFORMAT_DOCUMENT_PATTERN,
  REGENERATE_ER_DIAGRAM_PATTERN,
  USER_STOP_PATTERN,
  WORK_WITH_WHAT_WE_HAVE_PATTERN,
} from "./mdd-manager/manager-constants.js";
import { hasRealBenchmark, LOG, mddHasContent } from "./mdd-manager/manager-context.util.js";
import {
  agentsForMddSection,
  inferAgentsFromAuditorFeedback,
  inferSectionsFromMessage,
  looksLikeContextScopeOnlyRequest,
  looksLikeExplicitMddModificationRequest,
  looksLikeFullMddRegenerateRequest,
  looksLikeInitialTopic,
  looksLikeShortAgreement,
  parseRegenerateSectionNumber,
  replyClaimsDocumentWasModified,
  wantsToContinueRefining,
} from "./mdd-manager/manager-heuristics.js";
import {
  buildMddPlan,
  expandSectionsToRun,
  generateMddPlanWithLLM,
  managerPlanStepWithTools,
  NODE_TASK_DESCRIPTIONS,
} from "./mdd-manager/manager-plan.js";

export { expandSectionsToRun } from "./mdd-manager/manager-plan.js";
export type { ExpandSectionsToRunOptions } from "./mdd-manager/manager-plan.js";

/** Tools SDD + TheForge para `search_memory` (bindTools). */
export type MddManagerToolDeps = {
  projects: ProjectsService;
  theforge: TheForgeService;
  ai: AiService;
};

/** Schema para parse manual (discriminated union). */
const managerOutputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), reply: z.string() }),
  z.object({
    action: z.literal("delegate"),
    target: z.enum(["clarifier_only", "full_pipeline", "sections"]).optional(),
    sections: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("search_memory"),
    memorySearchQuery: z.string(),
  }),
]);

/**
 * Schema plano para structured output. OpenAI exige que 'required' incluya todas las propiedades;
 * no usar .optional() ni .default() o el JSON schema tendrá campos fuera de required y fallará.
 */
const managerStructuredOutputSchema = z.object({
  action: z.enum(["reply", "delegate", "search_memory"]).describe("reply = solo aclaración; delegate = ejecutar agentes; search_memory = buscar en grafo"),
  reply: z.string().describe("Si action es reply: respuesta breve al usuario; si delegate/search enviar cadena vacía"),
  target: z
    .enum(["clarifier_only", "full_pipeline", "sections"])
    .describe("clarifier_only = solo sección 1; full_pipeline = todo; sections = solo los listados en sections"),
  sections: z
    .array(z.string())
    .describe("Si target es sections: software_architect, security, integration; si no, array vacío"),
  memorySearchQuery: z
    .string()
    .describe("Si action es search_memory: la intención a buscar en el grafo (ej: 'auth con MFA'); si no, cadena vacía"),
});

/** Orden de agentes en el pipeline (sin Clarifier). Tras software_architect viene format_after_architect (y crítico si aplica). */
/**
 * Manager como Entrevistador de Estados (no pasapapeles).
 * Caso 1: Sin Bench ni MDD → no delegar; pregunta "¿Sobre qué tema o problema necesitas el MDD?"; al responder delega a agentes para v1; luego bucle refinamiento (preguntas del Clarifier).
 * Caso 2: MDD con contenido pero score < 85% → Manager asigna gaps a agentes; >= 85% cede al usuario.
 * Caso 3: Existe dbgaContent → delegar de inmediato a especialistas para v1; luego bucle refinamiento.
 * Done solo si Auditor >= 85% o usuario pide parar (umbral 85 = ceder intervención al usuario).
 * Si se pasa precisionCalculator, el % mostrado coincide con el semáforo (calculateLiveMetrics sobre mddDraft).
 */
export function createMddManagerNode(
  llm: BaseChatModel,
  graphMemory: GraphMemoryService,
  precisionCalculator?: LivePrecisionCalculator | null,
  toolDeps?: MddManagerToolDeps | null,
) {
  return async (state: MDDStateType): Promise<Partial<MDDStateType> | Command> => {
    const userMessage = (state.lastUserMessage ?? "").trim();
    const score = state.auditorScore ?? 0;
    const iteration = state.mddIteration ?? 0;
    LOG("entry lastUserMessage=%s mddDraftLen=%s auditorScore=%s", userMessage.slice(0, 80), (state.mddDraft ?? "").length, score);

    // Terminar solo sin mensaje nuevo (p. ej. vuelta del Executor). Con score alto el usuario
    // sigue pudiendo pedir cambios (Dokploy, stack, etc.); no cortar en END aquí.
    if (score >= QUALITY_THRESHOLD && !userMessage) {
      LOG("goto END (score >= 85, sin mensaje nuevo)");
      return new Command({ goto: END });
    }
    if (score < AUDITOR_RETRY_THRESHOLD) {
      LOG("score < 90% → segunda iteración con reporte de gaps");
    }
    if (USER_STOP_PATTERN.test(userMessage)) {
      LOG("goto END (usuario pidió detenerse)");
      return new Command({ goto: END });
    }
    if (iteration >= MAX_MDD_ITERATIONS) {
      LOG("goto END (máx. iteraciones=%s)", MAX_MDD_ITERATIONS);
      return new Command({ goto: END });
    }

    const pending = state.pendingPlanApproval;
    if (pending) {
      if (PLAN_APPROVAL_CONFIRM_PATTERN.test(userMessage)) {
        LOG("plan aprobado por usuario → Executor (paso a paso)");
        const accumulatedWithRequest = state.userInputAccumulated?.trim() ?? "";
        const dbgaWithRequest = state.dbgaContent?.trim() ?? "";
        const directive = state.planUserIntent ?? getLastSubstantiveUserMessage(state);
        const impact = state.impactSummary?.trim();
        let mergedDirective = directive?.trim() ?? "";
        if (impact && mergedDirective && !mergedDirective.includes(impact.slice(0, Math.min(80, impact.length)))) {
          mergedDirective = `${mergedDirective}\n\n---\n\n**Resumen de impacto (aprobado con el plan):**\n${impact}`;
        } else if (impact && !mergedDirective) {
          mergedDirective = `**Resumen de impacto (aprobado con el plan):**\n${impact}`;
        }
        const { mddPlan, delegateTarget, sectionsToRun, previousMddDraftForMerge } = pending;
        return new Command({
          update: {
            userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
            dbgaContent: dbgaWithRequest || state.dbgaContent,
            lastUserMessage: undefined,
            requestQuestionsOnly: delegateTarget === "clarifier_only",
            lastStepFailed: undefined,
            mddPlan,
            delegateTarget,
            sectionsToRun,
            previousMddDraftForMerge,
            pendingPlanApproval: undefined,
            planUserIntent: undefined,
            impactSummary: undefined,
            executorControlled: true,
            mddPlanCurrentStep: undefined,
            architectCriticFeedback: undefined,
            architectCriticAttempts: undefined,
            ...(mergedDirective ? { acceptedProposalDirective: mergedDirective } : {}),
          },
          goto: "executor",
        });
      }
      LOG("plan no aprobado, usuario respondió; re-entrando Manager sin plan pendiente");
      return new Command({ update: { pendingPlanApproval: undefined }, goto: "manager" });
    }

    const hasBench = hasRealBenchmark(state);
    const hasDraft = mddHasContent(state);
    const hasAccumulated = !!(state.userInputAccumulated?.trim());

    // Vuelta del executor sin mensaje nuevo: no generar otro plan ni preguntar de nuevo; terminar para que el usuario vea "MDD generado".
    if (!userMessage.trim() && hasDraft) {
      LOG("vuelta del executor sin mensaje nuevo → END (evitar segundo plan/segunda ejecución)");
      return new Command({ goto: END });
    }

    const regenSection = parseRegenerateSectionNumber(userMessage);
    if (hasDraft && regenSection !== null) {
      const agents = expandSectionsToRun(agentsForMddSection(regenSection));
      if (agents.length > 0) {
        const planDirective =
          [getPlanDirective(state), `Regenerar §${regenSection} del MDD según la petición del usuario.`]
            .filter(Boolean)
            .join("\n\n") || userMessage;
        const sectionsToRun = agents;
        const mddPlan = buildMddPlan("sections", sectionsToRun, getUserBrief(state), planDirective);
        LOG("regenerar §%s solicitado → Executor sections=%s", regenSection, sectionsToRun.join(","));
        return new Command({
          update: {
            lastUserMessage: undefined,
            requestQuestionsOnly: false,
            delegateTarget: "sections",
            sectionsToRun,
            mddPlan,
            executorControlled: true,
            mddPlanCurrentStep: undefined,
            acceptedProposalDirective: planDirective,
            pendingPlanApproval: undefined,
            planUserIntent: undefined,
            impactSummary: undefined,
          },
          goto: "executor",
        });
      }
    }

    // Comando "reformatea el documento": si hay mddStructured, re-renderizar; si no, normalizar mddDraft (sin LLM) y terminar.
    if (REFORMAT_DOCUMENT_PATTERN.test(userMessage) && hasDraft) {
      try {
        let formatted: string;
        if (state.mddStructured && typeof state.mddStructured === "object" && Object.keys(state.mddStructured).some((k) => state.mddStructured![k as keyof typeof state.mddStructured] != null)) {
          const hydrated = hydrateStructuredFromDraft(state.mddStructured, state.mddDraft ?? "");
          formatted = mddStructuredToMarkdown(hydrated);
        } else {
          const draft = (state.mddDraft ?? "").trim();
          formatted = await reconcileUiUxDesignIntent(
            finalizeMddDeliverable(
              normalizeMddFormat(
                ensureContratosSection(
                  replaceContextWhenOnlyMetadata(sanitizeContextKeyValueAndObject(sanitizeContextSection(draft))),
                ),
              ),
            ),
          );
        }
        logMddNodeOutput("Reformat", formatted);
        LOG("reformateo solicitado: documento actualizado, goto END");
        return new Command({
          update: { mddDraft: formatted, lastUserMessage: undefined },
          goto: END,
        });
      } catch (err) {
        LOG("reformateo error: %s", err instanceof Error ? err.message : String(err));
        return new Command({ goto: END });
      }
    }

    // Comando "regenerar diagrama ER desde el SQL": solo regenerar erDiagram de la sección 2 (sin LLM) y terminar.
    if (REGENERATE_ER_DIAGRAM_PATTERN.test(userMessage) && hasDraft) {
      const draft = (state.mddDraft ?? "").trim();
      try {
        const updated = regenerateErDiagramFromSql(draft);
        if (updated) {
          logMddNodeOutput("RegenerateER", updated);
          LOG("diagrama ER regenerado desde SQL, goto END");
          return new Command({
            update: { mddDraft: updated, lastUserMessage: undefined },
            goto: END,
          });
        }
        LOG("regenerar ER: sin CREATE TABLE en sección 2 o sin cambios");
        return new Command({ goto: END });
      } catch (err) {
        LOG("regenerar ER error: %s", err instanceof Error ? err.message : String(err));
        return new Command({ goto: END });
      }
    }

    if (hasDraft && userMessage && looksLikeFullMddRegenerateRequest(userMessage)) {
      const planDirective = [FULL_MDD_REGENERATE_DIRECTIVE, getPlanDirective(state)].filter(Boolean).join("\n\n");
      const clipped =
        planDirective.length > MDD_MAX_PLAN_DIRECTIVE_CHARS
          ? planDirective.slice(0, MDD_MAX_PLAN_DIRECTIVE_CHARS) + "…"
          : planDirective;
      const mddPlan = buildMddPlan("full_pipeline", undefined, getUserBrief(state), clipped);
      if (mddPlan.length > 0) {
        const accumulatedWithRequest = [state.userInputAccumulated?.trim(), `Petición: ${userMessage}`].filter(Boolean).join("\n\n---\n\n");
        const dbgaWithRequest = [state.dbgaContent?.trim(), `Petición: ${userMessage}`].filter(Boolean).join("\n\n");
        const impactSummary = await generateImpactAnalysis(llm, state, userMessage);
        LOG("regeneración completa MDD solicitada → plan_approval full_pipeline");
        return new Command({
          update: {
            userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
            dbgaContent: dbgaWithRequest || state.dbgaContent,
            lastUserMessage: undefined,
            requestQuestionsOnly: false,
            pendingPlanApproval: { mddPlan, delegateTarget: "full_pipeline", goto: "clarifier" },
            planUserIntent: clipped,
            impactSummary,
          },
          goto: "plan_approval",
        });
      }
    }

    // Caso 3: Basado en Benchmark (DBGA). Delegar de inmediato para generar v1; luego entra en bucle refinamiento.
    if (hasBench && !hasDraft) {
      LOG("Caso 3 (Benchmark): delegar a especialistas para v1");
      return new Command({
        update: {
          lastUserMessage: undefined,
          requestQuestionsOnly: false,
        },
        goto: "clarifier",
      });
    }

    // Caso 1: Inicio de proyecto (sin Bench ni MDD). Si el mensaje actual ya describe el tema → delegar; si no, preguntar tema.
    if (!hasBench && !hasDraft) {
      const messageIsTopic = userMessage && looksLikeInitialTopic(userMessage);
      if (messageIsTopic) {
        LOG("Caso 1 (Inicio): mensaje ya describe tema (len=%s) → delegar a Clarifier sin preguntar", userMessage.length);
        const dbgaWithRequest = [state.dbgaContent?.trim(), userMessage].filter(Boolean).join("\n\n");
        return new Command({
          update: {
            userInputAccumulated: state.userInputAccumulated?.trim() || userMessage,
            dbgaContent: dbgaWithRequest || userMessage,
            lastUserMessage: undefined,
            requestQuestionsOnly: false,
          },
          goto: "clarifier",
        });
      }
      if (!hasAccumulated) {
        LOG("Caso 1 (Inicio): sin respuesta inicial → ask_initial_topic");
        return new Command({ goto: "ask_initial_topic" });
      }
      LOG("Caso 1: usuario ya respondió tema → delegar a Clarifier para v1");
      const accumulatedWithRequest = [state.userInputAccumulated?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n---\n\n");
      const dbgaWithRequest = [state.dbgaContent?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n");
      return new Command({
        update: {
          userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
          dbgaContent: dbgaWithRequest || state.dbgaContent,
          lastUserMessage: undefined,
          requestQuestionsOnly: false,
        },
        goto: "clarifier",
      });
    }

    // HITL 4.4: reanudación tras aprobación del plan. Usuario aprobó (ejecutar) o rechazó (modificar → Clarifier).
    if (state.pendingPlanApproval && state.lastUserMessage?.trim()) {
      const approved = PLAN_APPROVAL_CONFIRM_PATTERN.test(state.lastUserMessage.trim());
      const { mddPlan, delegateTarget, sectionsToRun, previousMddDraftForMerge } = state.pendingPlanApproval;
      const accumulatedWithRequest = approved
        ? state.userInputAccumulated?.trim() ?? ""
        : [state.userInputAccumulated?.trim(), state.lastUserMessage ? `Usuario: ${state.lastUserMessage}` : ""]
            .filter(Boolean)
            .join("\n\n---\n\n");
      const dbgaWithRequest = approved
        ? state.dbgaContent?.trim() ?? ""
        : [state.dbgaContent?.trim(), state.lastUserMessage ? `Usuario: ${state.lastUserMessage}` : ""]
            .filter(Boolean)
            .join("\n\n");
      if (approved) {
        LOG("plan aprobado por usuario → Executor (paso a paso)");
        const directive = state.planUserIntent ?? getLastSubstantiveUserMessage(state);
        return new Command({
          update: {
            pendingPlanApproval: undefined,
            planUserIntent: undefined,
            lastUserMessage: undefined,
            userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
            dbgaContent: dbgaWithRequest || state.dbgaContent,
            mddPlan,
            delegateTarget,
            sectionsToRun,
            previousMddDraftForMerge,
            executorControlled: true,
            mddPlanCurrentStep: undefined,
            architectCriticFeedback: undefined,
            architectCriticAttempts: undefined,
            ...(directive ? { acceptedProposalDirective: directive } : {}),
          },
          goto: "executor",
        });
      }
      LOG("usuario pidió modificar plan → delegar a Clarifier");
      return new Command({
        update: {
          pendingPlanApproval: undefined,
          lastUserMessage: undefined,
          userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
          dbgaContent: dbgaWithRequest || state.dbgaContent,
          requestQuestionsOnly: false,
        },
        goto: "clarifier",
      });
    }

    // PRIMERO: si el Clarifier acaba de generar preguntas, mostrarlas e interrumpir (si no, volveríamos a pedir preguntas y bucle infinito).
    if (state.clarifierJustGeneratedQuestions === true && Array.isArray(state.managerQuestions) && state.managerQuestions.length > 0) {
      const questions = state.managerQuestions.slice(0, 1);
      // Resume: si lastUserMessage ya trae la respuesta del usuario (inyectada por Command.update al reanudar), usarla y delegar sin interrumpir de nuevo.
      const resumeAnswer =
        state.lastUserMessage?.trim() && state.lastUserMessage.trim().length >= 5
          ? state.lastUserMessage.trim()
          : null;
      if (resumeAnswer) {
        LOG("resume: respuesta del usuario presente (len=%s) → plan_approval y luego Executor", resumeAnswer.length);
        const round = (state.managerRound ?? 0) + 1;
        const newAccumulated = [state.userInputAccumulated?.trim(), resumeAnswer].filter(Boolean).join("\n\n---\n\n");
        const newDbgaContent = [state.dbgaContent?.trim(), `Respuesta del usuario (ronda ${round}):\n${resumeAnswer}`].filter(Boolean).join("\n\n");
        const planDirective = getPlanDirective(state);
        const mddPlan = buildMddPlan("full_pipeline", undefined, getUserBrief(state), planDirective);
        if (mddPlan.length > 0) {
          const impactSummary = await generateImpactAnalysis(llm, state, resumeAnswer);
          return new Command({
            update: {
              managerQuestions: undefined,
              managerRound: round,
              userInputAccumulated: newAccumulated,
              dbgaContent: newDbgaContent,
              clarifierJustGeneratedQuestions: false,
              lastUserMessage: undefined,
              requestQuestionsOnly: false,
              pendingPlanApproval: { mddPlan, delegateTarget: "full_pipeline", goto: "clarifier" },
              planUserIntent: planDirective,
              impactSummary,
            },
            goto: "plan_approval",
          });
        }
        return new Command({
          update: {
            managerQuestions: undefined,
            managerRound: round,
            userInputAccumulated: newAccumulated,
            dbgaContent: newDbgaContent,
            clarifierJustGeneratedQuestions: false,
            lastUserMessage: undefined,
          },
          goto: "clarifier",
        });
      }
      const precision =
        precisionCalculator && (state.mddDraft ?? "").trim()
          ? precisionCalculator.calculateLiveMetrics(state.mddDraft, {
            auditorGaps: state.auditorGaps ?? undefined,
            complexity: state.mddComplexity,
            projectId: state.projectId,
            stageId: state.activeStageId ?? null,
          }).precision
          : (state.auditorScore ?? 0);
      const directiveReply =
        "Estamos al " +
        precision +
        "%. Para avanzar al 85%, necesito que definamos los siguientes puntos.\n\n" +
        questions.join("\n\n");
      LOG("interrupt questions (Clarifier) count=%s con mensaje directivo", questions.length);
      const userAnswer = interrupt({ type: "questions", questions, reply: directiveReply });
      const answerText = typeof userAnswer === "string" ? userAnswer : String(userAnswer ?? "").trim();
      const round = (state.managerRound ?? 0) + 1;
      const newAccumulated = [state.userInputAccumulated?.trim(), answerText].filter(Boolean).join("\n\n---\n\n");
      const newDbgaContent = [state.dbgaContent?.trim(), `Respuesta del usuario (ronda ${round}):\n${answerText}`].filter(Boolean).join("\n\n");
      return new Command({
        update: {
          managerQuestions: undefined,
          managerRound: round,
          userInputAccumulated: newAccumulated,
          dbgaContent: newDbgaContent,
          clarifierJustGeneratedQuestions: false,
          lastUserMessage: undefined,
          requestQuestionsOnly: false,
        },
        goto: "clarifier",
      });
    }

    // Patrón Planner–Executor: toda delegación pasa por plan → plan_approval → executor. Sin atajos.

    // Usuario pide seguir refinando → plan (full_pipeline) y aprobación.
    if (hasDraft && score < QUALITY_THRESHOLD && userMessage && wantsToContinueRefining(userMessage)) {
      const planDirective = getPlanDirective(state);
      const mddPlan = buildMddPlan("full_pipeline", undefined, getUserBrief(state), planDirective);
      if (mddPlan.length > 0) {
        const accumulatedWithRequest = [state.userInputAccumulated?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n---\n\n");
        const dbgaWithRequest = [state.dbgaContent?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n");
        const impactSummary = await generateImpactAnalysis(llm, state, userMessage);
        LOG("Seguir refinando → plan_approval mddPlanLen=%s", mddPlan.length);
        return new Command({
          update: {
            userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
            dbgaContent: dbgaWithRequest || state.dbgaContent,
            lastUserMessage: undefined,
            requestQuestionsOnly: false,
            pendingPlanApproval: { mddPlan, delegateTarget: "full_pipeline", goto: "clarifier" },
            planUserIntent: planDirective,
            impactSummary,
          },
          goto: "plan_approval",
        });
      }
    }

    // Usuario responde con acuerdo breve al feedback del auditor → plan (sections) y aprobación.
    if (hasDraft && score < QUALITY_THRESHOLD && userMessage && looksLikeShortAgreement(userMessage) && state.auditorFeedback?.trim()) {
      const directive = state.auditorFeedback.trim();
      const sectionsToRun = expandSectionsToRun(
        resolveCorrectionAgents(state.auditorGaps, state.auditorFeedback, inferAgentsFromAuditorFeedback),
      );
      const planDirective = getPlanDirective(state);
      const mddPlan = buildMddPlan("sections", sectionsToRun, getUserBrief(state), planDirective);
      if (mddPlan.length > 0) {
        const accumulatedWithRequest = [state.userInputAccumulated?.trim(), userMessage ? `Usuario: ${userMessage}` : ""].filter(Boolean).join("\n\n---\n\n");
        const dbgaWithRequest = [state.dbgaContent?.trim(), userMessage ? `Usuario: ${userMessage}` : ""].filter(Boolean).join("\n\n");
        const impactSummary = await generateImpactAnalysis(llm, state, directive);
        LOG("Acuerdo breve → plan_approval sections=%s", sectionsToRun.join(", "));
        return new Command({
          update: {
            userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
            dbgaContent: dbgaWithRequest || state.dbgaContent,
            lastUserMessage: undefined,
            requestQuestionsOnly: false,
            delegateTarget: "sections",
            sectionsToRun,
            acceptedProposalDirective: directive,
            pendingPlanApproval: { mddPlan, delegateTarget: "sections", sectionsToRun, goto: sectionsToRun[0] },
            planUserIntent: planDirective,
            impactSummary,
          },
          goto: "plan_approval",
        });
      }
    }

    // Refinamiento obligatorio: score < 85% y sin mensaje → agentes según critical_gaps o Clarifier.
    if (hasDraft && score < QUALITY_THRESHOLD && !userMessage) {
      const correctionAgents = resolveCorrectionAgents(
        state.auditorGaps,
        state.auditorFeedback,
        inferAgentsFromAuditorFeedback,
      );
      const hasStructuredGaps = (state.auditorGaps?.critical_gaps?.length ?? 0) > 0;
      const useSections = hasStructuredGaps && !correctionAgents.every((a) => a === "clarifier");
      const sectionsToRun = useSections ? expandSectionsToRun(correctionAgents) : undefined;
      const delegateTarget = useSections ? ("sections" as const) : ("clarifier_only" as const);
      const mddPlan = buildMddPlan(delegateTarget, sectionsToRun, getUserBrief(state), getPlanDirective(state));
      if (mddPlan.length > 0) {
        const impactSummary = state.auditorFeedback
          ? await generateImpactAnalysis(llm, state, state.auditorFeedback)
          : "";
        LOG(
          "Refinamiento gaps → plan_approval delegate=%s sections=%s",
          delegateTarget,
          sectionsToRun?.join(",") ?? "clarifier",
        );
        return new Command({
          update: {
            requestQuestionsOnly: !useSections,
            delegateTarget,
            sectionsToRun,
            previousMddDraftForMerge: state.mddDraft ?? "",
            acceptedProposalDirective: state.auditorFeedback?.trim() || undefined,
            pendingPlanApproval: {
              mddPlan,
              delegateTarget,
              sectionsToRun,
              previousMddDraftForMerge: state.mddDraft ?? "",
              goto: useSections ? sectionsToRun![0] : "clarifier",
            },
            planUserIntent: getPlanDirective(state),
            impactSummary,
          },
          goto: "plan_approval",
        });
      }
      const fallbackPlan: MddPlanStep[] = useSections
        ? sectionsToRun!.map((node, i) =>
            managerPlanStepWithTools(node, String(i + 1), NODE_TASK_DESCRIPTIONS[node as keyof typeof NODE_TASK_DESCRIPTIONS] ?? node),
          )
        : [
            managerPlanStepWithTools("clarifier", "1", NODE_TASK_DESCRIPTIONS.clarifier),
            { step_id: "2", node: "merge_section1_only", task_description: NODE_TASK_DESCRIPTIONS.merge_section1_only },
          ];
      LOG("Refinamiento fallback → plan_approval delegate=%s", delegateTarget);
      return new Command({
        update: {
          requestQuestionsOnly: !useSections,
          delegateTarget,
          sectionsToRun,
          previousMddDraftForMerge: state.mddDraft ?? "",
          acceptedProposalDirective: state.auditorFeedback?.trim() || undefined,
          pendingPlanApproval: {
            mddPlan: fallbackPlan,
            delegateTarget,
            sectionsToRun,
            previousMddDraftForMerge: state.mddDraft ?? "",
            goto: useSections ? sectionsToRun![0] : "clarifier",
          },
          planUserIntent: getPlanDirective(state),
        },
        goto: "plan_approval",
      });
    }

    // Usuario pregunta qué falta para llegar al 85% → responder con auditorFeedback si existe (no mensaje genérico).
    const askingWhatNeededFor85 =
      userMessage &&
      ASK_WHAT_NEEDED_FOR_85_PATTERN.test(userMessage.trim()) &&
      hasDraft &&
      score < QUALITY_THRESHOLD;
    if (askingWhatNeededFor85 && state.auditorFeedback?.trim()) {
      const precision =
        precisionCalculator && (state.mddDraft ?? "").trim()
          ? precisionCalculator.calculateLiveMetrics(state.mddDraft, {
            auditorGaps: state.auditorGaps ?? undefined,
            complexity: state.mddComplexity,
            projectId: state.projectId,
            stageId: state.activeStageId ?? null,
          }).precision
          : score;
      const replyContent =
        "Estamos al " +
        precision +
        "%. Para avanzar al 85%, necesitamos:\n\n" +
        state.auditorFeedback.trim() +
        "\n\n¿Quieres que avancemos con estos puntos? Responde validando o indicando cambios concretos.";
      LOG("interrupt reply (qué falta para 85%, con auditorFeedback)");
      const resumeValue = interrupt({ type: "reply", reply: replyContent });
      const newMsg = typeof resumeValue === "string" ? resumeValue : String(resumeValue ?? "").trim();
      return new Command({
        update: { lastUserMessage: newMsg },
        goto: "manager",
      });
    }

    // "Audita el documento" → plan [auditor] y aprobación (patrón exclusivo).
    const trimmedMsg = userMessage?.trim() ?? "";
    if (hasDraft && trimmedMsg && AUDIT_DOCUMENT_PATTERN.test(trimmedMsg) && trimmedMsg.length <= 120) {
      const mddPlan: MddPlanStep[] = [
        managerPlanStepWithTools("auditor", "1", NODE_TASK_DESCRIPTIONS.auditor),
      ];
      LOG("usuario pidió auditar → plan_approval (1 paso: auditor)");
      const impactSummary = await generateImpactAnalysis(llm, state, userMessage);
      return new Command({
        update: {
          lastUserMessage: undefined,
          pendingPlanApproval: { mddPlan, delegateTarget: "sections", sectionsToRun: ["auditor"], goto: "auditor" },
          planUserIntent: getPlanDirective(state),
          impactSummary,
        },
        goto: "plan_approval",
      });
    }

    // "Solo contexto y alcance" → plan clarifier_only y aprobación.
    if (hasDraft && userMessage && looksLikeContextScopeOnlyRequest(userMessage)) {
      const planDirective = getPlanDirective(state);
      const mddPlan = buildMddPlan("clarifier_only", undefined, getUserBrief(state), planDirective);
      if (mddPlan.length > 0) {
        const accumulatedWithRequest = [state.userInputAccumulated?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n---\n\n");
        const dbgaWithRequest = [state.dbgaContent?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n");
        const impactSummary = await generateImpactAnalysis(llm, state, userMessage);
        LOG("solo contexto y alcance → plan_approval mddPlanLen=%s", mddPlan.length);
        return new Command({
          update: {
            userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
            dbgaContent: dbgaWithRequest || state.dbgaContent,
            lastUserMessage: undefined,
            requestQuestionsOnly: false,
            delegateTarget: "clarifier_only",
            previousMddDraftForMerge: state.mddDraft ?? "",
            pendingPlanApproval: { mddPlan, delegateTarget: "clarifier_only", previousMddDraftForMerge: state.mddDraft ?? "", goto: "clarifier" },
            planUserIntent: planDirective,
            impactSummary,
          },
          goto: "plan_approval",
        });
      }
    }

    // Sin fallbacks: mensajes de corrección/cambios pasan al LLM → plan → plan_approval → executor.

    // Cambio explícito (p. ej. «no Kubernetes, usar Dokploy»): plan + impacto aunque el mensaje sea corto.
    if (hasDraft && userMessage && looksLikeExplicitMddModificationRequest(userMessage)) {
      const planDirective = getPlanDirective(state);
      const minimalPlan = { tail: "minimal" as const };
      let sectionsToRun = expandSectionsToRun(inferSectionsFromMessage(userMessage), minimalPlan);
      if (sectionsToRun.length === 0) {
        sectionsToRun = expandSectionsToRun(["software_architect", "security", "integration"], minimalPlan);
      }
      let mddPlan = await generateMddPlanWithLLM(llm, state, "sections", sectionsToRun);
      if (!mddPlan.length) {
        mddPlan = buildMddPlan("sections", sectionsToRun, getUserBrief(state), planDirective);
      }
      if (mddPlan.length > 0) {
        const accumulatedWithRequest = [state.userInputAccumulated?.trim(), `Petición: ${userMessage}`]
          .filter(Boolean)
          .join("\n\n---\n\n");
        const dbgaWithRequest = [state.dbgaContent?.trim(), `Petición: ${userMessage}`]
          .filter(Boolean)
          .join("\n\n");
        const impactSummary = await generateImpactAnalysis(llm, state, userMessage);
        LOG(
          "cambio explícito MDD (stack/infra) → plan_approval sections=%s",
          sectionsToRun.join(","),
        );
        return new Command({
          update: {
            userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
            dbgaContent: dbgaWithRequest || state.dbgaContent,
            lastUserMessage: undefined,
            managerQuestions: undefined,
            requestQuestionsOnly: false,
            pendingPlanApproval: {
              mddPlan,
              delegateTarget: "sections",
              sectionsToRun,
              previousMddDraftForMerge: state.mddDraft ?? "",
              goto: sectionsToRun[0],
            },
            planUserIntent: planDirective,
            impactSummary,
          },
          goto: "plan_approval",
        });
      }
    }

    // Petición sustancial que describe qué hacer (modelo de datos, roles, API, seguridad, etc.) → generar plan solo con agentes involucrados y mostrar para aprobar.
    const substantialRequest =
      userMessage &&
      userMessage.trim().length >= 120 &&
      inferSectionsFromMessage(userMessage + " " + (state.userInputAccumulated ?? "")).length > 0;
    if (substantialRequest) {
      const stateForDirective: MDDStateType = {
        ...state,
        userInputAccumulated: [state.userInputAccumulated?.trim(), userMessage ? `Usuario: ${userMessage}` : ""].filter(Boolean).join("\n\n---\n\n"),
      };
      const planDirective = getPlanDirective(stateForDirective);
      let sectionsToRun = expandSectionsToRun(
        inferSectionsFromMessage(userMessage + " " + (state.userInputAccumulated ?? "")),
      );
      if (sectionsToRun.length === 0) sectionsToRun = expandSectionsToRun(["software_architect"]);
      let mddPlan = await generateMddPlanWithLLM(llm, stateForDirective, "sections", sectionsToRun);
      if (!mddPlan.length) mddPlan = buildMddPlan("sections", sectionsToRun, undefined, planDirective);
      if (mddPlan.length > 0) {
        const accumulatedWithRequest = stateForDirective.userInputAccumulated ?? state.userInputAccumulated;
        const dbgaWithRequest = [state.dbgaContent?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n");
        const impactSummary = await generateImpactAnalysis(llm, state, userMessage);
        LOG("petición sustancial (len=%s) → plan sections=%s, goto plan_approval", userMessage!.trim().length, sectionsToRun.join(","));
        return new Command({
          update: {
            userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
            dbgaContent: dbgaWithRequest || state.dbgaContent,
            lastUserMessage: undefined,
            managerQuestions: undefined,
            requestQuestionsOnly: false,
            pendingPlanApproval: { mddPlan, delegateTarget: "sections", sectionsToRun, goto: sectionsToRun[0] },
            planUserIntent: planDirective,
            impactSummary,
          },
          goto: "plan_approval",
        });
      }
    }

    // Usuario dice "ya trabaje" / "no tengo más" / "ejecuta" → plan con lo acumulado (solo agentes involucrados) y mostrar para aprobar.
    const workWithWhatWeHave =
      userMessage &&
      WORK_WITH_WHAT_WE_HAVE_PATTERN.test(userMessage.trim()) &&
      (hasAccumulated || hasDraft);
    if (workWithWhatWeHave) {
      const planDirective = getPlanDirective(state);
      const textForSections = (state.userInputAccumulated ?? "") + " " + (state.clarifiedScope ?? "");
      let sectionsToRun = expandSectionsToRun(inferSectionsFromMessage(textForSections));
      if (sectionsToRun.length === 0) sectionsToRun = expandSectionsToRun(["software_architect"]);
      let mddPlan = await generateMddPlanWithLLM(llm, state, "sections", sectionsToRun);
      if (!mddPlan.length) mddPlan = buildMddPlan("sections", sectionsToRun, getUserBrief(state), planDirective);
      if (mddPlan.length > 0) {
        const accumulatedWithRequest = [state.userInputAccumulated?.trim(), userMessage ? `Usuario: ${userMessage}` : ""].filter(Boolean).join("\n\n---\n\n");
        const impactSummary = await generateImpactAnalysis(llm, state, userMessage);
        LOG("usuario dijo 'ya trabaje' / ejecuta (len=%s) → plan sections=%s, goto plan_approval", userMessage!.trim().length, sectionsToRun.join(","));
        return new Command({
          update: {
            userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
            lastUserMessage: undefined,
            requestQuestionsOnly: false,
            pendingPlanApproval: { mddPlan, delegateTarget: "sections", sectionsToRun, goto: sectionsToRun[0] },
            planUserIntent: planDirective,
            impactSummary,
          },
          goto: "plan_approval",
        });
      }
    }

    // Usuario acaba de responder a preguntas que hicimos (respuesta sustancial) → delegar para incorporar al documento, no volver a preguntar.
    const justAnsweredQuestions =
      hasDraft &&
      (state.managerQuestions?.length ?? 0) > 0 &&
      userMessage &&
      userMessage.trim().length >= 80;
    if (justAnsweredQuestions) {
      const planDirective = getPlanDirective(state);
      const mddPlan = buildMddPlan("full_pipeline", undefined, getUserBrief(state), planDirective);
      if (mddPlan.length > 0) {
        const accumulatedWithRequest = [state.userInputAccumulated?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n---\n\n");
        const dbgaWithRequest = [state.dbgaContent?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n");
        const impactSummary = await generateImpactAnalysis(llm, state, userMessage);
        LOG("usuario respondió con sustancia a nuestras preguntas (len=%s) → delegate (no más preguntas)", userMessage!.trim().length);
        return new Command({
          update: {
            userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
            dbgaContent: dbgaWithRequest || state.dbgaContent,
            lastUserMessage: undefined,
            managerQuestions: undefined,
            requestQuestionsOnly: false,
            clarifierJustGeneratedQuestions: false,
            pendingPlanApproval: { mddPlan, delegateTarget: "full_pipeline", goto: "clarifier" },
            planUserIntent: planDirective,
            impactSummary,
          },
          goto: "plan_approval",
        });
      }
    }

    // Respuesta conversacional o delegar según LLM. Usamos structured output cuando el modelo lo soporta
    // para que la API obligue a devolver JSON válido (action + reply/target/sections) y no caigamos en
    // "reply" por defecto cuando el parse falla (texto libre, markdown, etc.).
    const round = (state.managerRound ?? 0) + 1;
    const userBrief = getUserBrief(state);
    const context = [
      "**Contexto:**",
      userBrief ? `**Objetivo del usuario (resumen):** ${userBrief}\n` : "",
      hasBench ? `**Benchmark (DBGA):**\n${(state.dbgaContent ?? "").trim().slice(0, 4000)}${(state.dbgaContent ?? "").length > 4000 ? "…" : ""}` : "**Benchmark:** No hay. El usuario indicó tema; los agentes generan/refinan el MDD.",
      state.userInputAccumulated?.trim() ? `\n**Respuestas del usuario:**\n${state.userInputAccumulated.trim()}` : "",
      state.mddDraft?.trim() ? `\n**Borrador MDD (completo):**\n${state.mddDraft.slice(0, 12_000)}${state.mddDraft.length > 12_000 ? "\n\n...(truncado, las últimas secciones pueden estar omitidas)" : ""}` : "",
      state.auditorFeedback?.trim() ? `\n**Feedback del Auditor:**\n${state.auditorFeedback.trim()}` : "",
      state.episodicMemoryContext?.trim()
        ? `\n**Memoria episódica (evaluador / reflexión — no ignores si pide corregir contratos o código):**\n${state.episodicMemoryContext.trim().slice(0, 4000)}${(state.episodicMemoryContext?.length ?? 0) > 4000 ? "…" : ""}`
        : "",
      state.lastStepFailed
        ? `\n**Falló un paso anterior:** nodo "${state.lastStepFailed.node}": ${state.lastStepFailed.error}. El usuario reanudó para re-planificar. Decide si reintentar (delegate a ese nodo o pipeline), omitir o pedir aclaración (reply).`
        : "",
      userMessage
        ? `\n**Mensaje actual:**\n${userMessage}\n\n**Instrucción:** Clasifica en una de las intenciones del prompt.\n\n**REGLAS PARA PREGUNTAS:** Si el usuario pregunta "para qué", "por qué", "qué es", "cómo funciona", "dónde se usa" o cualquier pregunta factual sobre el contenido del MDD (tecnologías, tablas, endpoints, infraestructura), responde con "reply" — es una consulta informativa, NO un cambio. No trates preguntas como solicitudes de modificación.\n\n**REGLAS PARA CAMBIOS Y CORRECCIONES:**\n- Si el mensaje describe una **necesidad** (pantalla, tabla, endpoint, flujo, MFA, etc.) que afecta a uno o más agentes → target: "sections"\n- Si el mensaje hace una **corrección** sobre contenido que YA EXISTE en el Borrador MDD (ej. "cambia X por Y", "te faltó Z", "en la sección N.N usa W") → DELEGA a clarifier o sections. No respondas con reply. El usuario está corrigiendo el documento, no preguntando.\n- Si el usuario menciona una sección específica (ej. "sección 2.1" o "§2.1") → DELEGA inmediatamente. El usuario está señalando contenido existente que debe modificarse.\n- Si es solo aclaración → "reply"\n- Si es confirmar o información amplia → "delegate" (pipeline completo)\n- Si el usuario **acaba de responder** a preguntas que hiciste (mensaje con contenido concreto, no solo "sí"/"no") → **delega** para incorporar su respuesta al documento; no hagas otra pregunta de seguimiento.\n- Si el mensaje es corto y usa "lo", "eso", "elimínenlo" y en Respuestas del usuario o en el Borrador se mencionó algo concreto (ej. Kubernetes, una tecnología) → **delega** con esa directiva; no respondas pidiendo "qué especificar" o "qué eliminar".\n- Ante la duda, "reply".`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `${MANAGER_MDD_PROMPT}\n\n---\nRonda ${round}.\n\n${context}`;
    let messages: HumanMessage[] = [new HumanMessage(prompt)];
    let action: "reply" | "delegate" | "search_memory" = "reply";
    let replyContent = "¿En qué más puedo ayudarte con el MDD? Puedes pedir refinamientos o revisar el documento.";
    let delegateTarget: "clarifier_only" | "full_pipeline" | "sections" | undefined;
    let sectionsToRun: string[] | undefined;
    let memoryQuery: string | undefined;

    const useStructuredOutput =
      "withStructuredOutput" in llm && typeof (llm as { withStructuredOutput?: (schema: unknown, config?: unknown) => unknown }).withStructuredOutput === "function";

    // Loop interno para búsqueda de memoria (max 1 salto)
    for (let i = 0; i < 2; i++) {
      if (useStructuredOutput) {
        try {
          const runnable = (llm as { withStructuredOutput(schema: unknown, config?: unknown): { invoke(input: unknown): Promise<unknown> } }).withStructuredOutput(
            managerStructuredOutputSchema,
            { method: "function_calling", strict: true },
          );
          const parsed = (await runnable.invoke(messages)) as z.infer<typeof managerStructuredOutputSchema>;
          action = parsed.action;
          if (parsed.action === "reply" && parsed.reply?.trim()) replyContent = parsed.reply.trim();
          if (parsed.action === "delegate") {
            delegateTarget = parsed.target;
            if (parsed.target === "sections" && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
              sectionsToRun = expandSectionsToRun(parsed.sections);
            }
          }
          if (parsed.action === "search_memory") {
            memoryQuery = parsed.memorySearchQuery;
          }
        } catch (err) {
          LOG("structured output falló, fallback a invoke+parse: %s", err instanceof Error ? err.message : String(err));
          const response = await llm.invoke(messages);
          const text = typeof response.content === "string" ? response.content : "";
          if (text.trim()) {
            try {
              const parsed = parseJsonOrThrow(text, managerOutputSchema);
              action = parsed.action;
              if (parsed.action === "reply" && parsed.reply?.trim()) replyContent = parsed.reply.trim();
              if (parsed.action === "delegate" && "target" in parsed) {
                delegateTarget = parsed.target;
                if (parsed.target === "sections" && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
                  sectionsToRun = expandSectionsToRun(parsed.sections);
                }
              }
              if (parsed.action === "search_memory") {
                memoryQuery = parsed.memorySearchQuery;
              }
            } catch { /* keep defaults */ }
          }
        }
      } else {
        const response = await llm.invoke(messages);
        const text = typeof response.content === "string" ? response.content : "";
        if (text.trim()) {
          try {
            const parsed = parseJsonOrThrow(text, managerOutputSchema);
            action = parsed.action;
            if (parsed.action === "reply" && parsed.reply?.trim()) replyContent = parsed.reply.trim();
            if (parsed.action === "delegate" && "target" in parsed) {
              delegateTarget = parsed.target;
              if (parsed.target === "sections" && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
                sectionsToRun = expandSectionsToRun(parsed.sections);
              }
            }
            if (parsed.action === "search_memory") {
              memoryQuery = parsed.memorySearchQuery;
            }
          } catch { /* keep defaults */ }
        }
      }

      if (action === "search_memory" && memoryQuery && i < 2) {
        LOG("ejecutando búsqueda en memoria semántica: %s", memoryQuery);
        const [projects, decisions] = await Promise.all([
          graphMemory.searchSimilarProjects(memoryQuery),
          graphMemory.searchSimilarDecisions(memoryQuery)
        ]);

        let memoryContext = "";
        if (projects && projects.length > 0) {
          memoryContext += "### Proyectos Similares:\n" +
            projects.map((r: any) => `- Proyecto: ${r.title} (ID: ${r.id})\n  Tablas: ${r.tables.join(", ")}\n  Endpoints: ${r.endpoints.join(", ")}`).join("\n") + "\n\n";
        }
        if (decisions && decisions.length > 0) {
          memoryContext += "### Decisiones Arquitectónicas (ADRs) Relevantes:\n" +
            decisions.map((d: any) => `- **${d.title}** (Proyecto: ${d.projectTitle})\n  Contexto: ${d.context}\n  Consecuencia: ${d.consequence}`).join("\n") + "\n";
        }

        if (!memoryContext) memoryContext = "No se encontraron proyectos o decisiones previas similares.";

        if (toolDeps && state.projectId?.trim() && memoryQuery) {
          try {
            const tools = getAgenticRagToolset(
              graphMemory,
              toolDeps.projects,
              toolDeps.theforge,
              toolDeps.ai,
              state.projectId.trim(),
              {
                legacy: state.isLegacyProject === true,
                theforgeProjectId: state.theforgeProjectId?.trim() ?? null,
                activeStageId: state.activeStageId?.trim() ?? undefined,
              },
            );
            if (tools.length > 0) {
              const toolSummary = await runAgentToolsRound(llm, tools, memoryQuery);
              memoryContext += "\n\n### Herramientas Grafo SDD / TheForge (query_sdd_graph, patch, MCP):\n" + toolSummary;
            }
          } catch (err) {
            memoryContext += `\n\n(Error ejecutando herramientas agénticas: ${err instanceof Error ? err.message : String(err)})`;
          }
        }

        messages.push(new HumanMessage(`[Resultados de búsqueda en memoria semántica para "${memoryQuery}"]:\n${memoryContext}\n\nInstrucción: Usa esta información para decidir la mejor arquitectura o delegación.`));
        continue;
      }
      break;
    }

    LOG("action=%s delegateTarget=%s sectionsToRun=%s", action, delegateTarget, sectionsToRun?.length);

    if (
      action === "reply" &&
      userMessage &&
      hasDraft &&
      looksLikeExplicitMddModificationRequest(userMessage)
    ) {
      LOG("reply anulado: cambio explícito MDD → forzar delegate/sections");
      action = "delegate";
      delegateTarget = "sections";
      sectionsToRun = expandSectionsToRun(inferSectionsFromMessage(userMessage));
      if (sectionsToRun.length === 0) {
        sectionsToRun = expandSectionsToRun(["software_architect", "security", "integration"]);
      }
    }

    if (
      action === "reply" &&
      replyContent &&
      replyClaimsDocumentWasModified(replyContent)
    ) {
      LOG("reply anulado: afirma cambios en el MDD sin ejecutar agentes → forzar delegate/sections");
      action = "delegate";
      delegateTarget = "sections";
      const hint = [userMessage ?? "", replyContent].filter(Boolean).join(" ");
      sectionsToRun = expandSectionsToRun(inferSectionsFromMessage(hint));
      if (sectionsToRun.length === 0) {
        sectionsToRun = expandSectionsToRun(["software_architect", "security", "integration"]);
      }
      replyContent = "";
    }

    if (action === "reply") {
      // Prepared hook: surface IntegrationAgent (handoff-spec) when a legacy integration need is detected.
      if (
        state.isLegacyProject === true &&
        detectLegacyIntegrationIntent(userMessage) &&
        !replyContent.includes("Sincronizar Especificación de Handoff")
      ) {
        replyContent = `${replyContent ?? ""}${HANDOFF_SPEC_SUGGESTION}`.trim();
      }
      LOG("interrupt reply");
      const resumeValue = interrupt({ type: "reply", reply: replyContent });
      const newMsg = typeof resumeValue === "string" ? resumeValue : String(resumeValue ?? "").trim();
      const accumulatedWithReply = [state.userInputAccumulated?.trim(), userMessage ? `Usuario: ${userMessage}` : ""].filter(Boolean).join("\n\n---\n\n");
      return new Command({
        update: {
          lastUserMessage: newMsg,
          userInputAccumulated: accumulatedWithReply || state.userInputAccumulated,
        },
        goto: "manager",
      });
    }

    const accumulatedWithRequest = [state.userInputAccumulated?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n---\n\n");
    const dbgaWithRequest = [state.dbgaContent?.trim(), userMessage ? `Petición: ${userMessage}` : ""].filter(Boolean).join("\n\n");
    const baseUpdate = {
      userInputAccumulated: accumulatedWithRequest || state.userInputAccumulated,
      dbgaContent: dbgaWithRequest || state.dbgaContent,
      lastUserMessage: undefined,
      requestQuestionsOnly: false,
      lastStepFailed: undefined,
    };

    const planDirective = getPlanDirective(state);
    let mddPlan = await generateMddPlanWithLLM(llm, state, delegateTarget, sectionsToRun);
    if (!mddPlan.length) {
      LOG("plan generado por LLM vacío o inválido, usando buildMddPlan");
      mddPlan = buildMddPlan(delegateTarget, sectionsToRun, getUserBrief(state), planDirective);
    } else {
      LOG("plan generado por LLM steps=%s", mddPlan.length);
    }

    // HITL 4.4: delegar al nodo plan_approval para interrumpir y mostrar el plan al usuario.
    if (mddPlan.length > 0) {
      let gotoNode: string;
      let previousMddDraftForMerge: string | undefined;
      if (delegateTarget === "sections" && sectionsToRun?.length) {
        gotoNode = sectionsToRun[0];
      } else if (delegateTarget === "clarifier_only" && hasDraft) {
        gotoNode = "clarifier";
        previousMddDraftForMerge = state.mddDraft ?? "";
      } else {
        gotoNode = "clarifier";
      }
      LOG("delegar a plan_approval mddPlanLen=%s goto=%s", mddPlan.length, gotoNode);
      const impactSummary = await generateImpactAnalysis(llm, state, userMessage || planDirective || "Re-planificación");
      return new Command({
        update: {
          pendingPlanApproval: {
            mddPlan,
            delegateTarget: delegateTarget ?? "full_pipeline",
            sectionsToRun,
            previousMddDraftForMerge,
            goto: gotoNode,
          },
          planUserIntent: planDirective,
          impactSummary,
        },
        goto: "plan_approval",
      });
    }

    // Delegar solo a los agentes indicados (sections) sin pasar por Clarifier (sin plan aprobación).
    if (delegateTarget === "sections" && sectionsToRun?.length) {
      LOG("delegate -> sections first=%s mddPlanLen=%s", sectionsToRun[0], mddPlan.length);
      return new Command({
        update: {
          ...baseUpdate,
          delegateTarget: "sections",
          sectionsToRun,
          mddPlan,
        },
        goto: sectionsToRun[0],
      });
    }

    // Delegar solo contexto y alcance (Clarifier + merge sección 1).
    if (delegateTarget === "clarifier_only" && hasDraft) {
      LOG("delegate -> clarifier_only mddPlanLen=%s", mddPlan.length);
      return new Command({
        update: {
          ...baseUpdate,
          delegateTarget: "clarifier_only",
          previousMddDraftForMerge: state.mddDraft ?? "",
          mddPlan,
        },
        goto: "clarifier",
      });
    }

    // Pipeline completo: Clarifier → ... → Auditor → Manager.
    LOG("delegate -> clarifier (full pipeline) mddPlanLen=%s", mddPlan.length);
    return new Command({
      update: {
        ...baseUpdate,
        delegateTarget: undefined,
        sectionsToRun: undefined,
        mddPlan,
      },
      goto: "clarifier",
    });
  };
}
