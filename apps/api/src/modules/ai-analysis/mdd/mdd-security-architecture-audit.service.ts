/**
 * Auditoría adversarial read-only de seguridad y arquitectura sobre el MDD.
 * No modifica el documento ni reutiliza el flujo MddManualAudit (entrevista/reescritura).
 */

import { Injectable, Logger } from "@nestjs/common";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Prisma } from "@theforge/database";
import { AIFactory } from "../../ai/ai.factory.js";
import { PrismaService } from "../../../prisma/prisma.service.js";
import { pickPrimaryStage } from "../../projects/stage-helpers.js";
import { createDbgaLLMFromRuntime } from "../llm/create-dbga-llm.js";
import { EstimationService } from "../estimation/estimation.service.js";
import { SECURITY_ARCHITECTURE_AUDITOR_MDD_PROMPT } from "../prompts/load-prompts.js";
import { extractLlmText, invokeLlmWithRetry } from "../utils/mdd-llm-retry.util.js";
import { MDD_MIN_AUDIT_CHARS } from "./mdd-manual-audit.types.js";
import {
  applyServerAuditTimestamp,
  buildFamilySecurityAuditUserMessage,
  buildSecurityArchitectureAuditMarkdown,
  buildSecurityArchitectureSynthesisUserMessage,
  buildSingleShotSecurityAuditUserMessage,
  evaluateAnalyticalDepthGate,
  finalizeSecurityArchitectureStructured,
  mergeSecurityArchitectureChunkExtractions,
  mergeSecurityArchitectureFamilyExtractions,
  parseSecurityArchitectureAuditResponse,
  SECURITY_ARCHITECTURE_AUDIT_CHUNK_USER_INSTRUCTIONS,
  SECURITY_ARCHITECTURE_AUDIT_FAMILIES,
  SECURITY_ARCHITECTURE_AUDIT_REINFORCEMENT_USER_SUFFIX,
  SECURITY_AUDIT_LOW_COVERAGE_WARNING,
  shouldUseChunkedSecurityAudit,
  splitMddForSecurityAudit,
  validateSecurityArchitectureCoverageGate,
  type MddSecurityAuditChunk,
  type ParsedSecurityArchitectureAudit,
} from "./mdd-security-architecture-audit-parse.util.js";
import { MDD_SECURITY_AUDIT_FAMILY_PASS_CONCURRENCY } from "./mdd-security-architecture-audit-catalog.js";
import type {
  MddSecurityArchitectureAuditResponse,
  MddSecurityArchitectureAuditSnapshot,
} from "./mdd-security-architecture-audit.types.js";

@Injectable()
export class MddSecurityArchitectureAuditService {
  private readonly logger = new Logger(MddSecurityArchitectureAuditService.name);

  constructor(
    private readonly aiFactory: AIFactory,
    private readonly prisma: PrismaService,
    private readonly estimation: EstimationService,
  ) {}

