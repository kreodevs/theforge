import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  tasksGenerationPlanSchema,
  tasksLlmAuditorOutputSchema,
  TASKS_LLM_AUDITOR_PASS_THRESHOLD,
  TASKS_PIPELINE_MAX_REPAIRS,
  TASKS_PIPELINE_MAX_REPAIRS_TRUNCATED,
  type TasksGenerationPlan,
  type TasksLlmAuditorOutput,
  type TasksPipelineQualitySnapshot,
} from "@theforge/shared-types";
import type { DomainInventory } from "@theforge/shared-types";
import type { z } from "zod";
import { resolveLlmMaxTokensForPurpose } from "../ai/config/llm-config.js";
import { AiService, type LegacyGenerateOptions } from "../ai/ai.service.js";
import {
  TASKS_AUDITOR_LLM_PROMPT,
  TASKS_PLANNER_PROMPT,
  TASKS_REPAIR_PROMPT,
} from "../ai/prompts/tasks-pipeline-prompts.js";
import { extractFirstJsonObject, parseJsonOrThrow } from "../ai-analysis/utils/parse-json.js";
import {
  evaluateTasksGenerationQuality,
  type TasksQualityReport,
} from "./tasks-generation-quality.util.js";
import { runTasksPreflightStrict } from "./tasks-preflight.util.js";
import { buildHeuristicTasksPlan } from "./tasks-heuristic-plan.util.js";
import { buildSlimTasksPlannerContext } from "./tasks-planner-context.util.js";
import {
  buildTasksCoverageChecklist,
  serializeTasksCoverageChecklist,
} from "./tasks-coverage-checklist.util.js";
import { isTasksDocumentTruncated } from "./tasks-generation-structure.util.js";

export type TasksPipelineInput = {
  mddMarkdown: string;
  blueprintMarkdown?: string | null;
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  inventory?: DomainInventory | null;
  gapsFeedback?: string | null;
  hasUxTeam?: boolean;
  legacyBaselineStage?: boolean;
  acknowledgeGaps?: boolean;
  taskOpts: LegacyGenerateOptions & {
    navigationMap?: string;
    specContent?: string | null;
    useCasesContent?: string | null;
    userStoriesContent?: string | null;
    apiContractsContent?: string | null;
    logicFlowsContent?: string | null;
    infraContent?: string | null;
    architectureContent?: string | null;
    uxUiGuideContent?: string | null;
    uiScreensContent?: string | null;
    fileCoordinatesContext?: string | null;
    coordinatesMode?: boolean;
  };
};

export type TasksPipelineResult = {
  tasksMarkdown: string;
  quality: TasksQualityReport;
  llmAuditor: TasksLlmAuditorOutput | null;
  plan: TasksGenerationPlan | null;
  snapshot: TasksPipelineQualitySnapshot;
};

@Injectable()
export class TasksGenerationPipelineService {
  private readonly logger = new Logger(TasksGenerationPipelineService.name);

  constructor(private readonly ai: AiService) {}

