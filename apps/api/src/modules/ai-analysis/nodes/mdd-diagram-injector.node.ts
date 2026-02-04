import type { MDDStateType } from "../state/index.js";
import { mergeMddStructured } from "../utils/mdd-merge-structured.js";
import {
  injectErDiagramBlockIntoDraft,
  injectMddDiagrams,
  suggestMddDiagrams,
  sqlToErDiagramContent,
} from "../utils/mdd-diagram-suggestions.js";
import { getMddDraftSummary, logMddNodeOutput } from "../utils/mdd-sanitize.js";

const LOG = (msg: string, ...args: unknown[]) => console.log(`[MDD:DiagramInjector] ${msg}`, ...args);

/**
 * Nodo que detecta puntos del MDD donde enriquecer con diagramas Mermaid (ER, estados, flujo).
 * Prioridad: generar el diagrama ER desde el §3 del draft actual (no desde mddStructured) para no
 * inyectar un diagrama viejo si structured quedó desactualizado. Solo usa mddStructured si el draft no tiene §3 con SQL.
 */
export function createMddDiagramInjectorNode(): (state: MDDStateType) => Promise<Partial<MDDStateType>> {
  return async (state: MDDStateType): Promise<Partial<MDDStateType>> => {
    const draft = (state.mddDraft ?? "").trim();
    if (!draft || draft.length < 200) {
      LOG("draft vacío o muy corto, sin cambios");
      return {};
    }

    const suggestions = suggestMddDiagrams(draft);
    if (suggestions.length > 0) {
      try {
        const injected = injectMddDiagrams(draft, suggestions);
        if (injected !== draft) {
          const sum = getMddDraftSummary(injected);
          LOG("inyectados %s diagrama(s) desde draft §3 draftLen=%s section2=%s", suggestions.length, sum.length, sum.section2);
          logMddNodeOutput("DiagramInjector", injected);
          return { mddDraft: injected };
        }
      } catch (err) {
        LOG("error inyectando diagramas desde draft: %s", err instanceof Error ? err.message : String(err));
      }
    }

    const md = state.mddStructured?.modeloDatos;
    if (md?.sql?.trim() && !md.diagramaEr?.trim()) {
      try {
        const diagramaEr = sqlToErDiagramContent(md.sql);
        if (diagramaEr) {
          const mermaidBlock = "```mermaid\nerDiagram\n" + diagramaEr + "\n```";
          const mddDraft = injectErDiagramBlockIntoDraft(draft, mermaidBlock);
          const merged = mergeMddStructured(state.mddStructured, {
            modeloDatos: { sql: md.sql, diagramaEr, technicalMetadata: md.technicalMetadata },
          }, state.mddDraft ?? "");
          LOG("inyectado diagramaEr desde mddStructured (fallback) mddDraftLen=%s", mddDraft.length);
          logMddNodeOutput("DiagramInjector", mddDraft);
          return { mddStructured: merged, mddDraft };
        }
      } catch (err) {
        LOG("error generando diagramaEr desde structured: %s", err instanceof Error ? err.message : String(err));
      }
    }

    LOG("sin sugerencias de diagramas o sin cambios");
    return {};
  };
}
