import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { GenerateCodebaseDocRequest } from "@theforge/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import type { TheForgeFileToModify } from "../theforge/theforge.service.js";
import { TheForgeService } from "../theforge/theforge.service.js";
import { legacyAnalyzerIndicatesEmptyIndex, getLegacyAskCodebaseOptions } from "../theforge/theforge-evidence-context.util.js";
import {
  appendComponentDiagramToCodebaseDoc,
  isLegacyComponentDiagramEnabled,
} from "./legacy-component-diagram.util.js";
import { AiService } from "../ai/ai.service.js";
import { LegacyReviewerService } from "./legacy-reviewer.service.js";
import { cleanDocumentContent } from "../sessions/document-content.util.js";
import {
  documentPersistFieldLabel,
  validateDocumentForPersist,
} from "../sessions/document-shrink.util.js";
import {
  brdGenerationErrorMessage,
  extractBrdFromLlmResponse,
  type BrdExtractFailure,
} from "../ai/utils/brd-extract.util.js";
import { validateBrdMermaidOutput } from "../ai/utils/brd-mermaid-validate.util.js";
import {
  BRD_BUSINESS_INVENTORY_SYSTEM,
  buildLegacyBrdBusinessInventoryPrompt,
  prepareLegacyCodebaseDocForBrdPrompt,
} from "../ai/utils/brd-legacy-source.util.js";
import {
  BRD_GENERATION_SYSTEM,
  buildBrdGenerationRetryReminder,
  buildBrdUserPrompt,
} from "../ai/prompts/brd-generation-prompt.js";
import { AIFactory } from "../ai/ai.factory.js";
import { getRequestUserId } from "../../common/request-user.store.js";
import {
  isLegacyCodebaseDocMcpDebugUiEnabled,
  runWithMcpUiDebug,
} from "../theforge/mcp-ui-debug.context.js";
import { normalizeRawEvidenceJsonBlocksInMarkdown } from "../theforge/theforge-raw-evidence-markdown.js";
import { normalizeLegacyMddV1JsonBlocksInMarkdown } from "../theforge/legacy-mdd-v1-markdown.util.js";
import { isLegacyBaselineStage, pickPrimaryStage } from "../projects/stage-helpers.js";
import { appendLegacyBaselineBrdDetailPrompt } from "../ai/utils/legacy-baseline-detail.util.js";
import { parseTasksV2 } from "../engine/task-v2/tasks-parser-v2.js";
import { prependDocumentTimestamps } from "../engine/document-date-header.util.js";
import {
  extractJsonFromText,
  isLegacyAutoGenerateMddAfterCodebaseDocEnabled,
} from "./legacy-coordinator.util.js";
import type {
  GenerateCodebaseDocResponse,
  LegacyFlowState,
  LegacyIndexSddResolutionChoice,
} from "./legacy-coordinator.types.js";
export type {
  GenerateCodebaseDocResponse,
  LegacyIndexSddResolutionChoice,
  LegacyDeliverablesDebugStepKind,
  LegacyDeliverablesDebugStep,
  LegacyDeliverablesDebugReport,
  LegacyDeliverablesPipelineMode,
  LegacyFlowState,
  LegacyGenerateMddResponse,
} from "./legacy-coordinator.types.js";
import { LegacyStageContextService } from "./legacy-stage-context.service.js";
import { LegacyMddGenerationService } from "./legacy-mdd-generation.service.js";
import { LegacyDeliverablesOrchestratorService } from "./legacy-deliverables-orchestrator.service.js";
@Injectable()
export class LegacyCoordinatorService {
  private readonly logger = new Logger(LegacyCoordinatorService.name);

  constructor(
    private readonly stageContext: LegacyStageContextService,
    private readonly mddGeneration: LegacyMddGenerationService,
    private readonly deliverablesOrchestrator: LegacyDeliverablesOrchestratorService,
    private readonly aiFactory: AIFactory,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
    private readonly theforge: TheForgeService,
    private readonly ai: AiService,
    private readonly reviewer: LegacyReviewerService,
  ) {}


