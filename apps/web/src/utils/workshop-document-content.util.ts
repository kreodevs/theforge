import { peelTheforgeDocStamp } from "@theforge/shared-types";

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
