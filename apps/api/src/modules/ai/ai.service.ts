import { Injectable, Inject } from "@nestjs/common";
import type { LLMProvider, GenerateResponseOptions } from "./interfaces/llm-provider.interface.js";
import { LLM_PROVIDER } from "./interfaces/llm-provider.interface.js";
import { MASTER_PROMPT } from "./prompts/master-prompt.js";
import { UX_UI_GUIDE_PROMPT } from "./prompts/ux-ui-guide-prompt.js";
import { BENCHMARK_REFINE_PROMPT } from "./prompts/phase0-benchmark-refine-prompt.js";
import { BLUEPRINT_PROMPT } from "./prompts/blueprint-prompt.js";
import { API_CONTRACTS_PROMPT } from "./prompts/api-contracts-prompt.js";
import { LOGIC_FLOWS_PROMPT } from "./prompts/logic-flows-prompt.js";
import { INFRA_PROMPT } from "./prompts/infra-prompt.js";
import { SPEC_PROMPT } from "./prompts/spec-prompt.js";
import { TASKS_PROMPT } from "./prompts/tasks-prompt.js";
import { VERIFY_DELIVERABLE_PROMPT } from "./prompts/verify-deliverable-prompt.js";
import { CONFORMANCE_CHECK_PROMPT } from "./prompts/conformance-check-prompt.js";

/** Instrucción fija para que ningún documento generado use "militar" (se añade al system prompt en generación de docs). */
const NO_MILITAR_INSTRUCTION =
  "\n\n**Regla obligatoria:** En toda tu respuesta no uses nunca las palabras \"militar\", \"grado militar\" ni variantes; usa \"alta criticidad\", \"misión crítica\" o \"robustez industrial\" en su lugar.";

@Injectable()
export class AiService {
  constructor(
    @Inject(LLM_PROVIDER)
    private readonly provider: LLMProvider,
  ) { }

  private static readonly ACTIVE_TAB_LABELS: Record<string, string> = {
    benchmark: "Benchmark & Gap Analysis (Paso 0)",
    mdd: "MDD",
    "ux-ui-guide": "Guía UX/UI",
    blueprint: "Blueprint",
    "api-contracts": "Contratos de API",
    "logic-flows": "Flujos de lógica",
    infra: "Infraestructura",
  };

  async generateResponse(
    prompt: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
    options?: GenerateResponseOptions,
  ): Promise<string> {
    try {
      const isUxUiGuide = options?.activeTab?.trim() === "ux-ui-guide";
      const isBenchmarkRefine =
        options?.activeTab?.trim() === "benchmark" && (options?.currentDbgaContent?.trim() ?? "").length > 0;
      let systemPrompt =
        options?.systemPrompt ??
        (isBenchmarkRefine ? BENCHMARK_REFINE_PROMPT : isUxUiGuide ? UX_UI_GUIDE_PROMPT : MASTER_PROMPT);
      if (options?.activeTab?.trim()) {
        const label = AiService.ACTIVE_TAB_LABELS[options.activeTab] ?? options.activeTab;
        systemPrompt += `\n\n[Contexto de documento activo:] El usuario está trabajando en: **${label}**. Adapta tu respuesta a ese documento (preguntas, sugerencias o ediciones relevantes para ese contexto).`;
      }
      if (options?.currentDbgaContent?.trim()) {
        if (isBenchmarkRefine) {
          systemPrompt +=
            "\n\n[Contenido actual del Benchmark & Gap Analysis del proyecto (a refinar según la petición del usuario)]\n---\n" +
            options.currentDbgaContent.trim() +
            "\n---";
        } else if (!options?.currentMddContent?.trim()) {
          systemPrompt +=
            "\n\n[Contexto base: Domain Benchmark & Gap Analysis del usuario. Úsalo como referencia para guiar la entrevista y redactar el MDD.]\n---\n" +
            options.currentDbgaContent.trim().slice(0, 4000) +
            "\n---";
        }
      }
      if (options?.currentMddContent?.trim()) {
        systemPrompt +=
          "\n\n[Contenido actual del MDD del proyecto (puede incluir ediciones del usuario)]\n---\n" +
          options.currentMddContent.trim() +
          "\n---";
      }
      if (isUxUiGuide && options?.currentBlueprintContent?.trim()) {
        systemPrompt +=
          "\n\n[Blueprint del proyecto: estructura, pantallas y módulos. Úsalo para alinear la Guía UX/UI con las pantallas y flujos descritos.]\n---\n" +
          options.currentBlueprintContent.trim().slice(0, 6000) +
          "\n---";
      }
      if (options?.currentUxUiGuideContent?.trim()) {
        systemPrompt +=
          "\n\n[Contenido actual de la Guía UX/UI del proyecto (puede incluir ediciones del usuario)]\n---\n" +
          options.currentUxUiGuideContent.trim().slice(0, 6000) +
          "\n---";
      }
      if (options?.learningHistory?.trim()) {
        systemPrompt +=
          "\n\n**HISTORIAL_DE_APRENDIZAJE (proyectos previos del usuario):**\n---\n" +
          options.learningHistory.trim().slice(0, 6000) +
          "\n---";
      }
      const ts = () => new Date().toISOString();
      console.log(`[AiService] ${ts()} → Enviando al LLM:`, {
        activeTab: options?.activeTab,
        promptLength: prompt.length,
        promptPreview: prompt.slice(0, 120) + (prompt.length > 120 ? "…" : ""),
        systemPromptLength: systemPrompt.length,
        historyLength: history.length,
      });
      const out = await this.provider.generateResponse(prompt, history, {
        systemPrompt,
      });
      console.log(`[AiService] ${ts()} ← Respuesta del LLM recibida:`, {
        length: out?.length ?? 0,
        preview: (out ?? "").slice(0, 200) + ((out?.length ?? 0) > 200 ? "…" : ""),
      });
      return out;
    } catch (err) {
      console.error("[AiService] generateResponse error", err);
      throw err;
    }
  }

