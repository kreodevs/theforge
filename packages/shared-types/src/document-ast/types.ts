import { z } from "zod";

// ═══════════════════════════════════════════════════════════
// RFC-001: Document Engine v2 — AST Types
// ═══════════════════════════════════════════════════════════

// ── Field Definitions ──────────────────────────────────────
export const fieldConstraintSchema = z.object({
  type: z.enum(["required", "unique", "index", "default", "check", "foreign_key"]),
  value: z.any().optional(),
  expression: z.string().optional(),
  reference: z.object({
    table: z.string(),
    column: z.string(),
    onDelete: z.enum(["CASCADE", "SET_NULL", "RESTRICT", "NO_ACTION"]).optional(),
    onUpdate: z.enum(["CASCADE", "SET_NULL", "RESTRICT", "NO_ACTION"]).optional(),
  }).optional(),
});
export type FieldConstraint = z.infer<typeof fieldConstraintSchema>;

export const documentFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  nullable: z.boolean().optional(),
  constraints: z.array(fieldConstraintSchema).optional(),
  domainSemantics: z.string().optional(), // 3.3-style: "FK → tabla.columna"
  validation: z.string().optional(),       // Rango, reglas, etc.
  defaultValue: z.any().optional(),
  examples: z.array(z.string()).optional(),
});
export type DocumentField = z.infer<typeof documentFieldSchema>;

// ── Entity Definitions ─────────────────────────────────────
export const documentEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(documentFieldSchema),
  primaryKey: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),    // "editable", "immutable", etc.
  businessRules: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(), // SQL constraints or app-level
  parentEntity: z.string().optional(),
});
export type DocumentEntity = z.infer<typeof documentEntitySchema>;

// ── Relations ──────────────────────────────────────────────
export const documentRelationSchema = z.object({
  id: z.string(),
  fromEntity: z.string(),
  toEntity: z.string(),
  type: z.enum(["1:N", "N:1", "N:M", "1:1"]),
  fromField: z.string().optional(),
  toField: z.string().optional(),
  description: z.string().optional(),
  onDelete: z.string().optional(),
});
export type DocumentRelation = z.infer<typeof documentRelationSchema>;

// ── Domain Contexts ─────────────────────────────────────────
export const domainContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().default(0),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional(), // Entity names (by ref)
  constraints: z.array(z.string()).optional(),
});
export type DomainContext = z.infer<typeof domainContextSchema>;

// ── API Endpoints (facilities) ─────────────────────────────
export const apiEndpointSchema = z.object({
  id: z.string(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string(),
  description: z.string().optional(),
  requestBody: z.string().optional(),
  responseBody: z.string().optional(),
  auth: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type ApiEndpoint = z.infer<typeof apiEndpointSchema>;

// ── Timeline / Sprints ─────────────────────────────────────
export const sprintItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.string().optional(), // e.g. "Días 1–4"
  stories: z.array(z.string()),
  dependencies: z.array(z.string()).optional(),
});
export type SprintItem = z.infer<typeof sprintItemSchema>;

// ═══════════════════════════════════════════════════════════
// Typed Section Schemas (parsable, not just strings!)
// ═══════════════════════════════════════════════════════════

export const sectionTypeSchema = z.enum([
  "title",
  "executive_summary",
  "context_map",
  "glossary",
  "domain_model",
  "physical_model",
  "relations",
  "business_rules",
  "edge_cases",
  "facilities",
  "timeline",
  "security",
  "field_types",
  "constitution",
  "custom_markdown", // For unknown/extension sections
]);
export type SectionType = z.infer<typeof sectionTypeSchema>;

export const sectionBaseSchema = z.object({
  id: z.string(),
  type: sectionTypeSchema,
  heading: z.string(),
  order: z.number(),
  metadata: z.record(z.any()).optional(),
});

// Section variants
export const titleSectionSchema = sectionBaseSchema.extend({
  type: z.literal("title"),
  title: z.string(),
  subtitle: z.string().optional(),
  version: z.string().optional(),
  date: z.string().optional(),
  author: z.string().optional(),
});
export type TitleSection = z.infer<typeof titleSectionSchema>;

export const executiveSummarySectionSchema = sectionBaseSchema.extend({
  type: z.literal("executive_summary"),
  summary: z.string(),
  objectives: z.array(z.string()).optional(),
  deliverables: z.array(z.string()).optional(),
});
export type ExecutiveSummarySection = z.infer<typeof executiveSummarySectionSchema>;

export const contextMapSectionSchema = sectionBaseSchema.extend({
  type: z.literal("context_map"),
  contexts: z.array(domainContextSchema),
});
export type ContextMapSection = z.infer<typeof contextMapSectionSchema>;

export const glossarySectionSchema = sectionBaseSchema.extend({
  type: z.literal("glossary"),
  terms: z.array(z.object({
    term: z.string(),
    definition: z.string(),
    synonyms: z.array(z.string()).optional(),
  })),
});
export type GlossarySection = z.infer<typeof glossarySectionSchema>;

export const domainModelSectionSchema = sectionBaseSchema.extend({
  type: z.literal("domain_model"),
  entities: z.array(documentEntitySchema),
  namespaces: z.array(z.string()).optional(),
});
export type DomainModelSection = z.infer<typeof domainModelSectionSchema>;

export const physicalModelSectionSchema = sectionBaseSchema.extend({
  type: z.literal("physical_model"),
  entities: z.array(documentEntitySchema),
  tablePrefix: z.string().optional(),
  partitions: z.array(z.object({ entity: z.string(), strategy: z.string() })).optional(),
});
export type PhysicalModelSection = z.infer<typeof physicalModelSectionSchema>;

export const relationsSectionSchema = sectionBaseSchema.extend({
  type: z.literal("relations"),
  relations: z.array(documentRelationSchema),
});
export type RelationsSection = z.infer<typeof relationsSectionSchema>;

export const businessRulesSectionSchema = sectionBaseSchema.extend({
  type: z.literal("business_rules"),
  rules: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.enum(["high", "medium", "low"]).optional(),
  })),
});
export type BusinessRulesSection = z.infer<typeof businessRulesSectionSchema>;

