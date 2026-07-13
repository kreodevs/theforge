import { z } from "zod";

/** ID fijo del grupo por defecto "Proyectos" (seed migration). */
export const DEFAULT_PROJECT_GROUP_ID = "00000000-0000-4000-8000-000000000001";

export const projectGroupResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
});

export const createProjectGroupSchema = z.object({
  name: z.string().min(1).max(120),
});

export const updateProjectGroupSchema = z.object({
  name: z.string().min(1).max(120),
});

export type ProjectGroupResponse = z.infer<typeof projectGroupResponseSchema>;
export type CreateProjectGroupDto = z.infer<typeof createProjectGroupSchema>;
export type UpdateProjectGroupDto = z.infer<typeof updateProjectGroupSchema>;
