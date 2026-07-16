import {
  formatTheforgeDocTimestampsForDisplay,
  parseTheforgeDocTimestamps,
  peelTheforgeDocStamp,
} from "@theforge/shared-types";
import {
  WORKSHOP_STAGE_DELIVERABLE_FIELDS,
  resolveWorkshopStageDeliverables,
  type WorkshopStageDeliverableSource,
} from "./workshopStageDeliverables.js";

export type WorkshopDocumentTimestamps = {
  created: string;
  updated: string;
};

/** Fechas legibles desde stamp API (comentario HTML), o null si el doc no está sellado. */
export function extractWorkshopDocumentTimestamps(
  raw: string | null | undefined,
): WorkshopDocumentTimestamps | null {
  if (!raw?.trim()) return null;
  return formatTheforgeDocTimestampsForDisplay(parseTheforgeDocTimestamps(raw));
}

/** Mapa field → fechas al cargar proyecto/etapa (antes de quitar stamp del editor). */
export function buildWorkshopDocumentTimestampsMap(
  project: WorkshopStageDeliverableSource & {
    mddContent?: string | null;
    dbgaContent?: string | null;
    stages?: Array<
      WorkshopStageDeliverableSource & {
        id: string;
        mddContent?: string | null;
        brdContent?: string | null;
        codebaseDoc?: string | null;
      }
    >;
  },
  stageId: string | null,
): Record<string, WorkshopDocumentTimestamps> {
  const stages = project.stages ?? [];
  const stage =
    stageId && stages.length ? (stages.find((s) => s.id === stageId) ?? null) : null;
  const deliverables = resolveWorkshopStageDeliverables(project, stageId);
  const mddRaw =
    stage?.mddContent?.trim() ? stage.mddContent : (project.mddContent ?? null);

  const out: Record<string, WorkshopDocumentTimestamps> = {};
  const add = (field: string, raw: string | null | undefined) => {
    const ts = extractWorkshopDocumentTimestamps(raw);
    if (ts) out[field] = ts;
  };

  add("mddContent", mddRaw);
  add("dbgaContent", project.dbgaContent);
  for (const field of WORKSHOP_STAGE_DELIVERABLE_FIELDS) {
    add(field, deliverables[field]);
  }
  if (stage?.brdContent) add("brdContent", stage.brdContent);
  if (stage?.codebaseDoc) add("codebaseDoc", stage.codebaseDoc);

  return out;
}

function cleanFences(c: string): string | null {
  if (c.startsWith("```")) {
    const firstNewline = c.indexOf("\n");
    if (firstNewline !== -1) {
      c = c.slice(firstNewline + 1).trim();
    } else {
      c = c.slice(3).trim();
    }
  }
  if (c.endsWith("```")) {
    c = c.slice(0, -3).trim();
  }
  return c || null;
}

/** Normaliza markdown de panel Workshop (sin cabecera stamp, sin fences envolventes). */
export function cleanDocForWorkshop(text: string | null): string | null {
  if (typeof text !== "string") return null;
  let c = text.trim();
  if (!c) return null;

  if (c.startsWith("---")) {
    return cleanFences(c);
  }

  const firstHashIndex = c.indexOf("#");
  if (firstHashIndex !== -1) {
    if (!c.startsWith("#")) {
      const newlineHashIndex = c.indexOf("\n#");
      if (newlineHashIndex !== -1) {
        c = c.slice(newlineHashIndex + 1).trim();
      }
    }
  }

  return cleanFences(c);
}

/**
 * Texto mostrado/editado en Workshop: quita stamp API y aplica `cleanDocForWorkshop`.
 * Alinea store local y `project.*` para auto-guardado.
 */
export function normalizeWorkshopDocumentForEditor(
  text: string | null | undefined,
): string | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const { body } = peelTheforgeDocStamp(trimmed);
  return cleanDocForWorkshop(body);
}

/** Comparación estable para auto-guardado (ignora cabecera Creado/Última regeneración). */
export function workshopDocumentBodiesEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeWorkshopDocumentForEditor(a) ?? "";
  const nb = normalizeWorkshopDocumentForEditor(b) ?? "";
  return na === nb;
}
