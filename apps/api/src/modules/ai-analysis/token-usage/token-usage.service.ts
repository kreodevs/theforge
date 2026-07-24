/**
 * @fileoverview Servicio de telemetría de tokens. Persiste cada call LLM en la tabla
 * `TokenUsage` (Prisma) y ofrece agregación por documento/modelo para la UI.
 *
 * El servicio se invoca desde los adapters (workshop chat) y desde `mdd-llm-retry.util`
 * (pipeline MDD). La persistencia es fire-and-forget: cualquier error se loggea pero no
 * bloquea el flujo LLM.
 */

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service.js";
import { calculateChatCostUsd } from "../../ai/providers/chat-model-pricing.js";
import { FxRateService } from "../../fx-rate/fx-rate.service.js";
import { registerTokenUsageRecorder } from "../../ai/utils/token-usage-recorder.js";

export type TokenUsageContext =
  | "initial"
  | "regenerate"
  | "repair"
  | "refine"
  | "chat"
  | "tool"
  | "unknown";

export interface TokenUsageEvent {
  projectId: string;
  stageId?: string | null;
  /** Campo documental destino (mddContent, specContent, …) o "chat" para Workshop. */
  documentField: string;
  context: TokenUsageContext;
  /** Nodo del pipeline que produjo el call (software_architect, clarifier, …). Null para chat. */
  node?: string | null;
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  jobId?: string | null;
}

export interface TokenUsageRow extends TokenUsageEvent {
  id: string;
  costUsd: number;
  costMxn: number;
  createdAt: Date;
}

export interface TokenUsageAggregateByDocument {
  documentField: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostMxn: number;
  /** Veces que se regeneró este documento (cada regen es un evento distinto). */
  generations: number;
  /** Desglose por modelo. */
  byModel: Array<{
    providerId: string;
    modelId: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    costMxn: number;
    calls: number;
  }>;
  /** Primera y última vez que se generó este documento. */
  firstAt: Date;
  lastAt: Date;
}

export interface TokenUsageSummary {
  projectId: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostMxn: number;
  documents: TokenUsageAggregateByDocument[];
  /** Tipo de cambio aplicado (snapshot). */
  mxnPerUsd: number;
}

@Injectable()
export class TokenUsageService implements OnModuleInit {
  private readonly logger = new Logger(TokenUsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fxRate: FxRateService,
  ) {}

  onModuleInit(): void {
    registerTokenUsageRecorder(this);
  }

