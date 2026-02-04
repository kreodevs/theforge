import { BadRequestException, Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { Readable } from "node:stream";
import { AiAnalysisService } from "./ai-analysis.service.js";
import { EstimationService } from "./estimation/estimation.service.js";

@Controller("ai-analysis")
export class AiAnalysisController {
  constructor(
    private readonly aiAnalysis: AiAnalysisService,
    private readonly estimationService: EstimationService,
  ) { }

  /**
   * Métricas en vivo de estimación (Semáforo + MXN) para un proyecto.
   * GET: usa borrador en vivo si hay stream MDD activo; sino mddContent del proyecto en DB.
   * POST: si body.mddContent está presente, calcula métricas sobre ese contenido (lo que ve el usuario); sino igual que GET.
   */
  @Get("estimation")
  async getEstimation(@Query("projectId") projectId: string) {
    const id = typeof projectId === "string" ? projectId.trim() : "";
    if (!id) {
      throw new BadRequestException("projectId is required");
    }
    return this.estimationService.getLiveMetricsForProject(id);
  }

  @Post("estimation")
  async postEstimation(@Body() body: { projectId?: string; mddContent?: string }) {
    const id = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    if (!id) {
      throw new BadRequestException("projectId is required");
    }
    const mddContent =
      typeof body?.mddContent === "string" ? body.mddContent.trim() || undefined : undefined;
    return this.estimationService.getLiveMetricsForProject(id, mddContent);
  }

  /**
   * Limpia el borrador en vivo del proyecto (para que la estimación use mddContent guardado en DB).
   * Llamar tras PATCH project con mddContent para que el semáforo refleje el contenido guardado.
   */
  @Post("estimation/clear-draft")
  async clearEstimationDraft(@Body() body: { projectId?: string }) {
    const id = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    if (!id) {
      throw new BadRequestException("projectId is required");
    }
    this.estimationService.clearLiveDraft(id);
    return { ok: true };
  }

  /**
   * Starts a DBGA analysis for the given idea.
   * Body: { idea: string, projectId?: string }. Si projectId viene, se persiste estado por thread para retomar Fase 0.
   */
  @Post("start")
  startAnalysis(@Body() body: { idea?: string; projectId?: string }) {
    const idea = typeof body?.idea === "string" ? body.idea.trim() : "";
    if (!idea) {
      throw new BadRequestException("idea is required");
    }
    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() || undefined : undefined;
    return this.aiAnalysis.startAnalysis(idea, projectId);
  }

  /**
   * Streams the DBGA analysis: NDJSON con eventos { type: "progress"|"done"|"error", agent?, message?, markdown? }.
   * Body: { idea: string, projectId?: string }.
   */
  @Post("stream")
  async streamAnalysis(
    @Body() body: { idea?: string; projectId?: string },
    @Res() res: Response,
  ) {
    const idea = typeof body?.idea === "string" ? body.idea.trim() : "";
    if (!idea) {
      throw new BadRequestException("idea is required");
    }
    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() || undefined : undefined;

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const service = this.aiAnalysis;
    const stream = Readable.from(
      (async function* () {
        for await (const event of service.streamAnalysis(idea, projectId)) {
          yield JSON.stringify(event) + "\n";
        }
      })(),
    );
    stream.pipe(res);
  }

  /**
   * Revisión de consistencia del MDD: re-deriva diagramas (ER desde SQL, etc.) y devuelve el documento actualizado.
   * Body: { projectId: string, mddContent?: string }. Si mddContent no viene, se usa el del proyecto en DB.
   * Respuesta: { mddContent: string }.
   */
  @Post("mdd/review")
  async reviewMdd(@Body() body: { projectId?: string; mddContent?: string }) {
    const id = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    if (!id) {
      throw new BadRequestException("projectId is required");
    }
    const mddContent =
      typeof body?.mddContent === "string" ? body.mddContent.trim() || undefined : undefined;
    const updated = await this.aiAnalysis.reviewMddConsistency(id, mddContent);
    return { mddContent: updated };
  }

  /**
   * Devuelve el threadId del flujo MDD para el proyecto, si existe.
   * El frontend lo usa para rehidratar managerThreadId al reabrir la app y seguir con resume.
   */
  @Get("mdd/thread")
  async getMddThread(@Query("projectId") projectId: string) {
    const id = typeof projectId === "string" ? projectId.trim() : "";
    if (!id) {
      throw new BadRequestException("projectId is required");
    }
    const threadId = await this.aiAnalysis.getMddThreadId(id);
    return { threadId };
  }

  /**
   * Streams the MDD (Master Design Document) pipeline: Clarificador → Security → Integration → Auditor.
   * NDJSON: { type: "progress"|"done"|"error", agent?, message?, markdown? }.
   * Body: { dbgaContent?: string, projectId?: string }. dbgaContent opcional; si no hay Benchmark, los agentes generan un MDD base.
   */
  @Post("mdd/stream")
  async streamMdd(
    @Body() body: { dbgaContent?: string; projectId?: string },
    @Res() res: Response,
  ) {
    const dbgaContent = typeof body?.dbgaContent === "string" ? body.dbgaContent.trim() : "";
    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() || undefined : undefined;

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const service = this.aiAnalysis;
    const stream = Readable.from(
      (async function* () {
        for await (const event of service.streamMddAnalysis(dbgaContent, projectId)) {
          yield JSON.stringify(event) + "\n";
        }
      })(),
    );
    stream.pipe(res);
  }

  /**
   * Flujo MDD con Manager (Supervisor): conversación o entrevista; el Manager responde, hace preguntas o delega en agentes.
   * NDJSON: progress | interrupt { threadId, reply?, questions? } | done | error.
   * Body: { dbgaContent?: string, projectId: string, initialMessage?: string, mddContent?: string }. Requiere projectId.
   * mddContent = borrador actual del MDD para no perder contenido al delegar.
   */
  @Post("mdd/stream/manager")
  async streamMddManager(
    @Body() body: { dbgaContent?: string; projectId?: string; initialMessage?: string; mddContent?: string },
    @Res() res: Response,
  ) {
    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId) {
      throw new BadRequestException("projectId is required for the Manager flow");
    }
    const dbgaContent = typeof body?.dbgaContent === "string" ? body.dbgaContent.trim() : "";
    const initialMessage = typeof body?.initialMessage === "string" ? body.initialMessage.trim() : undefined;
    const mddContent = typeof body?.mddContent === "string" ? body.mddContent.trim() : undefined;

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const service = this.aiAnalysis;
    const stream = Readable.from(
      (async function* () {
        for await (const event of service.streamMddAnalysisWithManager(dbgaContent, projectId, initialMessage, mddContent)) {
          yield JSON.stringify(event) + "\n";
        }
      })(),
    );
    stream.pipe(res);
  }

  /**
   * Reanuda el flujo MDD con Manager tras la respuesta del usuario.
   * Body: { projectId: string, threadId: string, userMessage: string }.
   */
  @Post("mdd/stream/resume")
  async streamMddResume(
    @Body() body: { projectId?: string; threadId?: string; userMessage?: string },
    @Res() res: Response,
  ) {
    const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";
    const threadId = typeof body?.threadId === "string" ? body.threadId.trim() : "";
    const userMessage = typeof body?.userMessage === "string" ? body.userMessage.trim() : "";
    if (!projectId || !threadId) {
      throw new BadRequestException("projectId and threadId are required");
    }
    if (!userMessage) {
      throw new BadRequestException("userMessage is required");
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const service = this.aiAnalysis;
    const stream = Readable.from(
      (async function* () {
        for await (const event of service.streamMddResume(projectId, threadId, userMessage)) {
          yield JSON.stringify(event) + "\n";
        }
      })(),
    );
    stream.pipe(res);
  }
}
