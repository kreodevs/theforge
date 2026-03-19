import { Injectable } from "@nestjs/common";
import { ComplexityLevel } from "@maxprime/database";
import type { ComplexityPending } from "@maxprime/shared-types";
import { AiService } from "./ai.service.js";
import { DISCOVERY_BENCHMARK_PROMPT } from "./prompts/discovery-benchmark-prompt.js";
import { PHASE0_DEEP_RESEARCH_PROMPT } from "./prompts/phase0-deep-research-prompt.js";
import { COMPLEXITY_INFERENCE_PROMPT } from "./prompts/complexity-inference-prompt.js";

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

  /**
   * Clasifica LOW / MEDIUM / HIGH a partir de la idea y (opcionalmente) el DBGA ya generado.
   * Usado tras Benchmark stream o generate-benchmark para fijar `Project.complexity`.
   */
  async inferComplexity(userIdea: string, dbgaMarkdown?: string | null): Promise<ComplexityLevel> {
    const p = await this.inferComplexityProposal(userIdea, dbgaMarkdown);
    return p.level;
  }

  /**
   * Propuesta completa para HITL: nivel + plan + motivo (no persiste `complexity` hasta confirmación del usuario).
   */
  async inferComplexityProposal(userIdea: string, dbgaMarkdown?: string | null): Promise<ComplexityPending> {
    const idea = (userIdea ?? "").trim().slice(0, 6000);
    const dbga = (dbgaMarkdown ?? "").trim().slice(0, 14_000);
    let prompt =
      "Clasifica la complejidad del trabajo según las reglas del system prompt.\n\n" +
      (idea ? `Idea / petición:\n---\n${idea}\n---\n\n` : "") +
      (dbga ? `Extracto del Benchmark (DBGA):\n---\n${dbga}\n---` : "");
    if (!idea && !dbga) {
      prompt = "No hay contexto. Responde con complexity HIGH por defecto.";
    }
    try {
      const raw = await this.ai.generateResponse(prompt, [], {
        systemPrompt: COMPLEXITY_INFERENCE_PROMPT,
      });
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const j = JSON.parse(cleaned) as { complexity?: string; planSummary?: string; reason?: string };
      const c = String(j.complexity ?? "").toUpperCase();
      const level: ComplexityLevel =
        c === "LOW" || c === "MEDIUM" || c === "HIGH" ? (c as ComplexityLevel) : ComplexityLevel.HIGH;
      const planSummary = (j.planSummary ?? "").trim() || "Plan según nivel de complejidad estándar.";
      const reason = (j.reason ?? "").trim() || "Clasificación automática.";
      return { level, planSummary, reason };
    } catch {
      return {
        level: ComplexityLevel.HIGH,
        planSummary: "Constitución SDD completa (MDD canónico y entregables alineados).",
        reason: "No se pudo parsear la inferencia; se usa HIGH por defecto.",
      };
    }
  }
}
