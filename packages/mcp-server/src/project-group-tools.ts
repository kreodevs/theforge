import {
  createProjectGroupSchema,
  updateProjectGroupSchema,
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

export interface ProjectGroupApiClient {
  get: <T = unknown>(path: string) => Promise<T>;
  post: (path: string, body?: unknown) => Promise<unknown>;
  patch: (path: string, body?: unknown) => Promise<unknown>;
  delete: (path: string) => Promise<unknown>;
}

const groupIdArgSchema = z.object({
  groupId: z.string().uuid("groupId debe ser un UUID válido"),
});

const moveProjectToGroupSchema = z.object({
  projectId: z.string().uuid("projectId debe ser un UUID válido"),
  groupId: z.string().uuid("groupId debe ser un UUID válido"),
});

function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ");
}

/** Herramientas MCP para gestión de grupos de proyectos (paridad con API /project-groups). */
export const PROJECT_GROUP_TOOLS: McpTool[] = [
  {
    name: "list_project_groups",
    description:
      "Lista todos los grupos de proyectos. Disponible para cualquier usuario autenticado.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_project_group",
    description:
      "Obtiene un grupo de proyectos por ID (nombre, slug, isDefault, sortOrder). Cualquier usuario autenticado.",
    inputSchema: {
      type: "object",
      properties: {
        groupId: { type: "string", description: "UUID del grupo" },
      },
      required: ["groupId"],
    },
  },
  {
    name: "create_project_group",
    description:
      "Crea un grupo de proyectos. Requiere rol admin o super_admin. Body: { name } (1–120 caracteres).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre del grupo (1–120 caracteres)" },
      },
      required: ["name"],
    },
  },
  {
    name: "rename_project_group",
    description:
      "Renombra un grupo de proyectos. Requiere admin+. No se puede renombrar el grupo por defecto «Proyectos».",
    inputSchema: {
      type: "object",
      properties: {
        groupId: { type: "string", description: "UUID del grupo" },
        name: { type: "string", description: "Nuevo nombre (1–120 caracteres)" },
      },
      required: ["groupId", "name"],
    },
  },
  {
    name: "delete_project_group",
    description:
      "Elimina un grupo de proyectos. Requiere admin+. No se puede eliminar el grupo por defecto; los proyectos se reasignan al grupo «Proyectos».",
    inputSchema: {
      type: "object",
      properties: {
        groupId: { type: "string", description: "UUID del grupo a eliminar" },
      },
      required: ["groupId"],
    },
  },
  {
    name: "move_project_to_group",
    description:
      "Mueve un proyecto a otro grupo (PATCH groupId). Requiere rol admin o super_admin.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "UUID del proyecto" },
        groupId: { type: "string", description: "UUID del grupo destino" },
      },
      required: ["projectId", "groupId"],
    },
  },
  {
    name: "move_project_group_to_first",
    description:
      "Prioriza un grupo de proyectos en el dashboard (primera posición, sortOrder). Requiere admin+. Incluye el grupo por defecto «Proyectos».",
    inputSchema: {
      type: "object",
      properties: {
        groupId: { type: "string", description: "UUID del grupo a priorizar" },
      },
      required: ["groupId"],
    },
  },
];

export function createProjectGroupHandlers(api: ProjectGroupApiClient): Record<string, McpHandler> {
  return {
    async list_project_groups() {
      return JSON.stringify(await api.get("/project-groups"));
    },

    async get_project_group(args) {
      const parsed = groupIdArgSchema.safeParse(args);
      if (!parsed.success) throw new Error(formatZodError(parsed.error));

      const groups = (await api.get("/project-groups")) as Array<{ id: string }>;
      const group = groups.find((g) => g.id === parsed.data.groupId);
      if (!group) {
        throw new Error("No encontrado (404): Grupo no encontrado");
      }
      return JSON.stringify(group);
    },

    async create_project_group(args) {
      const parsed = createProjectGroupSchema.safeParse(args);
      if (!parsed.success) throw new Error(formatZodError(parsed.error));

      return JSON.stringify(await api.post("/project-groups", parsed.data));
    },

    async rename_project_group(args) {
      const idParsed = groupIdArgSchema.safeParse(args);
      if (!idParsed.success) throw new Error(formatZodError(idParsed.error));

      const nameParsed = updateProjectGroupSchema.safeParse({ name: args.name });
      if (!nameParsed.success) throw new Error(formatZodError(nameParsed.error));

      const { groupId } = idParsed.data;
      return JSON.stringify(
        await api.patch(`/project-groups/${groupId}`, nameParsed.data),
      );
    },

    async delete_project_group(args) {
      const parsed = groupIdArgSchema.safeParse(args);
      if (!parsed.success) throw new Error(formatZodError(parsed.error));

      return JSON.stringify(await api.delete(`/project-groups/${parsed.data.groupId}`));
    },

    async move_project_to_group(args) {
      const parsed = moveProjectToGroupSchema.safeParse(args);
      if (!parsed.success) throw new Error(formatZodError(parsed.error));

      const { projectId, groupId } = parsed.data;
      return JSON.stringify(await api.patch(`/projects/${projectId}`, { groupId }));
    },

    async move_project_group_to_first(args) {
      const parsed = groupIdArgSchema.safeParse(args);
      if (!parsed.success) throw new Error(formatZodError(parsed.error));

      return JSON.stringify(
        await api.post(`/project-groups/${parsed.data.groupId}/move-to-first`),
      );
    },
  };
}

/** Nombres de tools de grupos — útil para tests de alineación. */
export const PROJECT_GROUP_TOOL_NAMES = PROJECT_GROUP_TOOLS.map((t) => t.name);