  /**
   * Streaming: same system prompt as generateResponse, yields chunks from the provider.
   */
  async generateResponseStream(
    prompt: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
    options?: GenerateResponseOptions,
  ): Promise<AsyncIterable<string>> {
    const isUxUiGuide = options?.activeTab?.trim() === "ux-ui-guide";
    const isBenchmarkRefine =
      options?.activeTab?.trim() === "benchmark" && (options?.currentDbgaContent?.trim() ?? "").length > 0;
    let systemPrompt =
      options?.systemPrompt ??
      (isBenchmarkRefine ? BENCHMARK_REFINE_PROMPT : isUxUiGuide ? UX_UI_GUIDE_PROMPT : MASTER_PROMPT);
    if (options?.activeTab?.trim()) {
      const label = AiService.ACTIVE_TAB_LABELS[options.activeTab] ?? options.activeTab;
      systemPrompt += `\n\n[Contexto de documento activo:] El usuario está trabajando en: **${label}**. Adapta tu respuesta a ese documento (preguntas, sugerencias o ediciones relevantes para ese contexto).`;
    }
    if (options?.currentDbgaContent?.trim()) {
      if (isBenchmarkRefine) {
        systemPrompt +=
          "\n\n[Contenido actual del Benchmark & Gap Analysis del proyecto (a refinar según la petición del usuario)]\n---\n" +
          options.currentDbgaContent.trim() +
          "\n---";
      } else if (!options?.currentMddContent?.trim()) {
        systemPrompt +=
          "\n\n[Contexto base: Domain Benchmark & Gap Analysis del usuario. Úsalo como referencia para guiar la entrevista y redactar el MDD.]\n---\n" +
          options.currentDbgaContent.trim().slice(0, 4000) +
          "\n---";
      }
    }
    if (options?.currentMddContent?.trim()) {
      systemPrompt +=
        "\n\n[Contenido actual del MDD del proyecto (puede incluir ediciones del usuario)]\n---\n" +
        options.currentMddContent.trim() +
        "\n---";
    }
    if (isUxUiGuide && options?.currentBlueprintContent?.trim()) {
      systemPrompt +=
        "\n\n[Blueprint del proyecto: estructura, pantallas y módulos. Úsalo para alinear la Guía UX/UI con las pantallas y flujos descritos.]\n---\n" +
        options.currentBlueprintContent.trim().slice(0, 6000) +
        "\n---";
    }
    if (options?.currentUxUiGuideContent?.trim()) {
      systemPrompt +=
        "\n\n[Contenido actual de la Guía UX/UI del proyecto (puede incluir ediciones del usuario)]\n---\n" +
        options.currentUxUiGuideContent.trim().slice(0, 6000) +
        "\n---";
    }
    if (options?.learningHistory?.trim()) {
      systemPrompt +=
        "\n\n**HISTORIAL_DE_APRENDIZAJE (proyectos previos del usuario):**\n---\n" +
        options.learningHistory.trim().slice(0, 6000) +
        "\n---";
    }
    return this.provider.generateResponseStream(prompt, history, { ...options, systemPrompt });
  }

