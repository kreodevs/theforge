import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  tasksGenerationPlanSchema,
  tasksLlmAuditorOutputSchema,
  TASKS_LLM_AUDITOR_PASS_THRESHOLD,
  TASKS_PIPELINE_MAX_REPAIRS,
  type TasksGenerationPlan,
  type TasksLlmAuditorOutput,
  type TasksPipelineQualitySnapshot,
} from "@theforge/shared-types";
import type { DomainInventory } from "@theforge/shared-types";
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

export type TasksPipelineInput = {
  mddMarkdown: string;
  blueprintMarkdown?: string | null;
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  inventory?: DomainInventory | null;
  gapsFeedback?: string | null;
  hasUxTeam?: boolean;
  legacyBaselineStage?: boolean;
  taskOpts: LegacyGenerateOptions & {
    navigationMap?: string;
    specContent?: string | null;
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
    });
    if (!preflight.ok) {
      throw new BadRequestException({
        code: "TASKS_PREFLIGHT_BLOCKED",
        message: preflight.blockers.join(" "),
        blockers: preflight.blockers,
      });
    }
    for (const w of preflight.warnings) {
      this.logger.warn(`[Tasks pipeline] preflight warning: ${w}`);
    }

    const plannerContext = this.buildPlannerContext(input);
    const plan = await this.runPlanner(plannerContext);
    const planJson = JSON.stringify(plan, null, 2);

    let tasksMarkdown = await this.ai.generateTasks(input.mddMarkdown, input.blueprintMarkdown ?? null, {
      ...input.taskOpts,
      tasksPlanJson: planJson,
      gapsFeedback: input.gapsFeedback,
    });

    let llmAuditor = await this.runLlmAuditor(tasksMarkdown, input);
    let quality = this.evaluateQuality(tasksMarkdown, input);
    let repairAttempts = 0;

    while (
      repairAttempts < TASKS_PIPELINE_MAX_REPAIRS &&
      (!quality.ok || !llmAuditor.passed || llmAuditor.score < TASKS_LLM_AUDITOR_PASS_THRESHOLD)
    ) {
      repairAttempts += 1;
      this.logger.warn(
        `[Tasks pipeline] repair ${repairAttempts}/${TASKS_PIPELINE_MAX_REPAIRS} ` +
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
      "\n\nMDD:\n---\n" + input.mddMarkdown.trim().slice(0, 24_000) + "\n---",
    ];
    const append = (label: string, content?: string | null, cap = 10_000) => {
      const t = (content ?? "").trim();
      if (t.length > 0) parts.push(`\n\n${label}:\n---\n` + t.slice(0, cap) + "\n---");
    };
    append("Blueprint", input.blueprintMarkdown, 12_000);
    append("Spec", input.taskOpts.specContent);
    append("User Stories", input.taskOpts.userStoriesContent);
    append("API Contracts", input.taskOpts.apiContractsContent, 12_000);
    append("Logic Flows", input.taskOpts.logicFlowsContent);
    append("Infra", input.taskOpts.infraContent);
    append("Architecture", input.taskOpts.architectureContent, 12_000);
    append("UX Guide", input.taskOpts.uxUiGuideContent);
    append("Pantallas", input.taskOpts.uiScreensContent, 12_000);
    if (input.taskOpts.navigationMap?.trim()) {
      append("Navigation map", input.taskOpts.navigationMap, 8_000);
    }
    if (input.taskOpts.fileCoordinatesContext?.trim()) {
      parts.push("\n\n" + input.taskOpts.fileCoordinatesContext.trim());
    }
    return parts.join("");
  }

  private async runPlanner(context: string): Promise<TasksGenerationPlan> {
    const raw = await this.ai.generateAuditorResponse(context, [], {
      systemPrompt: TASKS_PLANNER_PROMPT,
      maxTokensOverride: resolveLlmMaxTokensForPurpose("auditor"),
    });
    const jsonText = extractFirstJsonObject(raw) ?? raw.trim();
    const parsed = parseJsonOrThrow(jsonText, tasksGenerationPlanSchema);
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

  private async runLlmAuditor(
    tasksMarkdown: string,
    input: TasksPipelineInput,
  ): Promise<TasksLlmAuditorOutput> {
    const prompt =
      "Audita el siguiente tasks.md contra el MDD y upstream del contexto.\n\n" +
      "MDD (extracto):\n---\n" +
      input.mddMarkdown.trim().slice(0, 12_000) +
      "\n---\n\n" +
      "tasks.md:\n---\n" +
      tasksMarkdown.trim().slice(0, 20_000) +
      "\n---";
    const raw = await this.ai.generateAuditorResponse(prompt, [], {
      systemPrompt: TASKS_AUDITOR_LLM_PROMPT,
      maxTokensOverride: resolveLlmMaxTokensForPurpose("auditor"),
    });
    const jsonText = extractFirstJsonObject(raw) ?? raw.trim();
    const parsed = parseJsonOrThrow(jsonText, tasksLlmAuditorOutputSchema);
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

  private async runRepair(
    tasksMarkdown: string,
    planJson: string,
    feedback: string,
    input: TasksPipelineInput,
  ): Promise<string> {
    const prompt =
      "Repara el documento Tasks según gaps.\n\n" +
      "Plan JSON:\n---\n" +
      planJson +
      "\n---\n\n" +
      "Gaps:\n---\n" +
      feedback +
      "\n---\n\n" +
      "tasks.md actual:\n---\n" +
      tasksMarkdown.trim().slice(0, 22_000) +
      "\n---\n\n" +
      "MDD (referencia):\n---\n" +
      input.mddMarkdown.trim().slice(0, 8_000) +
      "\n---";
    const repaired = await this.ai.generateAuditorResponse(prompt, [], {
      systemPrompt: TASKS_REPAIR_PROMPT,
      maxTokensOverride: resolveLlmMaxTokensForPurpose("document"),
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