  async run(input: TasksPipelineInput): Promise<TasksPipelineResult> {
    const preflight = await runTasksPreflightStrict({
      mddMarkdown: input.mddMarkdown,
      brdMarkdown: input.brdMarkdown,
      dbgaMarkdown: input.dbgaMarkdown,
      blueprintMarkdown: input.blueprintMarkdown,
      specMarkdown: input.taskOpts.specContent,
      apiContractsMarkdown: input.taskOpts.apiContractsContent,
      hasUxTeam: input.hasUxTeam,
      uiScreensMarkdown: input.taskOpts.uiScreensContent,
      logicFlowsMarkdown: input.taskOpts.logicFlowsContent,
      inventory: input.inventory,
      legacyBaselineStage: input.legacyBaselineStage,
      acknowledgeGaps: input.acknowledgeGaps,
    });
    if (!preflight.ok) {
      throw new BadRequestException({
        code: "TASKS_PREFLIGHT_BLOCKED",
        message: preflight.blockers.join(" "),
        blockers: preflight.blockers,
        upstreamHints: preflight.upstreamHints,
        docAccuracyScore: preflight.docAccuracyScore,
      });
    }
    for (const w of preflight.warnings) {
      this.logger.warn(`[Tasks pipeline] preflight warning: ${w}`);
    }
    if (preflight.upstreamHints?.length) {
      this.logger.warn(
        `[Tasks pipeline] upstream hints: ${preflight.upstreamHints.slice(0, 4).join(" | ")}`,
      );
    }

    const plannerContext = this.buildPlannerContext(input);
    const plan = await this.runPlanner(plannerContext, input);
    const planJson = JSON.stringify(plan, null, 2);

    let tasksMarkdown = await this.ai.generateTasks(input.mddMarkdown, input.blueprintMarkdown ?? null, {
      ...input.taskOpts,
      tasksPlanJson: planJson,
      gapsFeedback: input.gapsFeedback,
    });

    let llmAuditor = await this.runLlmAuditor(tasksMarkdown, input);
    let quality = this.evaluateQuality(tasksMarkdown, input);
    let repairAttempts = 0;
    const maxRepairs = isTasksDocumentTruncated(tasksMarkdown)
      ? TASKS_PIPELINE_MAX_REPAIRS_TRUNCATED
      : TASKS_PIPELINE_MAX_REPAIRS;

    while (
      repairAttempts < maxRepairs &&
      (!quality.ok || !llmAuditor.passed || llmAuditor.score < TASKS_LLM_AUDITOR_PASS_THRESHOLD)
    ) {
      repairAttempts += 1;
      this.logger.warn(
        `[Tasks pipeline] repair ${repairAttempts}/${maxRepairs} ` +
          `(det=${quality.score}, llm=${llmAuditor.score})`,
      );
      const repairFeedback = this.composeRepairFeedback(quality, llmAuditor, input.gapsFeedback);
      tasksMarkdown = await this.runRepair(tasksMarkdown, planJson, repairFeedback, input);
      llmAuditor = await this.runLlmAuditor(tasksMarkdown, input);
      quality = this.evaluateQuality(tasksMarkdown, input);
    }

    const snapshot: TasksPipelineQualitySnapshot = {
      deterministicScore: quality.score,
      taskAccuracyScore: quality.accuracyScore,
      auditScore: quality.auditScore,
      llmAuditorScore: llmAuditor.score,
      taskCount: quality.taskCount,
      plannerItemCount: plan.items.length,
      repairAttempts,
      passed:
        quality.ok &&
        llmAuditor.passed &&
        llmAuditor.score >= TASKS_LLM_AUDITOR_PASS_THRESHOLD,
      capturedAt: new Date().toISOString(),
    };

    if (!snapshot.passed) {
      const blockers = [
        quality.feedback,
        !quality.ok ? `deterministic score ${quality.score}` : null,
        llmAuditor.score < TASKS_LLM_AUDITOR_PASS_THRESHOLD
          ? `LLM auditor ${llmAuditor.score} < ${TASKS_LLM_AUDITOR_PASS_THRESHOLD}`
          : null,
      ]
        .filter(Boolean)
        .join("; ");
      this.logger.warn(`[Tasks pipeline] blocked persist (${blockers})`);
      throw new BadRequestException({
        code: "TASKS_QUALITY_BLOCKED",
        message:
          "Tasks no cumple umbral de calidad estructural/determinístico/auditor. Regenera tras corregir upstream (pantallas, API, MDD).",
        snapshot,
        feedback: quality.feedback,
        llmAuditor,
      });
    }

    return {
      tasksMarkdown,
      quality,
      llmAuditor,
      plan,
      snapshot,
    };
  }

