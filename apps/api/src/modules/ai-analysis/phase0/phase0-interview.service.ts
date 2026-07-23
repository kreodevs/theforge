/**
 * Phase0InterviewService — orquesta el loop de entrevista interactiva.
 *
 * Pipeline:
 *   start()  → Prompt Arranque → borrador inicial + gaps + plan de preguntas
 *   question() → siguiente pregunta del plan (sin LLM extra)
 *   answer() → Prompt Actualización → borrador + **siguiente pregunta en la misma respuesta**
 */

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AIFactory } from "../../ai/ai.factory.js";
import { PrismaService } from "../../../prisma/prisma.service.js";
import { createDbgaLLM } from "../llm/create-dbga-llm.js";
import {
  PHASE0_ARRANQUE_PROMPT,
  PHASE0_ASSISTED_MARKDOWN_UPDATE_PROMPT,
  PHASE0_EXTRACT_DBGA_PROMPT,
  PHASE0_UPDATE_PROMPT,
} from "../prompts/load-prompts.js";
import { analyzeGaps, buildQuestionPlan, filterResolvedGaps, isAskableGap } from "./phase0-gap-analyzer.js";
import { parsePhase0LlmJson } from "./phase0-llm-json.util.js";
import {
  parsePhase0GapsEnvelope,
  rehydrateInterviewState,
  serializePhase0GapsEnvelope,
} from "./phase0-interview-persist.util.js";
import {
  emptyPhase0Document,
  mergePhase0Borrador,
  normalizePhase0Document,
} from "./phase0-normalize.util.js";
import { formatDocumentMarkdown, shouldReplacePhase0SummaryWithBorrador } from "@theforge/shared-types";
import { stampMarkdownIfBodyChanged } from "../../engine/document-date-header.util.js";
import { phase0ToMarkdown } from "./phase0-to-markdown.js";
import {
  hasAuditDocument,
  hasBorradorContent,
  heuristicBorradorFromFreeformDbga,
  isFreeformDbgaContent,
  loadProjectBorrador,
} from "./phase0-load-borrador.util.js";
import type {
  Phase0Document,
  Phase0InterviewState,
  Phase0Gap,
  Phase0StreamEvent,
} from "./phase0.types.js";
import { GAP_WEIGHT } from "./phase0.types.js";
import {
  isPhase0FatalLlmError,
  phase0ProviderUnavailableEvent,
  toPhase0ErrorEvent,
} from "./phase0-llm-error.util.js";
import { TechnologyDocsMcpClientService } from "../../technology-docs-mcp/technology-docs-mcp-client.service.js";
import { appendTechDocsToSystemPrompt } from "../../technology-docs-mcp/tech-docs-context.util.js";
import {
  buildPhase0TechDocsQueryText,
  shouldAutoFetchPhase0TechDocs,
} from "@theforge/shared-types";
import {
  ASSISTED_AWAITING_SEED_MESSAGE,
  ASSISTED_COMPLETE_MESSAGE,
  ASSISTED_MAX_PREGUNTAS,
  ASSISTED_STOPPED_MESSAGE,
  assistedGapsFromBorrador,
  buildAssistedQuestionPlan,
  detectTemplateForProject,
  formatAssistedChatMessage,
  formatAssistedGapSummary,
  isAssistedMetaQuestion,
  nextAssistedQuestion,
  parseAssistedImpact,
  refreshAssistedPlanAfterAnswer,
  reformatForTemplate,
  templateKindFromState,
} from "./phase0-assisted.helpers.js";
import { applyAssistedAnswerLocalFallback } from "./phase0-assisted-fallback.util.js";
import { PHASE0_TEMPLATE_LABELS, type Phase0TemplateKind } from "./phase0-template-detect.util.js";
import { markdownToPhase0Document } from "./phase0-from-markdown.js";

const MAX_PREGUNTAS = 5;

const AUDIT_COMPLETE_MESSAGE =
  "No quedan gaps críticos ni importantes por definir en Paso 0. El documento está listo para Benchmark y MDD.";

const AUDIT_DONE_MESSAGE =
  "Auditoría completada. El borrador de Paso 0 se actualizó con tus respuestas.";

function parseBorradorFromProject(
  dbgaContent: string | null | undefined,
  phase0SummaryContent: string | null | undefined,
): Phase0Document {
  return loadProjectBorrador(dbgaContent, phase0SummaryContent);
}

@Injectable()
export class Phase0InterviewService {
  private readonly logger = new Logger(Phase0InterviewService.name);
  /** En memoria: estado activo por threadId */
  private readonly states = new Map<string, Phase0InterviewState>();
  /** threadId → projectId para rehidratar tras reload del proceso */
  private readonly threadProjectId = new Map<string, string>();

  constructor(
    private readonly aiFactory: AIFactory,
    private readonly prisma: PrismaService,
    private readonly techDocsMcp: TechnologyDocsMcpClientService,
  ) {}