  /**
   * Genera documentación de partida del codebase vía MCP (opcional, ideal como primer paso).
   * Consulta exhaustivamente modelos, arquitectura, stack, reglas de negocio y convenciones.
   * @param projectId - ID del proyecto.
   * @returns Contenido Markdown de la documentación o null si TheForge no está configurado.
   */
  async generateCodebaseDoc(
    projectId: string,
    req?: GenerateCodebaseDocRequest,
    stageId?: string,
  ): Promise<GenerateCodebaseDocResponse | null> {
    if (isLegacyCodebaseDocMcpDebugUiEnabled()) {
      const { result, trace } = await runWithMcpUiDebug(() => this.generateCodebaseDocCore(projectId, req, stageId));
      if (!result) return null;
      return { ...result, mcpDebugTrace: trace };
    }
    return this.generateCodebaseDocCore(projectId, req, stageId);
  }

  /** Generación de doc. partida (sin ALS de debug). */
  private async generateCodebaseDocCore(
    projectId: string,
    req?: GenerateCodebaseDocRequest,
    stageId?: string,
  ): Promise<{ codebaseDoc: string; mddContent?: string } | null> {
    const { theforgeId } = await this.stageContext.getLegacyProject(projectId);
    if (!this.theforge.isConfigured()) return null;

    const resolvedStage = stageId?.trim()
      ? await this.prisma.stage.findUnique({ where: { id: stageId.trim() } })
      : null;
    const legacyState = resolvedStage
      ? this.stageContext.readLegacyChangeState(resolvedStage)
      : {};
    /** Gate índice ↔ SDD Falkor local (siempre antes de doc. partida). */
    await this.stageContext.assertLegacyIndexSddGate(projectId, theforgeId, legacyState);

    if (req?.responseMode) {
      this.logger.warn(
        `generateCodebaseDoc: responseMode="${req.responseMode}" ignorado — doc. partida usa generate_legacy_documentation (modo único MCP).`,
      );
    }

    let codebaseDoc = "";
    const raw = (await this.theforge.generateLegacyDocumentation(theforgeId))?.trim() ?? "";
    if (raw && legacyAnalyzerIndicatesEmptyIndex(raw)) {
      this.logger.warn(
        `generateCodebaseDoc: generate_legacy_documentation señaló índice vacío. theforgeId=${theforgeId}`,
      );
    } else if (raw) {
      codebaseDoc = "# MDD de partida (Ariadne — generate_legacy_documentation)\n\n" + raw;
    } else {
      this.logger.warn(
        `generateCodebaseDoc: generate_legacy_documentation devolvió vacío. theforgeId=${theforgeId.slice(0, 8)}…`,
      );
    }

    if (codebaseDoc.trim()) {
      codebaseDoc = normalizeLegacyMddV1JsonBlocksInMarkdown(codebaseDoc);
      codebaseDoc = normalizeRawEvidenceJsonBlocksInMarkdown(codebaseDoc);
      if (isLegacyComponentDiagramEnabled()) {
        codebaseDoc = appendComponentDiagramToCodebaseDoc(codebaseDoc);
      }
    }

    const persistStage = stageId?.trim()
      ? (resolvedStage ?? await this.stageContext.resolveLegacyGateStage(projectId))
      : await this.stageContext.resolveLegacyGateStage(projectId);
    const state = this.stageContext.readLegacyChangeState(persistStage);
    const nextLegacy = { ...state, codebaseDoc } as LegacyFlowState;
    if (persistStage?.id) {
      await this.stageContext.persistLegacyChangeState(projectId, persistStage.id, nextLegacy);
    } else {
      throw new BadRequestException("No hay etapa para persistir documentación de partida.");
    }
    const response: {
      codebaseDoc: string;
      mddGenerated?: boolean;
      mddLength?: number;
      mddWordCount?: number;
    } = { codebaseDoc };
    if (isLegacyAutoGenerateMddAfterCodebaseDocEnabled() && codebaseDoc.trim().length >= 300) {
      try {
        const mdd = await this.generateMdd(projectId, stageId?.trim(), { includeContent: false });
        response.mddGenerated = true;
        response.mddLength = mdd.mddLength;
        response.mddWordCount = mdd.wordCount;
      } catch (err) {
        this.logger.warn(
          `generateCodebaseDoc: auto generateMdd falló (LEGACY_AUTO_GENERATE_MDD_AFTER_CODEBASE_DOC=1): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return response;
  }

  /**
   * Tras un 409 LEGACY_INDEX_SDD_MISMATCH, el usuario elige cómo proceder (índice MCP vs SDD en Falkor).
   */
  async resolveIndexSddConflict(
    projectId: string,
    choice: LegacyIndexSddResolutionChoice,
    stageId?: string,
  ): Promise<{ ok: boolean; legacyIndexSddResolution: LegacyFlowState["legacyIndexSddResolution"] }> {
    await this.stageContext.getLegacyProject(projectId);
    const allowed: LegacyIndexSddResolutionChoice[] = ["trust_index", "trust_sdd", "proceed_with_warnings"];
    if (!allowed.includes(choice)) {
      throw new BadRequestException(`choice debe ser uno de: ${allowed.join(", ")}`);
    }
    const gateStageForResolution = stageId?.trim()
      ? await this.prisma.stage.findUnique({ where: { id: stageId.trim() } })
      : await this.stageContext.resolveLegacyGateStage(projectId);
    const state = this.stageContext.readLegacyChangeState(gateStageForResolution);
    const legacyIndexSddResolution: LegacyFlowState["legacyIndexSddResolution"] = {
      choice,
      resolvedAt: new Date().toISOString(),
    };
    const next = { ...state, legacyIndexSddResolution };
    if (gateStageForResolution?.id) {
      await this.stageContext.persistLegacyChangeState(projectId, gateStageForResolution.id, next);
    } else {
      throw new BadRequestException("No hay etapa para persistir resolución índice/SDD.");
    }
    return { ok: true, legacyIndexSddResolution };
  }

  /**
   * Actualiza la documentación de partida del codebase (edición manual).
   * @param projectId - ID del proyecto.
   * @param codebaseDoc - Contenido Markdown.
   * @returns { codebaseDoc: string }.
   */
  async updateCodebaseDoc(projectId: string, codebaseDoc: string, stageId?: string): Promise<{ codebaseDoc: string }> {
    await this.stageContext.getLegacyProject(projectId);
    const stage = stageId?.trim()
      ? await this.prisma.stage.findUnique({ where: { id: stageId.trim() } })
      : await this.stageContext.resolveLegacyGateStage(projectId);
    const state = this.stageContext.readLegacyChangeState(stage);
    const next = { ...state, codebaseDoc } as LegacyFlowState;
    if (stage?.id) {
      await this.stageContext.persistLegacyChangeState(projectId, stage.id, next);
    } else {
      throw new BadRequestException("No hay etapa para persistir documentación de partida.");
    }
    return { codebaseDoc };
  }

  /**
   * Inicia el flujo legacy: consulta AriadneSpecs MCP (get_modification_plan o ask_codebase), obtiene archivos y preguntas,
   * pide sugerencias de respuestas al codebase y persiste todo en legacyFlowState.
   * @param projectId - ID del proyecto.
   * @param description - Descripción de la modificación que quiere el usuario.
   * @returns Lista de archivos a modificar, preguntas para afinar y respuestas sugeridas (opcional).
   */
  // generateAsIsManual eliminado — As-Is removido del sistema; usar legacyFlowState.codebaseDoc directamente

  /**
   * Borrador BRD a partir de `legacyFlowState.codebaseDoc` (Ariadne); persiste en la etapa sin aprobar.
   * (To-Be y As-Is eliminados — el MDD captura el diseño.)
   */
  async suggestBrdFromCodebaseDoc(projectId: string, stageIdHint?: string): Promise<{
    brdContent: string;
    stageId: string;
  }> {
    await this.stageContext.getLegacyProject(projectId);
    const gateStageResolved = stageIdHint?.trim()
      ? await this.prisma.stage.findUnique({ where: { id: stageIdHint.trim() } })
      : await this.stageContext.resolveLegacyGateStage(projectId);
    const state = this.stageContext.readLegacyChangeState(gateStageResolved);
    const codebaseDoc = String(state.codebaseDoc ?? "").trim();
    if (codebaseDoc.length < 300) {
      throw new BadRequestException(
        "Se requiere documentación de partida del codebase (mín. ~300 caracteres). Ejecuta primero generate-codebase-doc.",
      );
    }
    let stage;
    if (stageIdHint?.trim()) {
      stage = await this.prisma.stage.findUnique({ where: { id: stageIdHint.trim() } });
      if (!stage) throw new BadRequestException(`Etapa ${stageIdHint} no encontrada.`);
    } else {
      stage = await this.stageContext.resolveLegacyGateStage(projectId);
    }
    if (!stage?.id) {
      throw new BadRequestException("No hay etapa para persistir BRD.");
    }

    let baselineBrdBlock = "";
    if (stage.ordinal > 1) {
      try {
        const baselineOrdinal = stage.ordinal - 1;
        const baseline = await this.prisma.stage.findFirst({
          where: { projectId: stage.projectId, ordinal: baselineOrdinal },
          select: { brdContent: true },
        });
        if (baseline?.brdContent?.trim()) {
          baselineBrdBlock =
            "## Línea base — BRD de la etapa anterior (sistema sin el cambio actual)\n\n" +
            baseline.brdContent.trim() +
            "\n\n---\n\n**Instrucción:** El BRD debe centrarse SOLO en el cambio respecto a esta línea base. " +
            "No redescribas el sistema completo.\n\n---\n\n";
        }
      } catch { /* non-critical */ }
    }
    const isInitialLegacyStage = isLegacyBaselineStage(stage);
    const sourcePrep = prepareLegacyCodebaseDocForBrdPrompt(codebaseDoc, {
      legacyBaselineStage: isInitialLegacyStage,
    });
    let brdSourceDocument = sourcePrep.text;
    let sourceTruncated = sourcePrep.truncated;

    if (isInitialLegacyStage && sourcePrep.needsInventoryPass) {
      console.log(
        `[suggestBrdFromCodebaseDoc] inventario previo (truncated=${sourcePrep.truncated} entities=${sourcePrep.entityCount} services=${sourcePrep.serviceCount} len=${sourcePrep.text.length} baseline=${isInitialLegacyStage})`,
      );
      const inventoryRaw = await this.ai.generateResponse(
        buildLegacyBrdBusinessInventoryPrompt(sourcePrep.text, isInitialLegacyStage),
        [],
        {
          systemPrompt: appendLegacyBaselineBrdDetailPrompt(
            BRD_BUSINESS_INVENTORY_SYSTEM,
            isInitialLegacyStage,
          ),
        },
      );
      const inventory = cleanDocumentContent(inventoryRaw ?? "").trim();
      if (inventory.length >= 400) {
        brdSourceDocument =
          "## Inventario de negocio (extracción previa — cubrir TODO en el BRD)\n\n" +
          inventory +
          "\n\n---\n\n## Documento de partida (referencia)\n\n" +
          sourcePrep.text;
      }
    }

    const brdPromptBase = appendLegacyBaselineBrdDetailPrompt(
      buildBrdUserPrompt({
        mode: isInitialLegacyStage ? "legacy-as-is" : "legacy-change",
        sourceLabel: "DOCUMENTO",
        sourceDocument: brdSourceDocument,
        baselineBrdBlock: baselineBrdBlock || undefined,
      }),
      isInitialLegacyStage,
    );

    let brd = "";
    let lastFailure: BrdExtractFailure = "no_delimiter";
    let lastMermaidHint = "";
    let lastRawLength = 0;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const formatReminder =
        attempt > 1
          ? buildBrdGenerationRetryReminder({
              delimiterRetry: !lastMermaidHint,
              mermaidRetry: Boolean(lastMermaidHint),
              mermaidHint: lastMermaidHint || undefined,
            })
          : "";
      const raw = await this.ai.generateResponse(brdPromptBase + formatReminder, [], {
        systemPrompt: BRD_GENERATION_SYSTEM,
      });
      lastRawLength = (raw ?? "").length;
      const extracted = extractBrdFromLlmResponse(raw ?? "");
      if (!extracted.ok) {
        lastFailure = extracted.failure;
        lastMermaidHint = "";
        if (attempt < 2) {
          console.warn(
            `[suggestBrdFromCodebaseDoc] Intento BRD ${attempt}/2: ${extracted.failure} (raw ~${lastRawLength} chars), reintentando...`,
          );
        }
        continue;
      }
      const mermaidVal = validateBrdMermaidOutput(extracted.content);
      if (!mermaidVal.ok) {
        lastMermaidHint = mermaidVal.hint;
        if (attempt < 2) {
          console.warn(
            `[suggestBrdFromCodebaseDoc] Intento BRD ${attempt}/2: Mermaid inválido (${mermaidVal.hint}), reintentando...`,
          );
        }
        continue;
      }
      brd = cleanDocumentContent(extracted.content);
      break;
    }
    if (!brd) {
      throw new BadRequestException(
        brdGenerationErrorMessage(lastFailure, {
          dbgaTruncated: sourceTruncated,
          rawLength: lastRawLength,
        }) +
          (lastMermaidHint ? ` Diagramas §4: ${lastMermaidHint}.` : ""),
      );
    }

    await this.prisma.stage.update({
      where: { id: stage.id },
      data: {
        brdContent: prependDocumentTimestamps(brd),
      },
    });
    await this.stageContext.syncCurrentLegacyStageToGraph(projectId, stage.id).catch(() => {});
    return { brdContent: brd, stageId: stage.id };
  }

  async start(projectId: string, description: string, stageId?: string): Promise<{ filesToModify: TheForgeFileToModify[]; questions: string[]; suggestedAnswers?: Record<string, string> }> {
    const { theforgeId } = await this.stageContext.getLegacyProject(projectId);
    const desc = (description ?? "").trim();
    if (!desc) throw new BadRequestException("description is required");

    let filesToModify: TheForgeFileToModify[] = [];
    let questions: string[] = [];

    const plan = await this.theforge.getModificationPlan(desc, theforgeId);
    if (plan) {
      filesToModify = plan.filesToModify;
      questions = plan.questionsToRefine;
    } else {
      // Fallback: cuando get_modification_plan no responde o devuelve error
      const question =
        `The user wants to make the following change to this codebase:\n\n"${desc}"\n\n` +
        `Analyze the ACTUAL indexed codebase (graph/files) for this project. Respond with a JSON object only: { "filesToModify": string[], "questions": string[] }.\n` +
        `- filesToModify: List ONLY real file paths that EXIST in this indexed project. Do NOT invent file names (e.g. no .java if the project has no Java).\n` +
        `- questions: ONLY business/functional clarifying questions. Do NOT ask "are there other components to consider?".`;
      const legacyAsk = getLegacyAskCodebaseOptions();
      const raw = await this.theforge.askCodebase(question, theforgeId, legacyAsk);
      if (raw.trim()) {
        try {
          const jsonStr = extractJsonFromText(raw);
          const parsed = JSON.parse(jsonStr) as { filesToModify?: unknown; questions?: unknown };
          const paths = Array.isArray(parsed?.filesToModify) ? parsed.filesToModify.filter((f) => typeof f === "string") : [];
          const defaultRepoId = await this.theforge.getDefaultRepoIdForStoredProject(theforgeId);
          filesToModify = paths.map((path) => ({ path: path as string, repoId: defaultRepoId }));
          questions = Array.isArray(parsed?.questions) ? parsed.questions.filter((q) => typeof q === "string") : [];
        } catch {
          questions = [raw.slice(0, 500)];
        }
      }
      questions = questions.filter((q) => !/otro(s)?\s+componente(s)?|componente(s)?\s+que\s+deba(n)?\s+considerar|other\s+component(s)?/i.test(q));
    }

    const reviewed = await this.reviewer.reviewStartResult(desc, filesToModify, questions);
    filesToModify = reviewed.filesToModify;
    questions = reviewed.questions;

    let suggestedAnswers: Record<string, string> = {};
    if (questions.length > 0) {
      const legacyAsk = getLegacyAskCodebaseOptions();
      const answerPrompt =
        `Change requested: "${desc.slice(0, 400)}"\n\n` +
        `Based ONLY on the codebase, answer these questions briefly (one short paragraph or bullet list per question). ` +
        `If the code does not contain the answer, use empty string for that key. ` +
        `Respond with a JSON object only, with string keys "0", "1", "2", ... (index of each question):\n\n` +
        questions.map((q, i) => `${i}. ${q}`).join("\n");
      const answerRaw = await this.theforge.askCodebase(answerPrompt, theforgeId, legacyAsk);
      if (answerRaw.trim()) {
        try {
          const answerStr = extractJsonFromText(answerRaw);
          const parsed = JSON.parse(answerStr) as Record<string, unknown>;
          for (let i = 0; i < questions.length; i++) {
            const v = parsed[String(i)];
            if (typeof v === "string" && v.trim()) suggestedAnswers[String(i)] = v.trim();
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    const state: LegacyFlowState = {
      description: desc,
      filesToModify,
      questions,
      suggestedAnswers: Object.keys(suggestedAnswers).length > 0 ? suggestedAnswers : undefined,
    };
    const gateStageForStart = stageId?.trim()
      ? (await this.prisma.stage.findUnique({ where: { id: stageId.trim() } })) ?? await this.stageContext.resolveLegacyGateStage(projectId)
      : await this.stageContext.resolveLegacyGateStage(projectId);
    if (gateStageForStart?.id) {
      await this.stageContext.persistLegacyChangeState(projectId, gateStageForStart.id, state);
      await this.stageContext.syncCurrentLegacyStageToGraph(projectId, gateStageForStart.id).catch(() => {});
    } else {
      throw new BadRequestException("No hay etapa para persistir el inicio del flujo legacy.");
    }
    return { filesToModify, questions, suggestedAnswers: Object.keys(suggestedAnswers).length > 0 ? suggestedAnswers : undefined };
  }

  /**
   * Registra las respuestas del usuario a las preguntas del flujo. Persiste en legacyFlowState.answers.
   * @param projectId - ID del proyecto.
   * @param answers - Mapa índice de pregunta → respuesta (p. ej. { "0": "10", "1": "30" }).
   */
  async answer(projectId: string, answers: Record<string, string>, stageId?: string): Promise<{ ok: boolean }> {
    await this.stageContext.getLegacyProject(projectId);
    const gateStageForAnswer = stageId?.trim()
      ? await this.prisma.stage.findUnique({ where: { id: stageId.trim() } })
      : await this.stageContext.resolveLegacyGateStage(projectId);
    const prev = this.stageContext.readLegacyChangeState(gateStageForAnswer);
    const next: LegacyFlowState = { ...prev, answers };
    if (gateStageForAnswer?.id) {
      await this.stageContext.persistLegacyChangeState(projectId, gateStageForAnswer.id, next);
      await this.stageContext.syncCurrentLegacyStageToGraph(projectId, gateStageForAnswer.id).catch(() => {});
    } else {
      throw new BadRequestException("No hay etapa para persistir respuestas del flujo legacy.");
    }
    return { ok: true };
  }

  async generateMdd(
    projectId: string,
    stageId?: string,
    options?: { includeContent?: boolean },
  ) {
    return this.mddGeneration.generateMdd(projectId, stageId, options);
  }

  async generateDeliverables(
    projectId: string,
    stageId?: string,
    options?: {
      onProgress?: (p: {
        step: string;
        completedSteps: string[];
        index: number;
        total: number;
      }) => void;
    },
  ) {
    return this.deliverablesOrchestrator.generateDeliverables(projectId, stageId, options);
  }

  /** Mapping de tipo de documento a campo de proyecto. */
  private static readonly DOCUMENT_TYPE_FIELD: Record<string, string> = {
    spec: "specContent",
    architecture: "architectureContent",
    "use-cases": "useCasesContent",
    "user-stories": "userStoriesContent",
    blueprint: "blueprintContent",
    "api-contracts": "apiContractsContent",
    "logic-flows": "logicFlowsContent",
    tasks: "tasksContent",
    infra: "infraContent",
  };

  /** Prompt de generación por tipo de documento (español). */
  private static readonly DOCUMENT_TYPE_PROMPTS: Record<string, string> = {
    spec:
      "A partir de la documentación del codebase (codebaseDoc) de un proyecto existente, genera un documento SPEC que describa: qué hace el sistema, sus funcionalidades principales, objetivos de negocio, stack tecnológico, y arquitectura de alto nivel. Basa todo en la evidencia del codebaseDoc.",
    architecture:
      "A partir de la documentación del codebase, genera un documento de ARQUITECTURA que describa: estructura de módulos, patrones de diseño, flujo de datos, base de datos, APIs externas, y diagrama de componentes. Basa todo en la evidencia.",
    "use-cases":
      "A partir de la documentación del codebase, genera CASOS DE USO describiendo: actores, flujos principales, flujos alternativos, y pre/post condiciones. Basa todo en la evidencia.",
    "user-stories":
      "A partir de la documentación del codebase, genera HISTORIAS DE USUARIO en formato 'Como [rol], quiero [funcionalidad] para [beneficio]'. Basa todo en la evidencia.",
    blueprint:
      "A partir de la documentación del codebase, genera un BLUEPRINT con: modelo de datos, entidades, relaciones, atributos, y restricciones. Basa todo en la evidencia.",
    "api-contracts":
      "A partir de la documentación del codebase, genera CONTRATOS DE API listando: endpoints, métodos HTTP, request/response, autenticación, y ejemplos. Basa todo en la evidencia.",
    "logic-flows":
      "A partir de la documentación del codebase, genera FLUJOS DE LÓGICA describiendo: reglas de negocio, validaciones, estados, transiciones, y secuencias. Basa todo en la evidencia.",
    tasks:
      "A partir de la documentación del codebase, genera TASKS desglosando: módulos, funcionalidades, y tareas técnicas. Basa todo en la evidencia.",
    infra:
      "A partir de la documentación del codebase, genera INFRAESTRUCTURA describiendo: Docker, servicios, base de datos, despliegue, y configuración. Basa todo en la evidencia.",
  };

  /**
   * Genera un documento individual a partir del codebaseDoc del proyecto legacy.
   * Lee el codebaseDoc (ya sea de legacyFlowState del proyecto o de la etapa),
   * llama al LLM para generar el contenido del tipo solicitado y lo persiste.
   *
   * @param projectId - ID del proyecto.
   * @param documentType - Tipo de documento (spec, architecture, use-cases, user-stories, blueprint, api-contracts, logic-flows, tasks, infra).
   * @param stageId - Etapa base opcional (por defecto resuelve la etapa legacy).
   * @returns Objeto con el contenido generado y el campo persistido.
   */
  async generateFromCodebase(
    projectId: string,
    documentType: string,
    stageId?: string,
  ): Promise<{ content: string; field: string }> {
    await this.stageContext.getLegacyProject(projectId);

    const field = LegacyCoordinatorService.DOCUMENT_TYPE_FIELD[documentType];
    if (!field) {
      throw new BadRequestException(
        `Tipo de documento no soportado: ${documentType}`,
      );
    }

    // Resolver etapa
    const stage = stageId?.trim()
      ? await this.prisma.stage.findUnique({ where: { id: stageId.trim() } })
      : await this.stageContext.resolveLegacyGateStage(projectId);

    // Leer proyecto con stages incluidos
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { stages: true },
    });
    if (!project) {
      throw new NotFoundException(`Proyecto ${projectId} no encontrado`);
    }

    // Obtener codebaseDoc desde stage o project
    const state = this.stageContext.readLegacyChangeState(stage);
    const codebaseDoc = String(state.codebaseDoc ?? "").trim();

    if (codebaseDoc.length < 300) {
      throw new BadRequestException(
        "Se requiere documentación de partida del codebase (mín. ~300 caracteres). Ejecuta primero generate-codebase-doc.",
      );
    }

    if (documentType === "tasks") {
      const gateStageForMdd = stage ?? pickPrimaryStage(project.stages);
      const stageMdd = String(gateStageForMdd?.mddContent ?? "").trim();
      if (!stageMdd && gateStageForMdd?.id) {
        const mddSeed =
          `[Ingeniería inversa: documento del codebase existente. Genera entregables que describan el sistema AS-IS.]\n\n${codebaseDoc}`;
        await this.prisma.stage.update({
          where: { id: gateStageForMdd.id },
          data: { mddContent: mddSeed },
        });
      }
      await this.projects.generateTasks(projectId);
      const refreshed = await this.projects.findOne(projectId);
      return {
        content: (refreshed.tasksContent ?? "").trim(),
        field: String(field),
      };
    }

    let content: string;

    {
      // Construir prompt
      const typePrompt = LegacyCoordinatorService.DOCUMENT_TYPE_PROMPTS[documentType];
      const prompt = `${typePrompt}\n\n--- codebaseDoc ---\n\n${codebaseDoc}`;

      // Llamar al LLM
      const llm = await this.aiFactory.createForUser(getRequestUserId());
      const raw = await llm.generateResponse(prompt, [], {
        systemPrompt:
          "Eres un analista de software experto. Genera documentación técnica precisa basada en el codebase proporcionado.",
      });

      content = cleanDocumentContent(raw ?? "");
    }

    const fieldKey = String(field);
    const currentContent = String(
      (project as Record<string, unknown>)[fieldKey] ?? "",
    ).trim();
    const persistValidation = validateDocumentForPersist(currentContent, content, {
      fieldLabel: documentPersistFieldLabel(fieldKey),
      minBodyChars: currentContent.length > 0 ? 80 : 120,
    });
    if (!persistValidation.ok) {
      throw new BadRequestException(persistValidation.message);
    }

    // Persistir en el proyecto (auto-parse tasks v2 si aplica)
    const updateData: Record<string, unknown> = { [field]: content };
    if (field === "tasksContent") {
      try {
        const parsed = parseTasksV2(content);
        if (parsed.tasks.length > 0) {
          updateData.tasksJson = parsed;
        }
      } catch {
        // ignore parse errors
      }
    }
    await this.prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });

    this.logger.log(
      `[LegacyCoordinator] generateFromCodebase project=${projectId.slice(0, 8)}… type=${documentType} field=${String(field)} chars=${content.length}`,
    );

    return { content, field: String(field) };
  }
}