  private buildPlannerContext(input: TasksPipelineInput): string {
    const parts: string[] = [
      "Genera el plan JSON de Tasks según el system prompt.",
      "\n\nMDD:\n---\n" + input.mddMarkdown.trim().slice(0, 40_000) + "\n---",
    ];
    const append = (label: string, content?: string | null, cap = 10_000) => {
      const t = (content ?? "").trim();
      if (t.length > 0) parts.push(`\n\n${label}:\n---\n` + t.slice(0, cap) + "\n---");
    };
    append("Blueprint", input.blueprintMarkdown, 20_000);
    append("Spec", input.taskOpts.specContent, 15_000);
    append("Use Cases", input.taskOpts.useCasesContent, 10_000);
    append("User Stories", input.taskOpts.userStoriesContent, 10_000);
    append("API Contracts", input.taskOpts.apiContractsContent, 20_000);
    append("Logic Flows", input.taskOpts.logicFlowsContent, 12_000);
    append("Infra", input.taskOpts.infraContent, 10_000);
    append("Architecture", input.taskOpts.architectureContent, 8_000);
    if (input.hasUxTeam) {
      append("UX Guide", input.taskOpts.uxUiGuideContent, 8_000);
    }
    append("Pantallas", input.taskOpts.uiScreensContent, 20_000);
    if (input.taskOpts.navigationMap?.trim()) {
      append("Navigation map", input.taskOpts.navigationMap, 8_000);
    }
    if (input.taskOpts.fileCoordinatesContext?.trim()) {
      parts.push("\n\n" + input.taskOpts.fileCoordinatesContext.trim().slice(0, 6_000));
    }
    return parts.join("");
  }

  private async runPlanner(context: string, input: TasksPipelineInput): Promise<TasksGenerationPlan> {
    const contexts: Array<{ label: string; prompt: string }> = [
      { label: "full", prompt: context },
      {
        label: "slim",
        prompt: buildSlimTasksPlannerContext(
          {
            mddMarkdown: input.mddMarkdown,
            blueprintMarkdown: input.blueprintMarkdown,
            taskOpts: input.taskOpts,
          },
          input.inventory,
        ),
      },
    ];

    for (const { label, prompt } of contexts) {
      const parsed = await this.tryCallAuditorJson({
        step: "planner",
        prompt,
        systemPrompt: TASKS_PLANNER_PROMPT,
        schema: tasksGenerationPlanSchema,
        maxTokensPurpose: "tasksPlanner",
      });
      if (parsed) {
        this.logger.log(`[Tasks pipeline] planner OK (${label}, ${parsed.items.length} items)`);
        return {
          sections: parsed.sections ?? [],
          items: parsed.items.map((item) => ({
            ...item,
            mddRefs: item.mddRefs ?? [],
            storyRefs: item.storyRefs ?? [],
            upstreamRefs: item.upstreamRefs ?? [],
            dependsOn: item.dependsOn ?? [],
            targetFilesHint: item.targetFilesHint ?? [],
          })),
        };
      }
      this.logger.warn(`[Tasks pipeline] planner JSON failed (${label})`);
    }

    const heuristic = buildHeuristicTasksPlan({
      mddMarkdown: input.mddMarkdown,
      apiContractsMarkdown: input.taskOpts.apiContractsContent,
      uiScreensMarkdown: input.taskOpts.uiScreensContent,
      inventory: input.inventory,
      hasUxTeam: input.hasUxTeam,
    });
    this.logger.warn(
      `[Tasks pipeline] planner heuristic fallback (${heuristic.items.length} items) — revisa auditorChatModel o upstream`,
    );
    return heuristic;
  }

