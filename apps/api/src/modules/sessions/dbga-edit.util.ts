/** Heurística: el usuario pide cambiar el DBGA / Fase 0 (no solo preguntar). */
export function looksLikeDbgaEditRequest(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  return /\b(modific|actualiz|añad|agreg|quitar|cambiar|hay que|debe|necesit|incorpor|espej|tenant|multi-?tenant|catálogo|mantenimiento|obp4?mo)\b/i.test(
    m,
  );
}

export function normalizeDbgaForCompare(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

export function isDbgaContentNearlyIdentical(next: string, current: string): boolean {
  const a = normalizeDbgaForCompare(next);
  const b = normalizeDbgaForCompare(current);
  if (a === b) return true;
  const lenDiff = Math.abs(a.length - b.length);
  return lenDiff < Math.max(150, b.length * 0.008);
}

/**
 * Comprueba si el documento parece incorporar requisitos explícitos del mensaje del usuario.
 * Evita persistir un "DBGA actualizado" que solo repite el texto anterior.
 */
export function dbgaReflectsUserEditIntent(doc: string, userMessage: string): boolean {
  const d = doc.toLowerCase();
  const u = userMessage.toLowerCase();

  if (/\btenant[_\s-]?id\b|multi-?tenant|multi tenant/.test(u)) {
    if (!/\btenant_id\b/.test(d)) return false;
    if (/multi-?tenant|multi tenant/.test(u) && !/multi-?tenant|multi tenant|multi-tenancy/.test(d)) {
      return false;
    }
  }

  if (/catálogo de costos|catalogo de costos/.test(u) && /obp4?mo|obp\b/.test(u)) {
    if (/alimentad|espej|origen|tenant/.test(u) && !/tenant_id|espej|obp4?mo/.test(d)) {
      return false;
    }
  }

  if (/módulo\s*0?1|modulo\s*0?1/.test(u) && /aplicacion|aplicaciones|obp/.test(u)) {
    if (!/módulo\s*0?1|modulo\s*0?1|catálogo de costos/.test(d)) return false;
  }

  return true;
}
