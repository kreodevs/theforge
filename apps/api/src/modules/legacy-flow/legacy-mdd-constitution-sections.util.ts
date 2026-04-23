/**
 * Rebanadas del MDD por secciones canónicas `## N.` (Constitución SDD).
 * Reutiliza `extractSectionByNumber` del motor MDD.
 */

import { extractSectionByNumber } from "../engine/mdd-markdown-parser.js";

export type ConstitutionSectionNum = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Mapa §1–§7 (vacío si no hay encabezado reconocido). */
export function sliceMddConstitutionSections(md: string): Record<ConstitutionSectionNum, string> {
  const s = md.trim();
  const out = {} as Record<ConstitutionSectionNum, string>;
  for (let n = 1; n <= 7; n++) {
    const key = n as ConstitutionSectionNum;
    out[key] = extractSectionByNumber(s, n).trim();
  }
  return out;
}

/** Une varias secciones en un bloque markdown para prompts (orden fijo). */
export function joinConstitutionSectionsForPrompt(
  slices: Record<ConstitutionSectionNum, string>,
  sections: ConstitutionSectionNum[],
): string {
  const parts = sections.map((n) => slices[n]).filter((t) => t.length > 0);
  if (!parts.length) return "";
  return parts.join("\n\n---\n\n");
}