  private buildAuditorUpstreamContext(input: TasksPipelineInput, tasksMarkdown: string): string {
    const append = (label: string, content?: string | null, cap = 8_000) => {
      const t = (content ?? "").trim();
      if (!t) return "";
      return `\n\n${label}:\n---\n${t.slice(0, cap)}\n---`;
    };
    const checklist = buildTasksCoverageChecklist({
      tasksMarkdown,
      apiContractsMarkdown: input.taskOpts.apiContractsContent,
      uiScreensMarkdown: input.taskOpts.uiScreensContent,
      mddMarkdown: input.mddMarkdown,
      infraMarkdown: input.taskOpts.infraContent,
    });
    return (
      append("API Contracts", input.taskOpts.apiContractsContent, 12_000) +
      append("Pantallas", input.taskOpts.uiScreensContent, 12_000) +
      append("User Stories", input.taskOpts.userStoriesContent, 6_000) +
      append("Use Cases", input.taskOpts.useCasesContent, 6_000) +
      `\n\nChecklist determinista (gaps conocidos):\n---\n${serializeTasksCoverageChecklist(checklist)}\n---`
    );
  }

  private async runLlmAuditor(
    tasksMarkdown: string,
    input: TasksPipelineInput,
  ): Promise<TasksLlmAuditorOutput> {
    const upstream = this.buildAuditorUpstreamContext(input, tasksMarkdown);
    const prompt =
      "Audita el siguiente tasks.md contra el MDD y upstream del contexto.\n\n" +
      "MDD (extracto):\n---\n" +
      input.mddMarkdown.trim().slice(0, 16_000) +
      "\n---\n\n" +
      upstream +
      "\n\ntasks.md:\n---\n" +
      tasksMarkdown.trim().slice(0, 24_000) +
      "\n---";
    const parsed = await this.callAuditorJson({
      step: "auditor",
      prompt,
      systemPrompt: TASKS_AUDITOR_LLM_PROMPT,
      schema: tasksLlmAuditorOutputSchema,
      maxTokensPurpose: "auditor",
    });
    const normalized: TasksLlmAuditorOutput = {
      score: parsed.score,
      passed: parsed.passed,
      missing_coverage: parsed.missing_coverage ?? [],
      conflicts: parsed.conflicts ?? [],
      traceability_gaps: parsed.traceability_gaps ?? [],
      dependency_issues: parsed.dependency_issues ?? [],
      executable_gaps: parsed.executable_gaps ?? [],
      feedback: parsed.feedback,
    };
    const passed =
      normalized.passed &&
      normalized.score >= TASKS_LLM_AUDITOR_PASS_THRESHOLD &&
      normalized.conflicts.length === 0 &&
      normalized.dependency_issues.length === 0;
    return { ...normalized, passed };
  }

