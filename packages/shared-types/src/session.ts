import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  tab: z.string().optional(),
});

export const contextStepEnum = ["CONTEXT", "DATA", "LOGIC", "SECURITY"] as const;
export type ContextStep = (typeof contextStepEnum)[number];

export const createSessionSchema = z.object({
  projectId: z.string().uuid(),
  contextStep: z.enum(contextStepEnum).default("CONTEXT"),
  chatLog: z.array(chatMessageSchema).default([]),
});

export const appendChatSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  tab: z.string().optional(),
});

export const sessionResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  contextStep: z.enum(contextStepEnum),
  chatLog: z.array(chatMessageSchema),
  updatedAt: z.string().datetime(),
});

export type CreateSessionDto = z.infer<typeof createSessionSchema>;
export type AppendChatDto = z.infer<typeof appendChatSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** Tab asociado a un mensaje; mensajes legacy sin tab se consideran "mdd". */
export function getMessageTab(m: ChatMessage): string {
  return m.tab ?? "mdd";
}

/** Filtra el chatLog para mostrar solo mensajes del tab indicado. */
export function filterChatByTab(log: ChatMessage[], tab: string): ChatMessage[] {
  return log.filter((m) => getMessageTab(m) === tab);
}