  async audit(
    projectId: string,
    stageId?: string | null,
    mddContentOverride?: string | null,
    options?: { deepAudit?: boolean },
  ): Promise<MddSecurityArchitectureAuditResponse> {
    const pid = projectId?.trim();
    if (!pid) {
      return { markdownReport: "", error: "projectId es requerido" };
    }

    const resolvedStageId = await this.resolveStageId(pid, stageId);
    if (!resolvedStageId) {
      return { markdownReport: "", error: "No se encontró etapa del proyecto" };
    }

    const mddContent =
      (mddContentOverride?.trim() ||
        (await this.estimation.getMddContentForProject(pid, resolvedStageId)) ||
        "").trim();

    if (mddContent.length < MDD_MIN_AUDIT_CHARS) {
      return {
        markdownReport: "",
        error:
          "No hay MDD sustancial para auditar. Genera o escribe el documento en la pestaña MDD antes de auditar seguridad y arquitectura.",
      };
    }

    const project = await this.prisma.project.findUnique({
      where: { id: pid },
      select: { userId: true },
    });
    if (!project?.userId) {
      return { markdownReport: "", error: "Proyecto no encontrado" };
    }

    try {
      const runtime = await this.aiFactory.resolveAuditorRuntime(project.userId);
      const llm = createDbgaLLMFromRuntime(runtime, {
        outputTokenPurpose: "auditor",
        temperature: 0.1,
      });

      const auditedAt = new Date().toISOString();
      const deepAudit = options?.deepAudit === true;
      const passOptions = { deepAudit };

      let parsed = await this.runAuditPass(llm, mddContent, auditedAt, passOptions);
      let gate = validateSecurityArchitectureCoverageGate(parsed.structured);

      if (!gate.ok) {
        this.logger.warn(
          `[SecurityArchitectureAudit] cobertura insuficiente, reintento: ${gate.reason}`,
        );
        const reinforced = await this.runAuditPass(llm, mddContent, auditedAt, {
          ...passOptions,
          reinforcement: true,
          priorReason: gate.reason,
        });
        parsed = reinforced;
        gate = validateSecurityArchitectureCoverageGate(parsed.structured);
        if (!gate.ok) {
          return {
            markdownReport: parsed.markdownReport,
            structured: parsed.structured,
            veredicto: parsed.veredicto,
            error:
              gate.reason ??
              "La auditoría no alcanzó cobertura mínima del catálogo A–G. Reintenta o revisa el MDD.",
          };
        }
      }

      const warnings: string[] = [];
      let depthGate = evaluateAnalyticalDepthGate({
        mddContentLength: mddContent.length,
        hallazgosCount: parsed.structured?.hallazgos?.length ?? 0,
        afterRetry: false,
      });

      if (depthGate.needsRetry) {
        this.logger.warn(
          `[SecurityArchitectureAudit] profundidad insuficiente, reintento: ${depthGate.reason}`,
        );
        parsed = await this.runAuditPass(llm, mddContent, auditedAt, {
          ...passOptions,
          reinforcement: true,
          priorReason: depthGate.reason,
          depthReinforcement: true,
        });
        depthGate = evaluateAnalyticalDepthGate({
          mddContentLength: mddContent.length,
          hallazgosCount: parsed.structured?.hallazgos?.length ?? 0,
          afterRetry: true,
        });
      }

      if (depthGate.lowCoverageWarning) {
        warnings.push(SECURITY_AUDIT_LOW_COVERAGE_WARNING);
        this.logger.warn(
          `[SecurityArchitectureAudit] ${SECURITY_AUDIT_LOW_COVERAGE_WARNING}: ${depthGate.reason}`,
        );
      }

      const structured = parsed.structured
        ? applyServerAuditTimestamp(parsed.structured, auditedAt)
        : null;
      const markdownReport = structured
        ? buildSecurityArchitectureAuditMarkdown(structured)
        : parsed.markdownReport;

      const result: MddSecurityArchitectureAuditResponse = {
        veredicto: structured?.veredicto ?? parsed.veredicto,
        markdownReport,
        structured,
        ...(warnings.length > 0 ? { warnings } : {}),
      };

      await this.persistSnapshot(resolvedStageId, {
        veredicto: result.veredicto,
        markdownReport: result.markdownReport,
        structured: result.structured,
        auditedAt,
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[SecurityArchitectureAudit] audit failed: ${message}`);
      return {
        markdownReport: "",
        error: message || "Error al ejecutar la auditoría de seguridad y arquitectura",
      };
    }
  }

  private async runAuditPass(
    llm: BaseChatModel,
    mddContent: string,
    auditedAt: string,
    options?: {
      deepAudit?: boolean;
      reinforcement?: boolean;
      priorReason?: string;
      depthReinforcement?: boolean;
    },
  ): Promise<ParsedSecurityArchitectureAudit> {
    if (shouldUseChunkedSecurityAudit(mddContent)) {
      return this.runChunkedAuditPass(llm, mddContent, auditedAt, options);
    }

    if (options?.deepAudit) {
      return this.runFamilyMultiPassAudit(llm, mddContent, auditedAt, options);
    }

    return this.runSingleShotAudit(llm, mddContent, auditedAt, options);
  }

  private async runSingleShotAudit(
    llm: BaseChatModel,
    mddContent: string,
    auditedAt: string,
    options?: {
      reinforcement?: boolean;
      priorReason?: string;
      depthReinforcement?: boolean;
    },
  ): Promise<ParsedSecurityArchitectureAudit> {
    this.logger.log(
      `[SecurityArchitectureAudit] single-shot (${mddContent.length} chars)`,
    );

    const userMessage = buildSingleShotSecurityAuditUserMessage({
      mddContent,
      auditedAt,
      reinforcement: options?.reinforcement,
      priorReason: options?.priorReason,
      depthReinforcement: options?.depthReinforcement,
    });

    const raw = await this.invokeAuditorLlm(llm, userMessage, "SecurityArchitectureAuditor:single-shot");
    const parsed = parseSecurityArchitectureAuditResponse(raw);
    return this.finalizeParsedAudit(parsed);
  }

  private async runFamilyMultiPassAudit(
    llm: BaseChatModel,
    mddContent: string,
    auditedAt: string,
    options?: {
      reinforcement?: boolean;
      priorReason?: string;
      depthReinforcement?: boolean;
    },
  ): Promise<ParsedSecurityArchitectureAudit> {
    this.logger.log(
      `[SecurityArchitectureAudit] family multi-pass: ${SECURITY_ARCHITECTURE_AUDIT_FAMILIES.length} familias ` +
        `(${mddContent.length} chars, concurrencia ${MDD_SECURITY_AUDIT_FAMILY_PASS_CONCURRENCY})`,
    );

    const partials: NonNullable<ParsedSecurityArchitectureAudit["structured"]>[] = [];
    const families = [...SECURITY_ARCHITECTURE_AUDIT_FAMILIES];

    await runWithConcurrencyLimit(
      families,
      MDD_SECURITY_AUDIT_FAMILY_PASS_CONCURRENCY,
      async (family) => {
        const raw = await this.invokeFamilyExtractor(
          llm,
          mddContent,
          family,
          auditedAt,
          options,
        );
        const parsed = parseSecurityArchitectureAuditResponse(raw);
        if (parsed.structured) {
          partials.push(parsed.structured);
        }
      },
    );

    if (partials.length === 0) {
      throw new Error(
        "El auditor no devolvió extracciones por familia. Reintenta o revisa la configuración del modelo.",
      );
    }

    const merged = mergeSecurityArchitectureFamilyExtractions(partials);
    this.logger.log(
      `[SecurityArchitectureAudit] family merge: ${merged.hallazgos?.length ?? 0} hallazgos, ` +
        `${merged.no_evaluado?.length ?? 0} no_evaluado (pre-fill)`,
    );

    return {
      markdownReport: buildSecurityArchitectureAuditMarkdown(merged),
      structured: merged,
      veredicto: merged.veredicto,
      ordenResolucion: merged.orden_resolucion,
    };
  }

  private async runChunkedAuditPass(
    llm: BaseChatModel,
    mddContent: string,
    auditedAt: string,
    options?: {
      reinforcement?: boolean;
      priorReason?: string;
      depthReinforcement?: boolean;
    },
  ): Promise<ParsedSecurityArchitectureAudit> {
    const chunks = splitMddForSecurityAudit(mddContent);
    this.logger.log(
      `[SecurityArchitectureAudit] chunk mode: ${chunks.length} secciones (${mddContent.length} chars)`,
    );

    const structuredParts = [];
    for (const chunk of chunks) {
      const raw = await this.invokeChunkExtractor(llm, mddContent, auditedAt, chunk, options);
      const parsed = parseSecurityArchitectureAuditResponse(raw);
      if (parsed.structured) {
        structuredParts.push(parsed.structured);
      }
    }

    const extraction = mergeSecurityArchitectureChunkExtractions(structuredParts);
    this.logger.log(
      `[SecurityArchitectureAudit] chunk merge: ${extraction.hallazgos.length} hallazgos, ` +
        `${extraction.idsVistos.length} ids_vistos → síntesis final`,
    );

    const synthesisRaw = await this.invokeSynthesisAuditor(
      llm,
      mddContent,
      auditedAt,
      extraction,
      options,
    );
    const parsed = parseSecurityArchitectureAuditResponse(synthesisRaw);
    return this.finalizeParsedAudit(parsed);
  }

  private finalizeParsedAudit(parsed: ParsedSecurityArchitectureAudit): ParsedSecurityArchitectureAudit {
    if (!parsed.structured) return parsed;
    const structured = finalizeSecurityArchitectureStructured(parsed.structured);
    return {
      ...parsed,
      structured,
      veredicto: structured.veredicto,
      ordenResolucion: structured.orden_resolucion,
      markdownReport: buildSecurityArchitectureAuditMarkdown(structured),
    };
  }

  private async invokeFamilyExtractor(
    llm: BaseChatModel,
    fullMddContent: string,
    family: string,
    auditedAt: string,
    options?: {
      reinforcement?: boolean;
      priorReason?: string;
      depthReinforcement?: boolean;
    },
  ): Promise<string> {
    const userMessage = buildFamilySecurityAuditUserMessage({
      family,
      mddContent: fullMddContent,
      auditedAt,
      reinforcement: options?.reinforcement,
      priorReason: options?.priorReason,
      depthReinforcement: options?.depthReinforcement,
    });
    return this.invokeAuditorLlm(
      llm,
      userMessage,
      `SecurityArchitectureAuditor:family:${family}`,
    );
  }

  private async invokeChunkExtractor(
    llm: BaseChatModel,
    fullMddContent: string,
    auditedAt: string,
    chunk: MddSecurityAuditChunk,
    options?: {
      reinforcement?: boolean;
      priorReason?: string;
      depthReinforcement?: boolean;
    },
  ): Promise<string> {
    const fechaLine = `Usa exactamente esta fecha_auditoria si la incluyes: "${auditedAt}" (la síntesis final fijará la fecha).`;
    const userParts = [
      SECURITY_ARCHITECTURE_AUDIT_CHUNK_USER_INSTRUCTIONS,
      "",
      `Fragmento del Master Design Document (sección: «${chunk.sectionTitle}»):`,
      "",
      chunk.content,
      "",
      "---",
      `Contexto: MDD completo de ${fullMddContent.length} caracteres.`,
      fechaLine,
    ];

    if (options?.reinforcement) {
      userParts.push(SECURITY_ARCHITECTURE_AUDIT_REINFORCEMENT_USER_SUFFIX);
      if (options.priorReason?.trim()) {
        userParts.push("", `Motivo del reintento: ${options.priorReason.trim()}`);
      }
    }

    return this.invokeAuditorLlm(
      llm,
      userParts.join("\n"),
      `SecurityArchitectureAuditor:extract:${chunk.sectionTitle.slice(0, 40)}`,
    );
  }

  private async invokeSynthesisAuditor(
    llm: BaseChatModel,
    mddContent: string,
    auditedAt: string,
    extraction: ReturnType<typeof mergeSecurityArchitectureChunkExtractions>,
    options?: {
      reinforcement?: boolean;
      priorReason?: string;
      depthReinforcement?: boolean;
    },
  ): Promise<string> {
    const userMessage = buildSecurityArchitectureSynthesisUserMessage({
      mddContent,
      auditedAt,
      extraction,
      reinforcement: options?.reinforcement,
      priorReason: options?.priorReason,
    });
    return this.invokeAuditorLlm(llm, userMessage, "SecurityArchitectureAuditor:synthesis");
  }

  private async invokeAuditorLlm(
    llm: BaseChatModel,
    userContent: string,
    tag: string,
  ): Promise<string> {
    const response = await invokeLlmWithRetry(
      llm,
      [
        new SystemMessage(SECURITY_ARCHITECTURE_AUDITOR_MDD_PROMPT),
        new HumanMessage(userContent),
      ],
      {
        tag,
        maxAttempts: 2,
        isResponseValid: (text) => text.trim().length > 80,
      },
    );

    const raw = extractLlmText(response).trim();
    if (!raw) {
      throw new Error(
        "El auditor no devolvió un informe. Reintenta o revisa la configuración del modelo.",
      );
    }
    return raw;
  }

  private async resolveStageId(
    projectId: string,
    stageId?: string | null,
  ): Promise<string | null> {
    if (stageId?.trim()) return stageId.trim();
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { stages: { orderBy: { ordinal: "asc" } } },
    });
    return pickPrimaryStage(project?.stages ?? [])?.id ?? null;
  }

  private async persistSnapshot(
    stageId: string,
    snapshot: MddSecurityArchitectureAuditSnapshot,
  ): Promise<void> {
    try {
      const stage = await this.prisma.stage.findUnique({
        where: { id: stageId },
        select: { shortTermContext: true },
      });
      const prev =
        stage?.shortTermContext &&
        typeof stage.shortTermContext === "object" &&
        !Array.isArray(stage.shortTermContext)
          ? (stage.shortTermContext as Record<string, unknown>)
          : {};
      await this.prisma.stage.update({
        where: { id: stageId },
        data: {
          shortTermContext: {
            ...prev,
            securityArchitectureAuditSnapshot: JSON.parse(
              JSON.stringify(snapshot),
            ) as Prisma.InputJsonValue,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`[SecurityArchitectureAudit] persist snapshot failed: ${err}`);
    }
  }
}

/** Ejecuta `fn` sobre `items` con límite de concurrencia. */
async function runWithConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const concurrency = Math.max(1, limit);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await fn(current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
}