  /**
   * LLM auditor/planner con reintento si el modelo no devuelve JSON parseable.
   * Devuelve null si agota reintentos (planner usa fallback heurístico).
   */
  private async tryCallAuditorJson<T>(params: {
    step: "planner" | "auditor";
    prompt: string;
    systemPrompt: string;
    schema: z.ZodType<T>;
    maxTokensPurpose: "tasksPlanner" | "auditor";
  }): Promise<T | null> {
    const maxTokens = resolveLlmMaxTokensForPurpose(params.maxTokensPurpose);
    const retrySuffix =
      "\n\nIMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido (JSON.parse). " +
      "Sin markdown, sin fences ```, sin texto antes ni después.";
    const prompts = [params.prompt, params.prompt + retrySuffix];

    for (let attempt = 0; attempt < prompts.length; attempt++) {
      const raw = await this.ai.generateAuditorResponse(prompts[attempt]!, [], {
        systemPrompt: params.systemPrompt,
        maxTokensOverride: maxTokens,
        jsonObjectMode: true,
      });
      if (!raw.trim()) {
        this.logger.warn(
          `[Tasks pipeline] ${params.step} empty response (attempt ${attempt + 1})`,
        );
        continue;
      }
      try {
        const jsonText = extractFirstJsonObject(raw) ?? raw.trim();
        return parseJsonOrThrow(jsonText, params.schema);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[Tasks pipeline] ${params.step} JSON parse failed (attempt ${attempt + 1}): ${detail}; preview=${raw.trim().slice(0, 120)}`,
        );
      }
    }
    return null;
  }

  /** Auditor LLM — fallo duro (no hay fallback determinista). */
  private async callAuditorJson<T>(params: {
    step: "planner" | "auditor";
    prompt: string;
    systemPrompt: string;
    schema: z.ZodType<T>;
    maxTokensPurpose: "tasksPlanner" | "auditor";
  }): Promise<T> {
    const parsed = await this.tryCallAuditorJson(params);
    if (parsed) return parsed;

    throw new BadRequestException({
      code:
        params.step === "planner"
          ? "TASKS_PLANNER_JSON_FAILED"
          : "TASKS_AUDITOR_JSON_FAILED",
      message:
        `Tasks ${params.step === "planner" ? "Planner" : "Auditor LLM"}: ` +
        "el modelo no devolvió JSON válido tras reintentos. Reintenta o cambia auditorChatModel.",
    });
  }

  private async runRepair(
    tasksMarkdown: string,
    planJson: string,
    feedback: string,
    input: TasksPipelineInput,
  ): Promise<string> {
    const upstream = this.buildAuditorUpstreamContext(input, tasksMarkdown);
    const prompt =
      "Repara el documento Tasks según gaps.\n\n" +
      "Plan JSON:\n---\n" +
      planJson +
      "\n---\n\n" +
      "Gaps:\n---\n" +
      feedback +
      "\n---\n\n" +
      upstream +
      "\n\ntasks.md actual:\n---\n" +
      tasksMarkdown.trim().slice(0, 22_000) +
      "\n---\n\n" +
      "MDD (referencia):\n---\n" +
      input.mddMarkdown.trim().slice(0, 10_000) +
      "\n---";
    const repaired = await this.ai.generateAuditorResponse(prompt, [], {
      systemPrompt: TASKS_REPAIR_PROMPT,
      maxTokensOverride: resolveLlmMaxTokensForPurpose("tasksDoc"),
    });
    const trimmed = repaired.trim();
    if (trimmed.startsWith("#") || trimmed.includes("## Backend")) {
      return trimmed;
    }
    return await this.ai.generateTasks(input.mddMarkdown, input.blueprintMarkdown ?? null, {
      ...input.taskOpts,
      tasksPlanJson: planJson,
      gapsFeedback: feedback,
      tasksAuditorFeedback: feedback,
    });
  }

  private evaluateQuality(tasksMarkdown: string, input: TasksPipelineInput): TasksQualityReport {
    return evaluateTasksGenerationQuality({
      tasksMarkdown,
      mddMarkdown: input.mddMarkdown,
      brdMarkdown: input.brdMarkdown,
      dbgaMarkdown: input.dbgaMarkdown,
      inventory: input.inventory,
      uiScreensMarkdown: input.taskOpts.uiScreensContent,
      apiContractsMarkdown: input.taskOpts.apiContractsContent,
      infraMarkdown: input.taskOpts.infraContent,
      userStoriesMarkdown: input.taskOpts.userStoriesContent,
    });
  }

  private composeRepairFeedback(
    quality: TasksQualityReport,
    llmAuditor: TasksLlmAuditorOutput,
    externalGaps?: string | null,
  ): string {
    const lines: string[] = [];
    if (externalGaps?.trim()) lines.push(externalGaps.trim());
    if (quality.feedback?.trim()) lines.push(quality.feedback.trim());
    if (llmAuditor.feedback?.trim()) lines.push(llmAuditor.feedback.trim());
    for (const g of llmAuditor.missing_coverage) lines.push(`Cobertura: ${g}`);
    for (const g of llmAuditor.conflicts) lines.push(`Conflicto: ${g}`);
    for (const g of llmAuditor.traceability_gaps) lines.push(`Trazabilidad: ${g}`);
    for (const g of llmAuditor.dependency_issues) lines.push(`Dependencia: ${g}`);
    for (const g of llmAuditor.executable_gaps) lines.push(`Ejecutabilidad: ${g}`);
    return [...new Set(lines.map((l) => l.trim()).filter(Boolean))].join("\n");
  }
}
