import {
  assessMermaidFixStrategy,
  repairMermaidBlockBody,
} from "@theforge/shared-types/mermaid";
import { prepareMermaidForRender } from "./mermaid-render-prep.util";

/** Reparación local determinista (sin LLM). */
export function repairMermaidBlockForRender(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const body = repairMermaidBlockBody(trimmed);
  const prepared = body ? prepareMermaidForRender(body) : "";
  return prepared.trim() || body || trimmed;
}

export { assessMermaidFixStrategy };
