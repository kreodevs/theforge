import { Injectable } from "@nestjs/common";
import { AiService } from "./ai.service.js";
import { DISCOVERY_BENCHMARK_PROMPT } from "./prompts/discovery-benchmark-prompt.js";
import { PHASE0_DEEP_RESEARCH_PROMPT } from "./prompts/phase0-deep-research-prompt.js";

/**
 * Servicio de descubrimiento: Domain Benchmark & Gap Analysis (DBGA).
 * Genera el documento de referencia de industria, checklist estándar y detección de brechas
 * a partir de la idea del usuario, antes del MDD.
 *
 * Persistencia Fase 0: el checkpointer LangGraph (PostgresSaver) y el thread_id por proyecto
 * están en AiAnalysisModule (ai-analysis). Para retomar investigaciones pausadas, invocar
 * POST /ai-analysis/start con { idea, projectId }; el thread_id se asocia al proyecto vía
 * AgentStateCheckpoint.
 */
@Injectable()
export class DiscoveryService {
  constructor(private readonly ai: AiService) { }

  /**
   * Genera el contenido del DBGA (Domain Benchmark & Gap Analysis) para la idea del usuario.
   * Incluye: Referencia de Industria (3 líderes), Standard Feature Checklist, Gap Detection.
   * Si se proporciona scrapedContext (contenido de URLs), se usa para enriquecer el benchmark.
   * El resultado debe persistirse en project.dbgaContent por el caller.
   */
  async generateBenchmark(userIdea: string, scrapedContext?: string): Promise<string> {
    let prompt =
      userIdea?.trim().length > 0
        ? "Genera el Domain Benchmark & Gap Analysis según las instrucciones del system prompt.\n\nIdea o descripción del usuario:\n---\n" +
        userIdea.trim() +
        "\n---"
        : "No hay idea proporcionada. Genera un DBGA genérico de ejemplo (referencia de industria, checklist estándar, gap detection) para un producto de software típico.";
    if (scrapedContext?.trim()) {
      prompt +=
        "\n\n**IMPORTANTE:** El siguiente bloque es contenido REAL obtenido por scraping de las URLs que el usuario indicó. Es OBLIGATORIO usarlo como fuente principal: extrae de aquí las funcionalidades, características, precios/planes y estándares que aparezcan; no lo sustituyas por conocimiento genérico. Si el contenido está vacío o es poco relevante, entonces sí complementa con tu conocimiento.\n\nContenido de las referencias (URLs):\n---\n" +
        scrapedContext.trim().slice(0, 30_000) +
        (scrapedContext.length > 30_000 ? "\n…" : "") +
        "\n---";
    }
    return this.ai.generateResponse(prompt, [], {
      systemPrompt: DISCOVERY_BENCHMARK_PROMPT,
    });
  }

  /**
   * Genera el documento de resumen (deep research) a partir de la idea del usuario,
   * contenido scrapeado de URLs y opcionalmente el DBGA. El resultado se persiste en phase0SummaryContent.
   */
  async generatePhase0DeepResearch(
    userIdea: string,
    scrapedContext?: string,
    dbgaContent?: string,
  ): Promise<string> {
    let prompt = "Genera el documento de resumen (deep research) según las instrucciones del system prompt.\n\n";
    if (userIdea?.trim()) {
      prompt += "Idea o petición del usuario:\n---\n" + userIdea.trim() + "\n---\n\n";
    }
    if (scrapedContext?.trim()) {
      prompt +=
        "Contenido de referencias (URLs) scrapeado:\n---\n" +
        scrapedContext.trim().slice(0, 25_000) +
        (scrapedContext.length > 25_000 ? "\n…" : "") +
        "\n---\n\n";
    }
    if (dbgaContent?.trim()) {
      prompt +=
        "Benchmark & Gap Analysis del proyecto (contexto):\n---\n" +
        dbgaContent.trim().slice(0, 15_000) +
        (dbgaContent.length > 15_000 ? "\n…" : "") +
        "\n---\n\n";
    }
    if (!userIdea?.trim() && !scrapedContext?.trim() && !dbgaContent?.trim()) {
      prompt += "No se proporcionó idea ni referencias. Genera un resumen genérico de investigación de dominio.\n\n";
    }
    return this.ai.generateResponse(prompt, [], {
      systemPrompt: PHASE0_DEEP_RESEARCH_PROMPT,
    });
  }
}