  async start(idea: string, projectId: string): Promise<Phase0StreamEvent> {
    const threadId = randomUUID();

    const llm = await this.getUserLLM(projectId);
    if (!llm) {
      return phase0ProviderUnavailableEvent();
    }

    const inputType =
      idea.length > 200 || idea.includes("#") || idea.includes("##") ? "external_doc" : "idea";

    const inputLabel =
      inputType === "external_doc"
        ? "A continuación, un documento externo del usuario. Extrae toda la información posible:\n\n"
        : "A continuación, la idea del usuario. Infiere todo lo posible:\n\n";

    try {
      const response = await llm.invoke([
        { role: "system", content: PHASE0_ARRANQUE_PROMPT },
        { role: "user", content: `${inputLabel}${idea}` },
      ]);

      const content =
        typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parsePhase0LlmJson(content);

      const borrador = normalizePhase0Document(parsed.borrador ?? emptyPhase0Document());
      const llmGaps = (parsed.gaps as Phase0Gap[] | undefined) ?? [];

      const logicGaps = analyzeGaps(borrador);
      const mergedGaps = mergeGaps(llmGaps, logicGaps);
      const questionPlan = buildQuestionPlan(mergedGaps, MAX_PREGUNTAS);
      const hasInterview = questionPlan.length > 0;

      const state: Phase0InterviewState = {
        projectId,
        threadId,
        borrador,
        gaps: mergedGaps,
        preguntasRealizadas: 0,
        maxPreguntas: MAX_PREGUNTAS,
        questionPlan,
        planCursor: 0,
        status: hasInterview ? "interviewing" : "done",
        inputRaw: idea,
        inputType,
        historial: [],
        mode: "interview",
        sourceFormat: "structured",
      };

      this.rememberState(state);

      await this.persistInterviewState(state);

      if (!hasInterview) {
        const markdown = await this.finalizePhase0(state);
        return { type: "done", borrador, gaps: mergedGaps, markdown };
      }

      return { type: "init", threadId, borrador };
    } catch (err) {
      this.logger.error(`[Phase0] start error: ${err}`);
      return toPhase0ErrorEvent(err);
    }
  }

  async getQuestion(threadId: string, projectIdHint?: string): Promise<Phase0StreamEvent> {
    const state = await this.ensureState(threadId, projectIdHint);
    if (!state) {
      return { type: "error", message: "Thread no encontrado. Inicia la Fase 0 primero." };
    }

    return await this.questionForCurrentPlan(state);
  }

  async processAnswer(
    threadId: string,
    answer: string,
    projectIdHint?: string,
  ): Promise<Phase0StreamEvent> {
    const state = await this.ensureState(threadId, projectIdHint);
    if (!state) {
      return { type: "error", message: "Thread no encontrado. Inicia la Fase 0 primero." };
    }

    state.historial.push({ pregunta: state.ultimaPregunta ?? "—", respuesta: answer });
    state.preguntasRealizadas += 1;
    state.planCursor += 1;

    const llm = await this.getUserLLM(state.projectId);
    if (llm) {
      try {
        const project = await this.prisma.project.findUnique({
          where: { id: state.projectId },
          select: { userId: true },
        });
        const gapIdx = Math.max(0, state.planCursor - 1);
        const gap = state.questionPlan[gapIdx];
        const techQueryText = buildPhase0TechDocsQueryText({
          question: state.ultimaPregunta,
          gapDescription: gap?.descripcion,
          answer,
        });
        let phase0TechDocs: string | null = null;
        if (shouldAutoFetchPhase0TechDocs(techQueryText) && project?.userId) {
          phase0TechDocs = await this.techDocsMcp.buildContextFromText(techQueryText, {
            userId: project.userId,
          });
          if (phase0TechDocs) {
            this.logger.log(`[Phase0] Context7 snippets injected (${techQueryText.slice(0, 80)}…)`);
          }
        }

        const updatePrompt = this.buildUpdatePrompt(state, answer, phase0TechDocs);
        const systemPrompt = appendTechDocsToSystemPrompt(PHASE0_UPDATE_PROMPT, phase0TechDocs);
        const response = await llm.invoke([
          { role: "system", content: systemPrompt },
          { role: "user", content: updatePrompt },
        ]);

        const content =
          typeof response.content === "string" ? response.content : JSON.stringify(response.content);
        const parsed = parsePhase0LlmJson(content);

        if (parsed.borrador) {
          state.borrador = mergePhase0Borrador(
            state.borrador,
            normalizePhase0Document(parsed.borrador),
          );
        }

        const logicGaps = analyzeGaps(state.borrador);
        const llmGaps = (parsed.gaps as Phase0Gap[] | undefined) ?? [];
        state.gaps = filterResolvedGaps(
          mergeGaps(llmGaps, logicGaps),
          state.borrador,
          state.ultimaPregunta,
        );
      } catch (err) {
        this.logger.error(`[Phase0] answer LLM error: ${err}`);
        if (isPhase0FatalLlmError(err)) {
          return toPhase0ErrorEvent(err);
        }
        state.gaps = filterResolvedGaps(
          analyzeGaps(state.borrador),
          state.borrador,
          state.ultimaPregunta,
        );
      }
    } else {
      state.gaps = filterResolvedGaps(
        analyzeGaps(state.borrador),
        state.borrador,
        state.ultimaPregunta,
      );
    }

    await this.persistInterviewState(state);

    const next = await this.questionForCurrentPlan(state);
    if (next.type === "question") {
      return {
        ...next,
        borrador: state.borrador,
        gaps: state.gaps,
      };
    }
    return next;
  }

  /**
   * Repara proyectos con borrador JSON guardado pero sin dbgaContent (markdown).
   */
  async syncMarkdown(projectId: string): Promise<{ markdown: string | null }> {
    const pid = projectId?.trim();
    if (!pid) return { markdown: null };

    const project = await this.prisma.project.findUnique({
      where: { id: pid },
      select: { phase0SummaryContent: true, dbgaContent: true },
    });
    if (!project) return { markdown: null };

    if (project.dbgaContent?.trim()) {
      return { markdown: project.dbgaContent.trim() };
    }

    const borrador = parseBorradorFromProject(project.dbgaContent, project.phase0SummaryContent);
    if (!hasBorradorContent(borrador)) return { markdown: null };

    const markdown = await this.finalizePhase0FromBorrador(pid, borrador);
    return { markdown };
  }

