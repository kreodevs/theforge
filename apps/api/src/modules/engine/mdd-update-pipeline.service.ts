import { Injectable } from "@nestjs/common";
import { Status } from "@maxprime/database";
import { SemaphoreService, type SemaphoreEvaluationInput } from "./semaphore.service.js";
import { normalizeMddContent } from "./mdd-markdown-parser.js";
import { preRenderMddSanity, sanitizeMermaidInDraft } from "./mdd-pre-render.js";

export type MddUpdatePipelineResult =
  | { ok: true; sanitizedMdd: string; status: Status; precisionScore: number }
  | { ok: false; code: string; message: string };

/**
 * Responsabilidad única: validar MDD (sanity), sanitizar Mermaid y evaluar semáforo.
 * Usado por ProjectsService cuando se actualiza mddContent.
 */
@Injectable()
export class MddUpdatePipelineService {
  constructor(private readonly semaphore: SemaphoreService) {}

  /**
   * Valida el borrador, sanitiza bloques Mermaid y evalúa semáforo.
   * Si la validación falla, devuelve ok: false con code y message.
   */
  process(
    rawMddContent: string,
    semaphoreBase: Omit<SemaphoreEvaluationInput, "mddJsonString">,
  ): MddUpdatePipelineResult {
    const sanity = preRenderMddSanity(rawMddContent);
    if (!sanity.ok) {
      return {
        ok: false,
        code: sanity.code ?? "ERR_VALIDATION",
        message: sanity.message ?? "Error de validación del MDD",
      };
    }
    const sanitizedMdd = sanitizeMermaidInDraft(rawMddContent);
    const normalized = normalizeMddContent(sanitizedMdd);
    const contentForSemaphore = JSON.stringify(normalized);
    const { status, precisionScore } = this.semaphore.evaluate({
      ...semaphoreBase,
      mddJsonString: contentForSemaphore,
    });
    return {
      ok: true,
      sanitizedMdd,
      status,
      precisionScore,
    };
  }
}
