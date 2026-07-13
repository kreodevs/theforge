import {
  createStageBodySchema,
  patchStageBodySchema,
  transitionStageBodySchema,
} from "@theforge/shared-types";
import { z } from "zod";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export type McpHandler = (args: Record<string, unknown>) => Promise<string>;

export interface ProjectStageApiClient {
  get: <T = unknown>(path: string) => Promise<T>;
  post: (path: string, body?: unknown) => Promise<unknown>;
  patch: (path: string, body?: unknown) => Promise<unknown>;
}

const projectStageIdsSchema = z.object({
  projectId: z.string().uuid("projectId debe ser un UUID válido"),
  stageId: z.string().uuid("stageId debe ser un UUID válido"),
});

const projectIdSchema = z.object({
  projectId: z.string().uuid("projectId debe ser un UUID válido"),
});

function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ");
}

/** Herramientas MCP para control de etapas (paridad con API /projects/:id/stages). */
export const PROJECT_STAGE_TOOLS: McpTool[] = [
  {
    name: "get_project_stage_detail",
    description:
      "Detalle de una etapa: workflowStatus, semáforo, documentos de etapa (MDD/BRD/changeSpec), resumen de entregables SDD y transiciones permitidas (activate, complete, archive, reopen).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "UUID del proyecto" },
        stageId: { type: "string", description: "UUID de la etapa" },
      },
      required: ["projectId", "stageId"],
    },
  },
  {
    name: "create_project_stage",
    description:
      "Crea una etapa en el proyecto. Opciones: name, key, ordinal, copyMddFromStageId, copyLegacyChangeFromStageId, activate (default true). Requiere owner para activate.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "UUID del proyecto" },
        name: { type: "string", description: "Nombre visible de la etapa" },
        key: { type: "string", description: "Clave estable (p. ej. LEGACY_IMPACT)" },
        ordinal: { type: "number", description: "Orden 1-based; default max+1" },
        copyMddFromStageId: { type: "string", description: "UUID etapa origen para copiar MDD" },
        copyLegacyChangeFromStageId: {
          type: "string",
          description: "UUID etapa origen para copiar legacyChangeState",
        },
        activate: {
          type: "boolean",
          description: "Si true (default), activa la nueva etapa y supersede las demás ACTIVE",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "patch_project_stage",
    description:
      "Actualiza metadatos de una etapa: name, key, ordinal, brdContent, workflowStatus (DRAFT|ACTIVE|COMPLETED|ARCHIVED|SUPERSEDED), activate. Owner requerido para activate/ordinal.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "UUID del proyecto" },
        stageId: { type: "string", description: "UUID de la etapa" },
        name: { type: "string" },
        key: { type: "string" },
        ordinal: { type: "number" },
        brdContent: { type: "string" },
        workflowStatus: {
          type: "string",
          enum: ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED", "SUPERSEDED"],
        },
        activate: { type: "boolean", description: "Poner esta etapa como única ACTIVE" },
      },
      required: ["projectId", "stageId"],
    },
  },
  {
    name: "transition_project_stage",
    description:
      "Transición validada del workflow de etapa: activate (owner), complete (desde ACTIVE), archive (con snapshot), reopen (→ DRAFT). Devuelve previousStatus y newStatus.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "UUID del proyecto" },
        stageId: { type: "string", description: "UUID de la etapa" },
        action: {
          type: "string",
          enum: ["activate", "complete", "archive", "reopen"],
          description: "Transición a aplicar",
        },
        reason: { type: "string", description: "Motivo opcional (auditoría, máx. 500 caracteres)" },
      },
      required: ["projectId", "stageId", "action"],
    },
  },
];

export function createProjectStageHandlers(api: ProjectStageApiClient): Record<string, McpHandler> {
  return {
    async get_project_stage_detail(args) {
      const parsed = projectStageIdsSchema.safeParse(args);
      if (!parsed.success) throw new Error(formatZodError(parsed.error));

      const { projectId, stageId } = parsed.data;
      return JSON.stringify(await api.get(`/projects/${projectId}/stages/${stageId}`));
    },

    async create_project_stage(args) {
      const ids = projectIdSchema.safeParse(args);
      if (!ids.success) throw new Error(formatZodError(ids.error));

      const { projectId, ...rest } = args;
      const bodyParsed = createStageBodySchema.safeParse(rest);
      if (!bodyParsed.success) throw new Error(formatZodError(bodyParsed.error));

      return JSON.stringify(
        await api.post(`/projects/${ids.data.projectId}/stages`, bodyParsed.data),
      );
    },

    async patch_project_stage(args) {
      const ids = projectStageIdsSchema.safeParse(args);
      if (!ids.success) throw new Error(formatZodError(ids.error));

      const { projectId, stageId, ...rest } = args;
      const bodyParsed = patchStageBodySchema.safeParse(rest);
      if (!bodyParsed.success) throw new Error(formatZodError(bodyParsed.error));
      if (Object.keys(bodyParsed.data).length === 0) {
        throw new Error("Debe enviar al menos un campo a actualizar (name, key, ordinal, brdContent, workflowStatus, activate)");
      }

      return JSON.stringify(
        await api.patch(`/projects/${projectId}/stages/${stageId}`, bodyParsed.data),
      );
    },

    async transition_project_stage(args) {
      const ids = projectStageIdsSchema.safeParse(args);
      if (!ids.success) throw new Error(formatZodError(ids.error));

      const bodyParsed = transitionStageBodySchema.safeParse({
        action: args.action,
        reason: args.reason,
      });
      if (!bodyParsed.success) throw new Error(formatZodError(bodyParsed.error));

      const { projectId, stageId } = ids.data;
      return JSON.stringify(
        await api.post(
          `/projects/${projectId}/stages/${stageId}/transition`,
          bodyParsed.data,
        ),
      );
    },
  };
}

/** Nombres de tools de etapas — útil para tests de alineación. */
export const PROJECT_STAGE_TOOL_NAMES = PROJECT_STAGE_TOOLS.map((t) => t.name);
