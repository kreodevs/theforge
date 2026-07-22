import { z } from "zod";

/** Capas de abstracción del manifiesto Tasks (cadena SDD → Tasks). */
export const tasksContractLayerSchema = z.enum([
  "domain",
  "architecture",
  "experience",
  "integration",
]);

export type TasksContractLayer = z.infer<typeof tasksContractLayerSchema>;

/** Capa de generación map-reduce (prompt segmentado). */
export const tasksGenerationLayerSchema = z.enum([
  "Backend",
  "Frontend",
  "Infra",
  "QA",
  "Integración",
]);

export type TasksGenerationLayer = z.infer<typeof tasksGenerationLayerSchema>;

export const tasksGlossaryEntrySchema = z.object({
  term: z.string().min(1),
  definition: z.string().optional(),
});

export const tasksBusinessRuleSchema = z.object({
  rule: z.string().min(1),
  source: z.string().optional(),
});

export const tasksTechStackContractSchema = z.object({
  framework: z.string().optional(),
  patterns: z.array(z.string()).default([]),
  conventions: z.array(z.string()).default([]),
  boundaries: z.array(z.string()).default([]),
});

export const tasksEndpointContractSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  summary: z.string().optional(),
  dtoHints: z.array(z.string()).default([]),
});

export const tasksScreenContractSchema = z.object({
  route: z.string().min(1),
  name: z.string().optional(),
  userStoryId: z.string().optional(),
  components: z.array(z.string()).default([]),
  states: z.array(z.string()).default([]),
  primaryApi: z.string().optional(),
});

export const tasksUserStoryContractSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  acceptanceCriteria: z.array(z.string()).default([]),
  role: z.string().optional(),
  want: z.string().optional(),
});

/** Contrato liviano por capa de abstracción. */
export const tasksLayerContractSchema = z.object({
  layer: tasksContractLayerSchema,
  glossary: z.array(tasksGlossaryEntrySchema).default([]),
  businessRules: z.array(tasksBusinessRuleSchema).default([]),
  techStack: tasksTechStackContractSchema.optional(),
  userStories: z.array(tasksUserStoryContractSchema).default([]),
  screens: z.array(tasksScreenContractSchema).default([]),
  endpoints: z.array(tasksEndpointContractSchema).default([]),
  externalServices: z.array(z.string()).default([]),
  infraServices: z.array(z.string()).default([]),
});

export type TasksLayerContract = z.infer<typeof tasksLayerContractSchema>;

/** Manifiesto denso índice de conceptos (Paso 1 del algoritmo). */
export const tasksContractManifestSchema = z.object({
  version: z.literal(1),
  layers: z.array(tasksLayerContractSchema),
  extractedAt: z.string().optional(),
});

export type TasksContractManifest = z.infer<typeof tasksContractManifestSchema>;

/** Context Anchor focalizado por HU (Paso 3 — inyección mínima). */
export const tasksContextAnchorSchema = z.object({
  story_id: z.string().min(1),
  feature: z.string().min(1),
  business_rules: z.array(z.string()).default([]),
  tech_stack: z
    .object({
      framework: z.string().optional(),
      patterns: z.string().optional(),
    })
    .optional(),
  contracts: z
    .object({
      endpoints: z.array(z.string()).default([]),
      ui_components: z.array(z.string()).default([]),
      screens: z.array(z.string()).default([]),
    })
    .default({ endpoints: [], ui_components: [], screens: [] }),
  acceptance_criteria: z.array(z.string()).default([]),
});

export type TasksContextAnchor = z.infer<typeof tasksContextAnchorSchema>;