  /**
   * Auditoría manual del documento DBGA visible (dbgaContent).
   */
  async audit(projectId: string): Promise<Phase0StreamEvent> {
    const pid = projectId?.trim();
    if (!pid) {
      return { type: "error", message: "projectId es requerido" };
    }

    const project = await this.prisma.project.findUnique({
      where: { id: pid },
      select: { phase0SummaryContent: true, phase0Gaps: true, dbgaContent: true },
    });
    if (!project) {
      return { type: "error", message: "Proyecto no encontrado" };
    }

    const dbgaMarkdown = project.dbgaContent?.trim() ?? "";

    if (!hasAuditDocument(project.dbgaContent, project.phase0SummaryContent)) {
      return {
        type: "error",
        message:
          "No hay documento de Fase 0 (DBGA) para auditar. Escribe o genera el análisis en la pestaña Fase 0.",
      };
    }

    const freeform = isFreeformDbgaContent(project.dbgaContent);
    let borrador: Phase0Document;
    let sourceFormat: Phase0InterviewState["sourceFormat"] = "structured";

    if (freeform) {
      sourceFormat = "freeform_dbga";
      borrador = await this.extractBorradorFromDbgaMarkdown(pid, dbgaMarkdown);
      if (!hasBorradorContent(borrador)) {
        borrador = heuristicBorradorFromFreeformDbga(dbgaMarkdown);
      }
    } else {
      borrador = parseBorradorFromProject(project.dbgaContent, project.phase0SummaryContent);
    }

    const gaps = analyzeGaps(borrador);
    const askable = gaps.filter(isAskableGap);

    if (askable.length === 0) {
      await this.prisma.project.update({
        where: { id: pid },
        data: {
          phase0Gaps: JSON.stringify({ v: 1, gaps }),
          phase0Status: "done",
        },
      });
      return {
        type: "audit_complete",
        message: AUDIT_COMPLETE_MESSAGE,
        borrador,
        gaps,
      };
    }

    const questionPlan = buildQuestionPlan(gaps, MAX_PREGUNTAS);
    const threadId = randomUUID();
    const state: Phase0InterviewState = {
      projectId: pid,
      threadId,
      borrador,
      gaps,
      preguntasRealizadas: 0,
      maxPreguntas: questionPlan.length,
      questionPlan,
      planCursor: 0,
      status: "interviewing",
      inputRaw: dbgaMarkdown.slice(0, 2000),
      inputType: "external_doc",
      historial: [],
      mode: "audit",
      sourceFormat,
    };

    this.rememberState(state);
    await this.persistInterviewState(state);

    const first = await this.questionForCurrentPlan(state);
    if (first.type !== "question") {
      return { type: "error", message: "No se pudo iniciar la auditoría de Paso 0" };
    }

    return {
      type: "audit_started",
      threadId,
      borrador: state.borrador,
      gaps: askable,
      question: first.question,
      n: first.n,
      total: first.total,
    };
  }

  private async questionForCurrentPlan(state: Phase0InterviewState): Promise<Phase0StreamEvent> {
    if (state.preguntasRealizadas >= state.maxPreguntas) {
      return await this.finalizeAndReturn(state);
    }

    const targetGap = state.questionPlan[state.planCursor];
    if (!targetGap) {
      return await this.finalizeAndReturn(state);
    }

    state.ultimaPregunta = targetGap.sugerenciaPregunta;
    state.status = "interviewing";
    return this.questionEvent(state, targetGap.sugerenciaPregunta);
  }

  private questionEvent(state: Phase0InterviewState, question: string): Phase0StreamEvent {
    const total = Math.max(state.questionPlan.length, 1);
    return {
      type: "question",
      question,
      n: state.planCursor + 1,
      total,
    };
  }

  private async finalizeAndReturn(state: Phase0InterviewState): Promise<Phase0StreamEvent> {
    const remainingGaps = state.gaps.filter(
      (g) => g.criticidad === "importante" || g.criticidad === "opcional",
    );
    state.borrador.preguntasPendientes = remainingGaps.map((g) => g.descripcion);
    state.status = "done";
    const markdown = await this.finalizePhase0(state);
    const message =
      state.mode === "audit"
        ? state.gaps.filter(isAskableGap).length === 0
          ? AUDIT_COMPLETE_MESSAGE
          : AUDIT_DONE_MESSAGE
        : undefined;
    return { type: "done", borrador: state.borrador, gaps: state.gaps, message, markdown };
  }

  private rememberState(state: Phase0InterviewState): void {
    this.states.set(state.threadId, state);
    this.threadProjectId.set(state.threadId, state.projectId);
  }

