/**
 * Structured CRUD / process inventories for cascade accuracy (≥90% plan).
 */

import { z } from "zod";

export const AUTH_ENTITY_FAMILY = new Set([
  "users",
  "roles",
  "permissions",
  "role_permissions",
  "user_roles",
  "sessions",
  "security_events",
  "outbox_events",
  "refresh_tokens",
  "mfa_devices",
]);

export const crudOpsSchema = z.enum(["C", "R", "U", "D", "L"]);
export type CrudOp = z.infer<typeof crudOpsSchema>;

export const crudMatrixRowSchema = z.object({
  entity: z.string().min(1),
  ops: z.array(crudOpsSchema).default(["L", "R"]),
  actor: z.string().optional(),
  endpointHint: z.string().optional(),
  screenHint: z.string().optional(),
  mvp: z.boolean().default(true),
  infraOnly: z.boolean().default(false),
  brdCapabilityIds: z.array(z.string()).default([]),
});
export type CrudMatrixRow = z.infer<typeof crudMatrixRowSchema>;

export const processInventoryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  trigger: z.string().optional(),
  steps: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
  critical: z.boolean().default(true),
  brdCapabilityIds: z.array(z.string()).default([]),
  screenHints: z.array(z.string()).default([]),
});
export type ProcessInventoryItem = z.infer<typeof processInventoryItemSchema>;

export const brdCapabilitySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().default(""),
  isAuthRelated: z.boolean().default(false),
});
export type BrdCapability = z.infer<typeof brdCapabilitySchema>;

export const domainInventorySchema = z.object({
  capabilities: z.array(brdCapabilitySchema),
  suggestedEntities: z.array(z.string()).default([]),
  processes: z.array(processInventoryItemSchema).default([]),
  crudMatrix: z.array(crudMatrixRowSchema).default([]),
  adminSurfaces: z.array(z.string()).default([]),
});
export type DomainInventory = z.infer<typeof domainInventorySchema>;
