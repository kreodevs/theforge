import {
  assessMermaidFixStrategy,
  resolveMermaidBlockForRender,
} from "@theforge/shared-types/mermaid";
import { prepareMermaidForRender } from "./mermaid-render-prep.util";

/** Reparación local determinista (sin LLM). */
export function repairMermaidBlockForRender(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const prepared = prepareMermaidForRender(resolveMermaidBlockForRender(trimmed) || trimmed);
  return prepared.trim() || trimmed;
}

export { assessMermaidFixStrategy };