  private async ensureState(
    threadId: string,
    projectIdHint?: string,
  ): Promise<Phase0InterviewState | null> {
    const cached = this.states.get(threadId);
    if (cached) return cached;

    const projectId = (this.threadProjectId.get(threadId) ?? projectIdHint)?.trim();
    if (!projectId) return null;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { phase0SummaryContent: true, phase0Gaps: true, dbgaContent: true },
    });
    if (!project) return null;

    const envelope = parsePhase0GapsEnvelope(project.phase0Gaps);
    if (!envelope?.interview) return null;

    const borrador = parseBorradorFromProject(project.dbgaContent, project.phase0SummaryContent);
    const rehydrated = rehydrateInterviewState(projectId, borrador, envelope, threadId);
    if (!rehydrated) return null;

    this.rememberState(rehydrated);
    this.logger.log(`[Phase0] state rehydrated threadId=${threadId} planCursor=${rehydrated.planCursor}`);
    return rehydrated;
  }

  private async finalizePhase0(state: Phase0InterviewState): Promise<string> {
    return this.finalizePhase0FromBorrador(state.projectId, state.borrador, state);
  }

  private async finalizePhase0FromBorrador(
    projectId: string,
    borrador: Phase0Document,
    state?: Phase0InterviewState,
  ): Promise<string> {
    const markdown = phase0ToMarkdown(borrador);
    const syncDbga = this.shouldSyncDbgaMarkdown(state);
    let stampedMarkdown = "";
    try {
      const existing = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { phase0SummaryContent: true, dbgaContent: true },
      });
      if (syncDbga) {
        stampedMarkdown = stampMarkdownIfBodyChanged(existing?.dbgaContent, markdown);
      }
      const data: {
        phase0SummaryContent?: string;
        phase0Gaps?: string;
        phase0Status: "done";
        phase0Questions?: number;
        dbgaContent?: string;
      } = {
        phase0Gaps: state ? serializePhase0GapsEnvelope(state) : undefined,
        phase0Status: "done",
        phase0Questions: state?.preguntasRealizadas,
        ...(syncDbga ? { dbgaContent: stampedMarkdown } : {}),
      };
      if (shouldReplacePhase0SummaryWithBorrador(existing?.phase0SummaryContent)) {
        data.phase0SummaryContent = JSON.stringify(borrador, null, 2);
      }
      await this.prisma.project.update({
        where: { id: projectId },
        data,
      });
    } catch (err) {
      this.logger.warn(`[Phase0] finalize persist failed for ${projectId}: ${err}`);
    }
    return syncDbga ? stampedMarkdown : "";
  }

  private shouldSyncDbgaMarkdown(state?: Phase0InterviewState): boolean {
    if (!state) return true;
    // Modo asistido: el markdown vivo se persiste en persistAssistedDocument (plantilla B/C).
    if (state.mode === "assisted" && state.sourceFormat !== "structured") return false;
    if (state.sourceFormat === "freeform_dbga") return false;
    if (state.sourceFormat === "deep_research") return false;
    return true;
  }

  private async extractBorradorFromDbgaMarkdown(
    projectId: string,
    markdown: string,
  ): Promise<Phase0Document> {
    const llm = await this.getUserLLM(projectId);
    if (!llm) {
      this.logger.warn(`[Phase0] extract DBGA: no LLM, using heuristic for ${projectId}`);
      return heuristicBorradorFromFreeformDbga(markdown);
    }

    try {
      const response = await llm.invoke([
        { role: "system", content: PHASE0_EXTRACT_DBGA_PROMPT },
        { role: "user", content: markdown.slice(0, 24_000) },
      ]);
      const content =
        typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parsePhase0LlmJson(content);
      const borrador = normalizePhase0Document(parsed.borrador ?? emptyPhase0Document());
      if (hasBorradorContent(borrador)) return borrador;
    } catch (err) {
      this.logger.warn(`[Phase0] extract DBGA LLM failed for ${projectId}: ${err}`);
    }

    return heuristicBorradorFromFreeformDbga(markdown);
  }

  private async persistInterviewState(
    state: Phase0InterviewState,
    existingPhase0Summary?: string | null,
  ): Promise<void> {
    try {
      let existing = existingPhase0Summary;
      let existingDbga: string | null | undefined;
      const row = await this.prisma.project.findUnique({
        where: { id: state.projectId },
        select: { phase0SummaryContent: true, dbgaContent: true },
      });
      if (existing === undefined) {
        existing = row?.phase0SummaryContent;
      }
      existingDbga = row?.dbgaContent;

      const summaryJson = JSON.stringify(state.borrador, null, 2);
      const data: {
        phase0SummaryContent?: string;
        phase0Gaps: string;
        phase0Status: Phase0InterviewState["status"];
        phase0Questions: number;
        dbgaContent?: string;
      } = {
        phase0Gaps: serializePhase0GapsEnvelope(state),
        phase0Status: state.status,
        phase0Questions: state.preguntasRealizadas,
      };
      if (shouldReplacePhase0SummaryWithBorrador(existing)) {
        data.phase0SummaryContent = summaryJson;
      }
      if (this.shouldSyncDbgaMarkdown(state)) {
        data.dbgaContent = stampMarkdownIfBodyChanged(
          existingDbga,
          phase0ToMarkdown(state.borrador),
        );
      }
      await this.prisma.project.update({
        where: { id: state.projectId },
        data,
      });
    } catch (err) {
      this.logger.warn(`[Phase0] persist failed for ${state.projectId}: ${err}`);
    }
  }

  private async getUserLLM(projectId: string) {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true },
      });
      if (!project) return null;
      return await createDbgaLLM(this.aiFactory, project.userId);
    } catch (err) {
      this.logger.warn(`[Phase0] getUserLLM failed for ${projectId}: ${err}`);
      return null;
    }
  }

  /**
   * Modo asistido: detecta plantilla, reformatea y abre la primera pregunta (chat Workshop).
   * Sin documento ni idea → `awaitingSeed` para que el chat pida el contenido.
   */
  async startAssisted(projectId: string, idea?: string): Promise<Phase0StreamEvent> {
    const pid = projectId?.trim();
    if (!pid) return { type: "error", message: "projectId es requerido" };

    const project = await this.prisma.project.findUnique({
      where: { id: pid },
      select: { dbgaContent: true, phase0SummaryContent: true },
    });
    if (!project) return { type: "error", message: "Proyecto no encontrado" };

    const seed = idea?.trim() ?? "";
    const hasDoc = hasAuditDocument(project.dbgaContent, project.phase0SummaryContent);

    if (!hasDoc && !seed) {
      return {
        type: "assisted_started",
        threadId: "",
        templateKind: "structured",
        templateLabel: "Pendiente de detectar",
        targetField: "dbgaContent",
        markdown: "",
        reformatted: false,
        question: "",
        n: 0,
        total: 0,
        gaps: [],
        awaitingSeed: true,
        message: ASSISTED_AWAITING_SEED_MESSAGE,
      };
    }

    try {
      if (!hasDoc && seed) {
        return await this.startAssistedFromSeed(pid, seed);
      }
      return await this.startAssistedFromExisting(pid, project.dbgaContent, project.phase0SummaryContent, seed);
    } catch (err) {
      this.logger.error(`[Phase0] startAssisted error: ${err}`);
      return toPhase0ErrorEvent(err);
    }
  }

  /**
   * Respuesta del usuario en Modo asistido (una pregunta por turno).
   * Si aún no hay thread y hay seed pendiente, trata `answer` como idea/documento inicial.
   */
  async processAssistedAnswer(
    projectId: string,
    answer: string,
    threadId?: string,
  ): Promise<Phase0StreamEvent> {
    const pid = projectId?.trim();
    const ans = answer?.trim() ?? "";
    if (!pid) return { type: "error", message: "projectId es requerido" };
    if (!ans) return { type: "error", message: "answer es requerido" };

    const tid = threadId?.trim() ?? "";
    if (!tid) {
      return this.startAssisted(pid, ans);
    }

    const state = await this.ensureState(tid, pid);
    if (!state || state.mode !== "assisted") {
      return { type: "error", message: "Modo asistido no activo. Actívalo de nuevo desde Paso 0." };
    }

    const templateKind = templateKindFromState(state);
    const targetField =
      templateKind === "deep_research" ? "phase0SummaryContent" : "dbgaContent";

    if (isAssistedMetaQuestion(ans)) {
      const next = nextAssistedQuestion(state);
      const gapSummary = formatAssistedGapSummary(state.gaps);
      const markdown = state.workingMarkdown?.trim()
        ? state.workingMarkdown
        : await this.persistAssistedDocument(state);
      return {
        type: "assisted_turn",
        threadId: state.threadId,
        templateKind,
        targetField,
        markdown,
        impacto: "Consulta de gaps (sin cambios en el documento).",
        cambios: [],
        question: next?.question ?? state.ultimaPregunta,
        n: next?.n ?? state.preguntasRealizadas,
        total: next?.total ?? state.maxPreguntas,
        gaps: state.gaps,
        done: false,
        message: formatAssistedChatMessage({
          templateLabel: PHASE0_TEMPLATE_LABELS[templateKind],
          gapSummary,
          question: next?.question,
          n: next?.n,
          total: next?.total,
          intro:
            state.gaps.filter(isAskableGap).length > 0
              ? "Resumen de lo pendiente en tu documento:"
              : ASSISTED_COMPLETE_MESSAGE,
          done: state.gaps.filter(isAskableGap).length === 0,
        }),
      };
    }

    state.historial.push({ pregunta: state.ultimaPregunta ?? "—", respuesta: ans });
    state.preguntasRealizadas += 1;

    let impacto = "Se actualizó el documento con la respuesta.";
    let cambios: string[] = [];

    if (templateKind === "structured") {
      const updated = await this.applyAssistedStructuredAnswer(state, ans);
      if (updated.type !== "ok") return updated;
      impacto = updated.impacto;
      cambios = updated.cambios;
    } else {
      const updated = await this.applyAssistedMarkdownAnswer(state, ans, templateKind);
      if (updated.type !== "ok") return updated;
      impacto = updated.impacto;
      cambios = updated.cambios;
    }

    state.gaps = filterResolvedGaps(
      mergeGaps(analyzeGaps(state.borrador), state.gaps),
      state.borrador,
      state.ultimaPregunta,
    );

    refreshAssistedPlanAfterAnswer(state);
    const markdown = await this.persistAssistedDocument(state);

    const next = nextAssistedQuestion(state);
    if (!next || state.gaps.filter(isAskableGap).length === 0) {
      state.status = "done";
      await this.persistInterviewState(state);
      return {
        type: "assisted_turn",
        threadId: state.threadId,
        templateKind,
        targetField,
        markdown,
        impacto,
        cambios,
        n: state.preguntasRealizadas,
        total: state.preguntasRealizadas,
        gaps: state.gaps,
        done: true,
        message: formatAssistedChatMessage({
          impacto,
          cambios,
          done: true,
        }),
      };
    }

    state.ultimaPregunta = next.question;
    state.status = "interviewing";
    await this.persistInterviewState(state);

    return {
      type: "assisted_turn",
      threadId: state.threadId,
      templateKind,
      targetField,
      markdown,
      impacto,
      cambios,
      question: next.question,
      n: next.n,
      total: next.total,
      gaps: state.gaps,
      done: false,
      message: formatAssistedChatMessage({
        impacto,
        cambios,
        question: next.question,
        n: next.n,
        total: next.total,
      }),
    };
  }

  async stopAssisted(projectId: string): Promise<Phase0StreamEvent> {
    const pid = projectId?.trim();
    if (!pid) return { type: "error", message: "projectId es requerido" };

    const project = await this.prisma.project.findUnique({
      where: { id: pid },
      select: { phase0Gaps: true, dbgaContent: true, phase0SummaryContent: true },
    });
    if (!project) return { type: "error", message: "Proyecto no encontrado" };

    const envelope = parsePhase0GapsEnvelope(project.phase0Gaps);
    const threadId = envelope?.interview?.threadId;
    if (threadId) {
      const cached = this.states.get(threadId);
      if (cached?.mode === "assisted") {
        cached.status = "done";
        await this.persistInterviewState(cached);
        this.clearState(threadId);
      } else if (envelope?.interview?.mode === "assisted") {
        await this.prisma.project.update({
          where: { id: pid },
          data: {
            phase0Status: "done",
            phase0Gaps: JSON.stringify({
              ...envelope,
              interview: { ...envelope.interview, status: "done" },
            }),
          },
        });
        this.clearState(threadId);
      }
    }

    const template = detectTemplateForProject({
      dbgaContent: project.dbgaContent,
      phase0SummaryContent: project.phase0SummaryContent,
    });
    const markdown =
      template.targetField === "phase0SummaryContent"
        ? (project.phase0SummaryContent?.trim() ?? "")
        : (project.dbgaContent?.trim() ?? "");

    return {
      type: "assisted_stopped",
      message: ASSISTED_STOPPED_MESSAGE,
      markdown: markdown || undefined,
      targetField: template.targetField,
    };
  }

  getActiveAssistedThreadId(projectId: string): string | null {
    for (const [threadId, state] of this.states) {
      if (
        state.projectId === projectId &&
        state.mode === "assisted" &&
        state.status === "interviewing"
      ) {
        return threadId;
      }
    }
    return null;
  }

  private async startAssistedFromSeed(projectId: string, idea: string): Promise<Phase0StreamEvent> {
    const llm = await this.getUserLLM(projectId);
    if (!llm) return phase0ProviderUnavailableEvent();

    const inputType =
      idea.length > 200 || idea.includes("#") || idea.includes("##") ? "external_doc" : "idea";
    const inputLabel =
      inputType === "external_doc"
        ? "A continuación, un documento externo del usuario. Extrae toda la información posible:\n\n"
        : "A continuación, la idea del usuario. Infiere todo lo posible:\n\n";

    const response = await llm.invoke([
      { role: "system", content: PHASE0_ARRANQUE_PROMPT },
      { role: "user", content: `${inputLabel}${idea}` },
    ]);
    const content =
      typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    const parsed = parsePhase0LlmJson(content);
    const borrador = normalizePhase0Document(parsed.borrador ?? emptyPhase0Document());
    const llmGaps = (parsed.gaps as Phase0Gap[] | undefined) ?? [];
    const gaps = mergeGaps(llmGaps, assistedGapsFromBorrador(borrador));
    const { markdown, reformatted } = reformatForTemplate("structured", "", borrador);

    return this.bootstrapAssistedState({
      projectId,
      borrador,
      gaps,
      markdown,
      reformatted,
      templateKind: "structured",
      inputRaw: idea,
      inputType,
    });
  }

  private async startAssistedFromExisting(
    projectId: string,
    dbgaContent: string | null | undefined,
    phase0SummaryContent: string | null | undefined,
    extraIdea: string,
  ): Promise<Phase0StreamEvent> {
    const detected = detectTemplateForProject({
      dbgaContent,
      phase0SummaryContent,
      idea: extraIdea || undefined,
    });

    let borrador: Phase0Document;
    let markdownSource = "";

    if (detected.kind === "deep_research") {
      markdownSource = phase0SummaryContent?.trim() ?? "";
      borrador = await this.extractBorradorFromDbgaMarkdown(projectId, markdownSource);
      if (!hasBorradorContent(borrador)) {
        borrador = heuristicBorradorFromFreeformDbga(markdownSource);
      }
    } else if (detected.kind === "freeform_dbga") {
      markdownSource = dbgaContent?.trim() ?? "";
      borrador = await this.extractBorradorFromDbgaMarkdown(projectId, markdownSource);
      if (!hasBorradorContent(borrador)) {
        borrador = heuristicBorradorFromFreeformDbga(markdownSource);
      }
    } else {
      markdownSource = dbgaContent?.trim() ?? "";
      borrador = parseBorradorFromProject(dbgaContent, phase0SummaryContent);
      if (!hasBorradorContent(borrador) && markdownSource) {
        borrador = markdownToPhase0Document(markdownSource);
      }
      if (extraIdea && !hasBorradorContent(borrador)) {
        return this.startAssistedFromSeed(projectId, extraIdea);
      }
    }

    const gaps = mergeGaps([], assistedGapsFromBorrador(borrador));
    const reformattedResult = reformatForTemplate(
      detected.kind,
      markdownSource,
      detected.kind === "structured" ? borrador : undefined,
    );
    let templateKind = detected.kind;
    if (reformattedResult.preservedSourceDueToShrink) {
      templateKind = "freeform_dbga";
    }
    const { markdown, reformatted } = reformattedResult;

    return this.bootstrapAssistedState({
      projectId,
      borrador,
      gaps,
      markdown,
      reformatted,
      templateKind,
      inputRaw: (extraIdea || markdownSource).slice(0, 4000),
      inputType: "external_doc",
    });
  }

  private async bootstrapAssistedState(args: {
    projectId: string;
    borrador: Phase0Document;
    gaps: Phase0Gap[];
    markdown: string;
    reformatted: boolean;
    templateKind: Phase0TemplateKind;
    inputRaw: string;
    inputType: Phase0InterviewState["inputType"];
  }): Promise<Phase0StreamEvent> {
    const askable = args.gaps.filter(isAskableGap);
    const questionPlan = buildAssistedQuestionPlan(args.gaps, 0);
    const threadId = randomUUID();
    const hasQuestions = questionPlan.length > 0 && askable.length > 0;

    const state: Phase0InterviewState = {
      projectId: args.projectId,
      threadId,
      borrador: args.borrador,
      gaps: args.gaps,
      preguntasRealizadas: 0,
      maxPreguntas: hasQuestions
        ? Math.min(ASSISTED_MAX_PREGUNTAS, questionPlan.length)
        : 0,
      questionPlan,
      planCursor: 0,
      status: hasQuestions ? "interviewing" : "done",
      inputRaw: args.inputRaw,
      inputType: args.inputType,
      historial: [],
      mode: "assisted",
      sourceFormat: args.templateKind,
      workingMarkdown: args.markdown,
    };

    this.rememberState(state);
    await this.persistAssistedDocument(state);
    await this.persistInterviewState(state);

    const targetField =
      args.templateKind === "deep_research" ? "phase0SummaryContent" : "dbgaContent";
    const templateLabel = PHASE0_TEMPLATE_LABELS[args.templateKind];

    if (!hasQuestions) {
      return {
        type: "assisted_started",
        threadId,
        templateKind: args.templateKind,
        templateLabel,
        targetField,
        markdown: args.markdown,
        reformatted: args.reformatted,
        question: "",
        n: 0,
        total: 0,
        gaps: args.gaps,
        message: formatAssistedChatMessage({
          templateLabel,
          intro: args.reformatted
            ? "Analicé tu documento y lo reformateé según la plantilla detectada."
            : "Analicé tu documento según la plantilla detectada.",
          done: true,
        }),
      };
    }

    const first = nextAssistedQuestion(state);
    if (!first) {
      return { type: "error", message: "No se pudo iniciar el modo asistido" };
    }
    state.ultimaPregunta = first.question;
    await this.persistInterviewState(state);

    return {
      type: "assisted_started",
      threadId,
      templateKind: args.templateKind,
      templateLabel,
      targetField,
      markdown: args.markdown,
      reformatted: args.reformatted,
      question: first.question,
      n: first.n,
      total: first.total,
      gaps: args.gaps,
      message: formatAssistedChatMessage({
        templateLabel,
        intro: args.reformatted
          ? `Analicé tu documento y lo reformateé. Detecté **${askable.length}** gap(s) pendiente(s).`
          : `Analicé tu documento. Detecté **${askable.length}** gap(s) pendiente(s).`,
        gapSummary: formatAssistedGapSummary(args.gaps),
        question: first.question,
        n: first.n,
        total: first.total,
      }),
    };
  }

  private async applyAssistedStructuredAnswer(
    state: Phase0InterviewState,
    answer: string,
  ): Promise<{ type: "ok"; impacto: string; cambios: string[] } | Phase0StreamEvent> {
    const llm = await this.getUserLLM(state.projectId);
    if (!llm) {
      state.gaps = filterResolvedGaps(
        analyzeGaps(state.borrador),
        state.borrador,
        state.ultimaPregunta,
      );
      return {
        type: "ok",
        impacto: "Respuesta registrada (sin LLM disponible para inferir impacto detallado).",
        cambios: [],
      };
    }

    try {
      const project = await this.prisma.project.findUnique({
        where: { id: state.projectId },
        select: { userId: true },
      });
      const techQueryText = buildPhase0TechDocsQueryText({
        question: state.ultimaPregunta,
        answer,
      });
      let phase0TechDocs: string | null = null;
      if (shouldAutoFetchPhase0TechDocs(techQueryText) && project?.userId) {
        phase0TechDocs = await this.techDocsMcp.buildContextFromText(techQueryText, {
          userId: project.userId,
        });
      }
      const updatePrompt = this.buildUpdatePrompt(state, answer, phase0TechDocs);
      const systemPrompt = appendTechDocsToSystemPrompt(PHASE0_UPDATE_PROMPT, phase0TechDocs);
      const response = await llm.invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: updatePrompt },
      ]);
      const content =
        typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parsePhase0LlmJson(content);
      if (parsed.borrador) {
        state.borrador = mergePhase0Borrador(
          state.borrador,
          normalizePhase0Document(parsed.borrador),
        );
      }
      const logicGaps = analyzeGaps(state.borrador);
      const llmGaps = (parsed.gaps as Phase0Gap[] | undefined) ?? [];
      state.gaps = filterResolvedGaps(
        mergeGaps(llmGaps, logicGaps),
        state.borrador,
        state.ultimaPregunta,
      );
      state.workingMarkdown = formatDocumentMarkdown(phase0ToMarkdown(state.borrador));
      return { type: "ok", ...parseAssistedImpact(parsed as Record<string, unknown>) };
    } catch (err) {
      this.logger.error(`[Phase0] assisted structured answer error: ${err}`);
      if (isPhase0FatalLlmError(err)) return toPhase0ErrorEvent(err);
      return {
        type: "ok",
        ...applyAssistedAnswerLocalFallback({
          state,
          answer,
          templateKind: "structured",
        }),
      };
    }
  }

  private async applyAssistedMarkdownAnswer(
    state: Phase0InterviewState,
    answer: string,
    templateKind: Phase0TemplateKind,
  ): Promise<{ type: "ok"; impacto: string; cambios: string[] } | Phase0StreamEvent> {
    const llm = await this.getUserLLM(state.projectId);
    const currentMd = (state.workingMarkdown ?? "").trim();
    if (!llm) {
      state.gaps = filterResolvedGaps(
        analyzeGaps(state.borrador),
        state.borrador,
        state.ultimaPregunta,
      );
      return {
        type: "ok",
        impacto: "Respuesta registrada (sin LLM para reescribir el markdown).",
        cambios: [],
      };
    }

    try {
      const payload = JSON.stringify(
        {
          templateKind,
          documento_actual: currentMd.slice(0, 48_000),
          gaps_actuales: state.gaps,
          ultima_pregunta: state.ultimaPregunta,
          respuesta_usuario: answer,
          historial: state.historial.map((qa) => ({ P: qa.pregunta, R: qa.respuesta })),
        },
        null,
        2,
      );
      const response = await llm.invoke([
        { role: "system", content: PHASE0_ASSISTED_MARKDOWN_UPDATE_PROMPT },
        { role: "user", content: payload },
      ]);
      const content =
        typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parsePhase0LlmJson(content);
      const md =
        typeof parsed.markdown === "string" && parsed.markdown.trim()
          ? formatDocumentMarkdown(parsed.markdown.trim())
          : currentMd;
      state.workingMarkdown = md;
      if (templateKind === "freeform_dbga" || templateKind === "deep_research") {
        const extracted = normalizePhase0Document(
          (parsed.borrador as Phase0Document | undefined) ??
            heuristicBorradorFromFreeformDbga(md),
        );
        if (hasBorradorContent(extracted)) {
          state.borrador = mergePhase0Borrador(state.borrador, extracted);
        }
      }
      const logicGaps = analyzeGaps(state.borrador);
      const llmGaps = (parsed.gaps as Phase0Gap[] | undefined) ?? [];
      state.gaps = filterResolvedGaps(
        mergeGaps(llmGaps, logicGaps),
        state.borrador,
        state.ultimaPregunta,
      );
      return { type: "ok", ...parseAssistedImpact(parsed as Record<string, unknown>) };
    } catch (err) {
      this.logger.error(`[Phase0] assisted markdown answer error: ${err}`);
      if (isPhase0FatalLlmError(err)) return toPhase0ErrorEvent(err);
      return {
        type: "ok",
        ...applyAssistedAnswerLocalFallback({ state, answer, templateKind }),
      };
    }
  }

  private async persistAssistedDocument(state: Phase0InterviewState): Promise<string> {
    const kind = templateKindFromState(state);
    let markdown = (state.workingMarkdown ?? "").trim();
    if (kind === "structured") {
      markdown = formatDocumentMarkdown(phase0ToMarkdown(state.borrador));
      state.workingMarkdown = markdown;
    }

    try {
      const existing = await this.prisma.project.findUnique({
        where: { id: state.projectId },
        select: { dbgaContent: true, phase0SummaryContent: true },
      });
      const stamped = stampMarkdownIfBodyChanged(
        kind === "deep_research" ? existing?.phase0SummaryContent : existing?.dbgaContent,
        markdown,
      );
      const data: {
        dbgaContent?: string;
        phase0SummaryContent?: string;
        phase0Gaps: string;
        phase0Status: Phase0InterviewState["status"];
        phase0Questions: number;
      } = {
        phase0Gaps: serializePhase0GapsEnvelope(state),
        phase0Status: state.status,
        phase0Questions: state.preguntasRealizadas,
      };
      if (kind === "deep_research") {
        data.phase0SummaryContent = stamped;
      } else {
        data.dbgaContent = stamped;
        if (shouldReplacePhase0SummaryWithBorrador(existing?.phase0SummaryContent)) {
          data.phase0SummaryContent = JSON.stringify(state.borrador, null, 2);
        }
      }
      await this.prisma.project.update({ where: { id: state.projectId }, data });
      state.workingMarkdown = stamped;
      return stamped;
    } catch (err) {
      this.logger.warn(`[Phase0] persistAssistedDocument failed: ${err}`);
      return markdown;
    }
  }

  getState(threadId: string): Phase0InterviewState | undefined {
    return this.states.get(threadId);
  }

  clearState(threadId: string): void {
    this.states.delete(threadId);
    this.threadProjectId.delete(threadId);
  }

  private buildUpdatePrompt(
    state: Phase0InterviewState,
    answer: string,
    techDocsContext?: string | null,
  ): string {
    return JSON.stringify(
      {
        borrador_actual: state.borrador,
        gaps_actuales: state.gaps,
        ultima_pregunta: state.ultimaPregunta,
        respuesta_usuario: answer,
        historial: state.historial.map((qa) => ({ P: qa.pregunta, R: qa.respuesta })),
        ...(techDocsContext?.trim()
          ? { context7_documentacion_oficial: techDocsContext.trim() }
          : {}),
      },
      null,
      2,
    );
  }
}

function mergeGaps(llmGaps: Phase0Gap[], logicGaps: Phase0Gap[]): Phase0Gap[] {
  const seen = new Set<string>();
  const merged: Phase0Gap[] = [];
  for (const gap of [...llmGaps, ...logicGaps]) {
    const key = `${gap.seccion}:${gap.criticidad}:${gap.descripcion.slice(0, 64)}`;
    if (!seen.has(key)) {
      merged.push(gap);
      seen.add(key);
    }
  }
  return merged.sort((a, b) => GAP_WEIGHT[a.criticidad] - GAP_WEIGHT[b.criticidad]);
}
