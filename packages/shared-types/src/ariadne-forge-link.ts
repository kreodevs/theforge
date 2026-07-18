import { z } from "zod";

export const resolveForgeProjectForAriadneInputSchema = z
  .object({
    ariadneProjectId: z.string().uuid().optional(),
    ariadneRepositoryId: z.string().uuid().optional(),
    projectKey: z.string().trim().min(1).max(120).optional(),
    repoSlug: z.string().trim().min(1).max(200).optional(),
    gitRemoteUrl: z.string().trim().min(1).max(2000).optional(),
  })
  .refine(
    (v) =>
      Boolean(
        v.ariadneProjectId?.trim() ||
          v.ariadneRepositoryId?.trim() ||
          v.gitRemoteUrl?.trim() ||
          v.projectKey?.trim() ||
          v.repoSlug?.trim(),
      ),
    { message: "Indica al menos un identificador Ariadne (projectId, repositoryId, gitRemoteUrl, projectKey o repoSlug)" },
  );

export type ResolveForgeProjectForAriadneInput = z.infer<
  typeof resolveForgeProjectForAriadneInputSchema
>;

export const ariadneForgeLinkKindSchema = z.enum(["primary", "alias", "inferred"]);

export type AriadneForgeLinkKind = z.infer<typeof ariadneForgeLinkKindSchema>;

export const ariadneForgeStageSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  workflowStatus: z.string(),
});

export const resolveForgeProjectForAriadneOutputSchema = z.object({
  forgeProjectId: z.string().uuid(),
  forgeProjectName: z.string(),
  linkKind: ariadneForgeLinkKindSchema,
  existingStages: z.array(ariadneForgeStageSummarySchema).optional(),
  warnings: z.array(z.string()).optional(),
});

export type ResolveForgeProjectForAriadneOutput = z.infer<
  typeof resolveForgeProjectForAriadneOutputSchema
>;

export const ariadneForgeProjectCandidateSchema = resolveForgeProjectForAriadneOutputSchema.extend({
  matchReason: z.string().optional(),
});

export type AriadneForgeProjectCandidate = z.infer<typeof ariadneForgeProjectCandidateSchema>;

export const resolveForgeProjectAmbiguousResponseSchema = z.object({
  error: z.literal("ambiguous"),
  message: z.string(),
  candidates: z.array(ariadneForgeProjectCandidateSchema),
  warnings: z.array(z.string()).optional(),
});

export type ResolveForgeProjectAmbiguousResponse = z.infer<
  typeof resolveForgeProjectAmbiguousResponseSchema
>;
