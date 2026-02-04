import { z } from "zod";
import { StatusEnum } from "./status.js";

export const createProjectSchema = z.object({
  name: z.string().min(1),
  hasUxTeam: z.boolean().default(false),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  hasUxTeam: z.boolean().optional(),
  dbgaContent: z.string().optional().nullable(),
  specContent: z.string().optional().nullable(),
  mddContent: z.string().optional().nullable(),
  blueprintContent: z.string().optional().nullable(),
  tasksContent: z.string().optional().nullable(),
  apiContractsContent: z.string().optional().nullable(),
  logicFlowsContent: z.string().optional().nullable(),
  infraContent: z.string().optional().nullable(),
  uxUiGuideContent: z.string().optional().nullable(),
  phase0SummaryContent: z.string().optional().nullable(),
  figmaMapping: z.record(z.unknown()).optional().nullable(),
});

/** Body para POST /projects/:id/phase0-deep-research */
export const phase0DeepResearchBodySchema = z.object({
  userIdea: z.string().optional(),
  urls: z.array(z.string()).optional(),
  includeBenchmark: z.boolean().optional().default(false),
});

export const projectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  hasUxTeam: z.boolean(),
  status: z.enum(StatusEnum),
  precisionScore: z.number(),
  dbgaContent: z.string().nullable(),
  specContent: z.string().nullable(),
  mddContent: z.string().nullable(),
  blueprintContent: z.string().nullable(),
  tasksContent: z.string().nullable(),
  apiContractsContent: z.string().nullable(),
  logicFlowsContent: z.string().nullable(),
  infraContent: z.string().nullable(),
  uxUiGuideContent: z.string().nullable(),
  phase0SummaryContent: z.string().nullable(),
  figmaMapping: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});

export type Phase0DeepResearchBody = z.infer<typeof phase0DeepResearchBodySchema>;
export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