  async parseChecklist(text: string) {
    try {
      return await this.provider.parseChecklist(text);
    } catch (err) {
      console.error("[AiService] parseChecklist error", err);
      throw err;
    }
  }

  /**
   * Genera el contenido de blueprint.md a partir del MDD.
   * Usa BLUEPRINT_PROMPT como system y el MDD como user message.
   */
  /**
   * Genera el documento Spec (SDD: what/why) desde Benchmark + opcional phase0/clarifiedScope.
   */
  async generateSpec(dbgaContent: string, phase0Summary?: string | null): Promise<string> {
    const dbga = (dbgaContent?.trim() ?? "").slice(0, 12000);
    const phase0 = (phase0Summary?.trim() ?? "").slice(0, 4000);
    const prompt =
      dbga.length > 0
        ? "Genera el documento Spec según las instrucciones del system prompt.\n\nBenchmark (DBGA):\n---\n" +
        dbga +
        "\n---" +
        (phase0 ? "\n\nResumen fase 0 / alcance:\n---\n" + phase0 + "\n---" : "")
        : "No hay Benchmark. Genera un Spec genérico (objetivos, alcance, criterios de éxito, user journeys) en markdown.";
    return this.generateResponse(prompt, [], { systemPrompt: SPEC_PROMPT });
  }

  /**
   * Genera el documento Tasks (breakdown) desde MDD + Blueprint.
   */
  async generateTasks(mddContent: string, blueprintContent?: string | null): Promise<string> {
    const mdd = (mddContent?.trim() ?? "").slice(0, 10000);
    const blueprint = (blueprintContent?.trim() ?? "").slice(0, 8000);
    const prompt =
      mdd.length > 0
        ? "Genera el documento Tasks según las instrucciones del system prompt.\n\nMDD:\n---\n" +
        mdd +
        "\n---\n\n" +
        (blueprint ? "Blueprint:\n---\n" + blueprint + "\n---" : "")
        : "No hay MDD. Genera un documento Tasks genérico (Backend, Frontend, Infra) con ítems comprobables.";
    return this.generateResponse(prompt, [], { systemPrompt: TASKS_PROMPT + NO_MILITAR_INSTRUCTION });
  }

  async generateBlueprint(mddContent: string, gapsFeedback?: string | null): Promise<string> {
    const constitutionNote =
      "El siguiente documento es la **Constitución del proyecto** (MDD). Tu salida debe adherirse a él en todo momento.\n\n";
    let prompt =
      mddContent.trim().length > 0
        ? "Genera el blueprint.md según las instrucciones del system prompt. " +
        constitutionNote +
        "MDD:\n\n---\n" +
        mddContent.trim() +
        "\n---"
        : "No hay MDD aún. Genera un blueprint.md genérico para un monorepo Turborepo con NestJS, React, Prisma y PostgreSQL.";
    if (gapsFeedback?.trim()) {
      prompt +=
        "\n\n**Los siguientes puntos deben corregirse o incorporarse:**\n---\n" + gapsFeedback.trim() + "\n---";
    }
    return this.generateResponse(prompt, [], {
      systemPrompt: BLUEPRINT_PROMPT + NO_MILITAR_INSTRUCTION,
    });
  }

  async generateApiContracts(mddContent: string, blueprintContent?: string | null, gapsFeedback?: string | null): Promise<string> {
    const mdd = mddContent?.trim() ?? "";
    const blueprint = (blueprintContent?.trim() ?? "").slice(0, 8000);
    const constitutionNote =
      "El siguiente documento es la **Constitución del proyecto** (MDD). Tu salida debe adherirse a él en todo momento.\n\n";
    let prompt =
      mdd.length > 0
        ? "Genera el documento de Contratos de API según las instrucciones del system prompt.\n\n" +
        constitutionNote +
        "MDD:\n---\n" +
        mdd +
        "\n---\n\n" +
        (blueprint ? "Blueprint (esquema Prisma / estructura):\n---\n" + blueprint + "\n---" : "")
        : "No hay MDD. Genera un documento de contratos API genérico (endpoints, request/response, códigos HTTP).";
    if (gapsFeedback?.trim()) {
      prompt +=
        "\n\n**Los siguientes puntos deben corregirse o incorporarse:**\n---\n" + gapsFeedback.trim() + "\n---";
    }
    return this.generateResponse(prompt, [], {
      systemPrompt: API_CONTRACTS_PROMPT + NO_MILITAR_INSTRUCTION,
    });
  }