  /**
   * Persiste un evento de uso. Fire-and-forget — los errores se loggean y no se
   * propagan al caller, para no romper el flujo LLM. El `costMxn` se snapshotea
   * en el momento del call con el tipo de cambio vigente (BdD), por lo que
   * cambios posteriores en Ajustes → Sistema NO afectan a eventos ya persistidos.
   */
  async record(event: TokenUsageEvent): Promise<void> {
    try {
      const costUsd = calculateChatCostUsd(
        event.providerId,
        event.modelId,
        event.promptTokens,
        event.completionTokens,
      );
      const costMxn = await this.fxRate.usdToMxn(costUsd);

      await this.prisma.tokenUsage.create({
        data: {
          projectId: event.projectId,
          stageId: event.stageId ?? null,
          documentField: event.documentField,
          context: event.context,
          node: event.node ?? null,
          providerId: event.providerId,
          modelId: event.modelId,
          promptTokens: event.promptTokens,
          completionTokens: event.completionTokens,
          totalTokens: event.totalTokens,
          costUsd,
          costMxn,
          jobId: event.jobId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo persistir TokenUsage (projectId=${event.projectId} model=${event.modelId} tokens=${event.totalTokens}): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Wrapper sync que llama a `record` sin await. Útil en adapters donde no queremos
   * añadir latencia al streaming del chat.
   */
  recordAsync(event: TokenUsageEvent): void {
    void this.record(event);
  }

  /**
   * Resumen agregado por documento para la UI. Solo cuenta generations (no chat).
   * Opcionalmente filtra por stageId.
   */
  async getSummary(
    projectId: string,
    options?: { stageId?: string; includeChat?: boolean },
  ): Promise<TokenUsageSummary> {
    const stageId = options?.stageId;
    const includeChat = options?.includeChat ?? false;

    const where: Record<string, unknown> = { projectId };
    if (stageId) where.stageId = stageId;
    if (!includeChat) {
      where.documentField = { not: "chat" };
    }

    const rows = await this.prisma.tokenUsage.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    const summary = aggregateTokenUsageRows(projectId, rows as RawTokenUsageRow[]);
    // El FX de la respuesta es el vigente al hacer la consulta (puede diferir del
    // snapshot de cada evento si el usuario lo cambió). Se usa para mostrar
    // el TC activo al usuario en la UI; los totales siguen siendo los snapshots.
    return { ...summary, mxnPerUsd: await this.fxRate.getMxnPerUsd() };
  }

  /**
   * Lista de generaciones crudas (debug / admin). Útil para vista detallada.
   */
  async listEvents(
    projectId: string,
    options?: { stageId?: string; documentField?: string; limit?: number },
  ): Promise<TokenUsageRow[]> {
    const where: Record<string, unknown> = { projectId };
    if (options?.stageId) where.stageId = options.stageId;
    if (options?.documentField) where.documentField = options.documentField;

    const rows = await this.prisma.tokenUsage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 100,
    });

    return rows.map((r) => ({
      projectId: r.projectId,
      stageId: r.stageId,
      documentField: r.documentField,
      context: r.context as TokenUsageContext,
      node: r.node,
      providerId: r.providerId,
      modelId: r.modelId,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      jobId: r.jobId,
      id: r.id,
      costUsd: r.costUsd,
      costMxn: r.costMxn,
      createdAt: r.createdAt,
    }));
  }
}

/** Tipo de fila cruda expuesta por la BD (modelo Prisma TokenUsage). */
export interface RawTokenUsageRow {
  projectId: string;
  stageId: string | null;
  documentField: string;
  context: string;
  node: string | null;
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  costMxn: number;
  jobId: string | null;
  createdAt: Date;
}

/**
 * Función pura de agregación. Toma las filas crudas y devuelve el resumen
 * agrupado por documento y modelo. Útil para testing unitario sin Prisma.
 *
 * El parámetro `mxnPerUsd` es informativo (el TC vigente al hacer la consulta);
 * los totales `costMxn` se calculan a partir de los snapshots por evento, no
 * se recalculan aquí.
 */
export function aggregateTokenUsageRows(
  projectId: string,
  rows: RawTokenUsageRow[],
  mxnPerUsd: number = 20,
): TokenUsageSummary {
  const byDocument = new Map<string, TokenUsageAggregateByDocument>();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let totalCostMxn = 0;

  for (const row of rows) {
    totalPromptTokens += row.promptTokens;
    totalCompletionTokens += row.completionTokens;
    totalTokens += row.totalTokens;
    totalCostUsd += row.costUsd;
    totalCostMxn += row.costMxn;

    let doc = byDocument.get(row.documentField);
    if (!doc) {
      doc = {
        documentField: row.documentField,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        totalCostMxn: 0,
        generations: 0,
        byModel: [],
        firstAt: row.createdAt,
        lastAt: row.createdAt,
      };
      byDocument.set(row.documentField, doc);
    }

    doc.totalPromptTokens += row.promptTokens;
    doc.totalCompletionTokens += row.completionTokens;
    doc.totalTokens += row.totalTokens;
    doc.totalCostUsd += row.costUsd;
    doc.totalCostMxn += row.costMxn;
    doc.generations += 1;
    if (row.createdAt < doc.firstAt) doc.firstAt = row.createdAt;
    if (row.createdAt > doc.lastAt) doc.lastAt = row.createdAt;

    let modelEntry = doc.byModel.find(
      (m) => m.providerId === row.providerId && m.modelId === row.modelId,
    );
    if (!modelEntry) {
      modelEntry = {
        providerId: row.providerId,
        modelId: row.modelId,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        costMxn: 0,
        calls: 0,
      };
      doc.byModel.push(modelEntry);
    }
    modelEntry.promptTokens += row.promptTokens;
    modelEntry.completionTokens += row.completionTokens;
    modelEntry.totalTokens += row.totalTokens;
    modelEntry.costUsd += row.costUsd;
    modelEntry.costMxn += row.costMxn;
    modelEntry.calls += 1;
  }

  const documents = Array.from(byDocument.values()).sort((a, b) =>
    a.documentField.localeCompare(b.documentField),
  );

  return {
    projectId,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    totalCostUsd: round(totalCostUsd, 6),
    totalCostMxn: round(totalCostMxn, 6),
    documents,
    mxnPerUsd,
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