export const edgeCasesSectionSchema = sectionBaseSchema.extend({
  type: z.literal("edge_cases"),
  cases: z.array(z.object({
    id: z.string(),
    scenario: z.string(),
    expectedBehavior: z.string(),
    mitigation: z.string().optional(),
  })),
});
export type EdgeCasesSection = z.infer<typeof edgeCasesSectionSchema>;

export const facilitiesSectionSchema = sectionBaseSchema.extend({
  type: z.literal("facilities"),
  endpoints: z.array(apiEndpointSchema).optional(),
  services: z.array(z.string()).optional(),
  integrations: z.array(z.string()).optional(),
});
export type FacilitiesSection = z.infer<typeof facilitiesSectionSchema>;

export const timelineSectionSchema = sectionBaseSchema.extend({
  type: z.literal("timeline"),
  totalDuration: z.string().optional(),
  sprints: z.array(sprintItemSchema).optional(),
  milestones: z.array(z.object({
    name: z.string(),
    date: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
});
export type TimelineSection = z.infer<typeof timelineSectionSchema>;

export const securitySectionSchema = sectionBaseSchema.extend({
  type: z.literal("security"),
  roles: z.array(z.object({
    name: z.string(),
    permissions: z.array(z.string()),
  })).optional(),
  policies: z.array(z.string()).optional(),
});
export type SecuritySection = z.infer<typeof securitySectionSchema>;

export const fieldTypesSectionSchema = sectionBaseSchema.extend({
  type: z.literal("field_types"),
  types: z.array(z.object({
    name: z.string(),
    sqlType: z.string().optional(),
    typescriptType: z.string().optional(),
    description: z.string().optional(),
    length: z.string().optional(),
    precision: z.string().optional(),
  })),
});
export type FieldTypesSection = z.infer<typeof fieldTypesSectionSchema>;

export const constitutionSectionSchema = sectionBaseSchema.extend({
  type: z.literal("constitution"),
  hasContextMap: z.boolean().optional(),
  hasGlossary: z.boolean().optional(),
  hasGherkin: z.boolean().optional(),
  hasStackRationale: z.boolean().optional(),
  blockers: z.array(z.string()).optional(),
});
export type ConstitutionSection = z.infer<typeof constitutionSectionSchema>;

export const customMarkdownSectionSchema = sectionBaseSchema.extend({
  type: z.literal("custom_markdown"),
  markdown: z.string(),
});
export type CustomMarkdownSection = z.infer<typeof customMarkdownSectionSchema>;

// Union of all section types
export const documentSectionSchema = z.union([
  titleSectionSchema,
  executiveSummarySectionSchema,
  contextMapSectionSchema,
  glossarySectionSchema,
  domainModelSectionSchema,
  physicalModelSectionSchema,
  relationsSectionSchema,
  businessRulesSectionSchema,
  edgeCasesSectionSchema,
  facilitiesSectionSchema,
  timelineSectionSchema,
  securitySectionSchema,
  fieldTypesSectionSchema,
  constitutionSectionSchema,
  customMarkdownSectionSchema,
]);
export type DocumentSection = z.infer<typeof documentSectionSchema>;

// ── Root Document AST ──────────────────────────────────────
export const mddDocumentAstSchema = z.object({
  version: z.literal("2.0").default("2.0"),
  documentId: z.string(),
  title: z.string(),
  projectId: z.string().optional(),
  stageId: z.string().optional(),
  sections: z.array(documentSectionSchema),
  /** RFC-001 §4.1: Una Entity puede salir en múltiples secciones.
   *  entityIndex es el source of truth de merge. */
  entityIndex: z.record(z.string(), z.object({
    type: z.enum(["domain", "physical", "abstract"]),
    sectionIds: z.array(z.string()),
    canonicalName: z.string(),
  })).optional(),
  metadata: z.object({
    author: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    generator: z.string().optional(),
    validationHash: z.string().optional(),   // Hash para detectar corrupción
    patchVersion: z.number().default(0),       // Incrementado en cada patch aplicado
  }).optional(),
});
export type MddDocumentAst = z.infer<typeof mddDocumentAstSchema>;

// ── Patch Operations (RFC-001 §3.3) ────────────────────────
export const patchTargetSchema = z.object({
  sectionId: z.string().optional(),
  entityId: z.string().optional(),
  fieldId: z.string().optional(),
  relationId: z.string().optional(),
  sectionType: sectionTypeSchema.optional(),
});
export type PatchTarget = z.infer<typeof patchTargetSchema>;

export const patchOpSchema = z.object({
  id: z.string(),
  type: z.enum(["ADD", "MODIFY", "DELETE", "REPLACE_SECTION", "REPLACE_FIELD", "ADD_FIELD"]),
  target: patchTargetSchema,
  path: z.string(),    // JSON Path-like: "sections[§3.2].entities[Usuario].fields"
  beforeValue: z.any().optional(),
  value: z.any(),      // Para ADD/MODIFY/REPLACE: el nuevo valor
  reason: z.string(),  // Explicación de la IA del por qué
  confidence: z.number().min(0).max(1).default(1.0),
});
export type PatchOp = z.infer<typeof patchOpSchema>;

export const documentPatchSchema = z.object({
  documentId: z.string(),
  baseVersion: z.number().default(0),  // Patch version del documento base
  operations: z.array(patchOpSchema),
  metadata: z.object({
    author: z.string().optional(),
    timestamp: z.string().optional(),
    intent: z.string().optional(),       // Top-level intent classification
  }).optional(),
});
export type DocumentPatch = z.infer<typeof documentPatchSchema>;

// ── Dual Output Protocol (RFC-001 §2) ───────────────────────
export const documentResponseSchema = z.object({
  /** Protocol version */
  protocolVersion: z.literal("dual-output-v1"),
  /** Semantic version of the document */
  documentVersion: z.number().default(0),
  /** Document type being returned */
  documentType: z.enum(["mdd", "brd", "tobe", "spec", "architecture", "blueprint"]).default("mdd"),
  /** The AST — source of truth for edits */
  documentAst: mddDocumentAstSchema,
  /** Human-readable markdown — generated deterministically from AST */
  documentMarkdown: z.string(),
  /** Array of changes made (or to be applied as patches) */
  patches: z.array(patchOpSchema).optional(),
  /** Validation status */
  validation: z.object({
    schemaOk: z.boolean(),
    crossRefOk: z.boolean(),
    completenessOk: z.boolean(),
    warnings: z.array(z.string()),
  }).optional(),
});
export type DocumentResponse = z.infer<typeof documentResponseSchema>;

// ── Intent Classification ──────────────────────────────────
export const documentEditIntentSchema = z.enum([
  "create_new",
  "update_entity",
  "add_entity",
  "delete_entity",
  "restructure",
  "refine_description",
  "add_field",
  "remove_field",
  "merge_entities",
  "split_entity",
  "reorder_sections",
  "add_section",
  "remove_section",
  "update_business_rule",
  "unknown",
]);
export type DocumentEditIntent = z.infer<typeof documentEditIntentSchema>;

export const intentClassificationSchema = z.object({
  primary: documentEditIntentSchema,
  secondary: z.array(documentEditIntentSchema).optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  /** Whether this operation needs human confirmation */
  requiresConfirmation: z.boolean().default(false),
  /** Impact level */
  impact: z.enum(["none", "single_entity", "multi_entity", "section_level", "document_level"]).default("single_entity"),
  /** Which entity/section is primarily affected */
  primaryTarget: patchTargetSchema.optional(),
});
export type IntentClassification = z.infer<typeof intentClassificationSchema>;

// ── Edit Request ────────────────────────────────────────────
export const documentEditRequestSchema = z.object({
  documentId: z.string(),
  instruction: z.string(),
  currentAst: mddDocumentAstSchema.optional(),
  currentMarkdown: z.string().optional(),
  existingChanges: z.array(patchOpSchema).optional(),
  /** If provided, skip intent classification and use this */
  forcedIntent: documentEditIntentSchema.optional(),
  options: z.object({
    confirmDestructive: z.boolean().default(true),
    strictValidation: z.boolean().default(true),
    autoApply: z.boolean().default(false),
  }).optional(),
});
export type DocumentEditRequest = z.infer<typeof documentEditRequestSchema>;
