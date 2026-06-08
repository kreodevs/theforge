/**
 * Resuelve el borrador de Paso 0 desde las fuentes persistidas del proyecto.
 * dbgaContent (markdown editado en UI) tiene prioridad sobre phase0SummaryContent (JSON).
 */

import { isPhase0StructuredMarkdown, markdownToPhase0Document } from "./phase0-from-markdown.js";
import type { Phase0Document } from "./phase0.types.js";

export function hasBorradorContent(borrador: Phase0Document): boolean {
  return (
    borrador.proposito.problema.trim().length > 0 ||
    borrador.entidades.length > 0 ||
    borrador.reglasNegocio.length > 0 ||
    borrador.flujos.length > 0 ||
    borrador.roles.length > 0
  );
}

function parseBorradorJson(raw: string | null | undefined): Phase0Document | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as Phase0Document;
  } catch {
    return null;
  }
}

export function loadProjectBorrador(
  dbgaContent: string | null | undefined,
  phase0SummaryContent: string | null | undefined,
): Phase0Document {
  const markdown = dbgaContent?.trim() ?? "";
  if (markdown && isPhase0StructuredMarkdown(markdown)) {
    return markdownToPhase0Document(markdown);
  }

  const fromJson = parseBorradorJson(phase0SummaryContent);
  if (fromJson && hasBorradorContent(fromJson)) {
    return fromJson;
  }

  if (markdown) {
    const fromMd = markdownToPhase0Document(markdown);
    if (hasBorradorContent(fromMd)) return fromMd;
  }

  return (
    fromJson ?? {
      proposito: { problema: "", usuarios: [], outOfScope: [] },
      entidades: [],
      reglasNegocio: [],
      flujos: [],
      roles: [],
      integraciones: [],
      edgeCases: [],
      preguntasPendientes: [],
    }
  );
}