  async generateLogicFlows(mddContent: string, gapsFeedback?: string | null): Promise<string> {
    const mdd = mddContent?.trim() ?? "";
    const constitutionNote =
      "El siguiente documento es la **Constitución del proyecto** (MDD). Tu salida debe adherirse a él en todo momento.\n\n";
    let prompt =
      mdd.length > 0
        ? "Genera el documento de Casos de Uso y Flujos de Lógica según las instrucciones del system prompt. " +
        constitutionNote +
        "MDD:\n\n---\n" +
        mdd +
        "\n---"
        : "No hay MDD. Genera un documento de flujos genérico (diagramas Mermaid, reglas de validación).";
    if (gapsFeedback?.trim()) {
      prompt +=
        "\n\n**Los siguientes puntos deben corregirse o incorporarse:**\n---\n" + gapsFeedback.trim() + "\n---";
    }
    return this.generateResponse(prompt, [], {
      systemPrompt: LOGIC_FLOWS_PROMPT + NO_MILITAR_INSTRUCTION,
    });
  }

  async generateInfra(mddContent: string, blueprintContent?: string | null, gapsFeedback?: string | null): Promise<string> {
    const mdd = mddContent?.trim() ?? "";
    const blueprint = (blueprintContent?.trim() ?? "").slice(0, 6000);
    const constitutionNote =
      "El siguiente documento es la **Constitución del proyecto** (MDD). Tu salida debe adherirse a él en todo momento.\n\n";
    let prompt =
      mdd.length > 0
        ? "Genera el documento de Infraestructura y Despliegue según las instrucciones del system prompt.\n\n" +
        constitutionNote +
        "MDD:\n---\n" +
        mdd +
        "\n---\n\n" +
        (blueprint ? "Blueprint (estructura de carpetas / servicios):\n---\n" + blueprint + "\n---" : "")
        : "No hay MDD. Genera un documento de infra genérico (Dockerfile, docker-compose, .env.example).";
    if (gapsFeedback?.trim()) {
      prompt +=
        "\n\n**Los siguientes puntos deben corregirse o incorporarse:**\n---\n" + gapsFeedback.trim() + "\n---";
    }
    return this.generateResponse(prompt, [], {
      systemPrompt: INFRA_PROMPT + NO_MILITAR_INSTRUCTION,
    });
  }

  /**
   * Reflexión (SDD Fase 3): verifica si un entregable cumple el MDD. Devuelve texto breve (Cumple / No cumple + gaps).
   */
  async verifyDeliverable(
    mddContent: string,
    documentContent: string,
    deliverableKind: "blueprint" | "api" | "infra",
  ): Promise<string> {
    const kindLabel = { blueprint: "Blueprint", api: "Contratos de API", infra: "Infraestructura" }[deliverableKind];
    const prompt = `Verifica si el siguiente documento **${kindLabel}** cumple el MDD (Constitución) que se proporciona.\n\nMDD:\n---\n${(mddContent || "").trim().slice(0, 8000)}\n---\n\nDocumento ${kindLabel}:\n---\n${(documentContent || "").trim().slice(0, 6000)}\n---`;
    return this.generateResponse(prompt, [], { systemPrompt: VERIFY_DELIVERABLE_PROMPT });
  }

  /**
   * Conformance por LLM: devuelve { ok, gaps } para complementar heurísticas y reducir falsos positivos/negativos.
   */
  async conformanceCheck(
    mddContent: string,
    documentContent: string,
    kind: "blueprint" | "api" | "logicFlows" | "infra",
  ): Promise<{ ok: boolean; gaps: string[] }> {
    const kindLabel = { blueprint: "Blueprint", api: "Contratos de API", logicFlows: "Flujos de lógica", infra: "Infraestructura" }[kind];
    const prompt = `¿El siguiente documento **${kindLabel}** cumple el MDD?\n\nMDD:\n---\n${(mddContent || "").trim().slice(0, 6000)}\n---\n\nDocumento ${kindLabel}:\n---\n${(documentContent || "").trim().slice(0, 4000)}\n---`;
    try {
      const raw = await this.generateResponse(prompt, [], { systemPrompt: CONFORMANCE_CHECK_PROMPT });
      const trimmed = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(trimmed) as { ok?: boolean; gaps?: string[] };
      const ok = parsed?.ok === true;
      const gaps = Array.isArray(parsed?.gaps) ? parsed.gaps.filter((g) => typeof g === "string") : [];
      return { ok, gaps };
    } catch {
      return { ok: true, gaps: [] };
    }
  }
}
