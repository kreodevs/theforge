import { z } from "zod";

export const mddJsonSchema = z.object({
  db_entities: z.array(z.unknown()).default([]),
  business_core: z.unknown().nullable().optional(),
  edge_cases: z.unknown().optional(),
  field_types: z.unknown().optional(),
});

export type MddJson = z.infer<typeof mddJsonSchema>;
