/**
 * Heurísticas compartidas API/web: distinguir edición explícita de documento vs plática o preguntas del asistente.
 */

const DBGA_DOMAIN_EDIT_RE =
  /\b(kill\s*switch|tablero\s+de\s+aprob|firma\s+digital|validaci[oó]n\s+previa)\b/i;

const DBGA_VERB_WITH_DOC_RE =
  /\b(?:modific|actualiz|añad|agreg|quitar|cambiar|ajust|integrar|incorpor|reescrib|eliminar|corrige|aplica(?:r)?)\b[^.?!\n]{0,96}\b(?:documento|dbga|benchmark|fase\s*0|panel|an[aá]lisis\s*\(dbga\))\b/i;

const DBGA_DOC_TARGET_RE =
  /\b(?:al|en\s+el|del|sobre\s+el)\s+(?:documento|dbga|benchmark|panel|an[aá]lisis)\b/i;

const DBGA_IMPERATIVE_RE =
  /\b(?:haz\s+las\s+modific|aplica\s+los\s+cambios|persiste\s+en\s+el\s+panel|guarda\s+en\s+el\s+panel)\b/i;

const DBGA_DOMAIN_WITH_VERB_RE =
  /\b(?:modific|actualiz|añad|agreg|ajust|incorpor|integr|corrige|cubr|elimina|saca|quita)/i;

/** Pregunta, propuesta condicional o brainstorming — no persistir DBGA todavía. */
export function isUserExploringDbgaIntent(message: string): boolean {
  const m = message.trim();
  if (!m) return false;

  if (isHypotheticalDocumentEditOffer(m)) return true;

  if (/\b(?:qu[eé]\s+suger|qu[eé]\s+tal|c[oó]mo\s+suger|c[oó]mo\s+manejar|c[oó]mo\s+lo\s+har[ií]as)\b/i.test(m)) {
    return true;
  }

  if (/\b(?:¿te\s+parece\s+bien|te\s+parece\s+bien\s+esta)\b/i.test(m)) return true;

  if (/\bsi\s+es\s+as[ií]\b/i.test(m) && /\b(integr|incorpor|añad|agreg|actualiz|modific|sac)\w*/i.test(m)) {
    return true;
  }

  if (/\?\s*$/.test(m) && !DBGA_IMPERATIVE_RE.test(m) && !/^(agrega|integra|actualiza|modifica|cubre|elimina|saca|quita)\b/i.test(m)) {
    return true;
  }

  return false;
}

/** El usuario pide persistir cambios en el DBGA/Fase 0 (no brainstorming ni Q&A). */
export function looksLikeDbgaEditRequest(message: string): boolean {
  const m = message.trim();
  if (!m || m.length < 12) return false;

  if (isUserExploringDbgaIntent(m)) return false;

  if (/^\s*¿/.test(m) && !DBGA_IMPERATIVE_RE.test(m) && !DBGA_VERB_WITH_DOC_RE.test(m)) {
    return false;
  }

  if (DBGA_VERB_WITH_DOC_RE.test(m) || DBGA_IMPERATIVE_RE.test(m)) {
    return true;
  }

  if (DBGA_DOC_TARGET_RE.test(m) && DBGA_DOMAIN_WITH_VERB_RE.test(m)) {
    return true;
  }

  if (DBGA_DOMAIN_WITH_VERB_RE.test(m) && /\b(?:gap|omisiones?\s+cr[ií]ticas?)\b/i.test(m)) {
    return true;
  }

  if (DBGA_DOMAIN_EDIT_RE.test(m)) return true;

  if (
    DBGA_DOMAIN_WITH_VERB_RE.test(m) &&
    /\b(?:tenant(?:_id)?|multi-?\s*tenant|espejo|catálogo|catalogo|obp4?mo)\b/i.test(m)
  ) {
    return true;
  }

  if (/\b(?:hay que|debe|necesit)\b/i.test(m) && DBGA_DOC_TARGET_RE.test(m)) return true;

  return false;
}

/** Oferta o pregunta del asistente («¿incorpore al DBGA?»), no afirmación de persistencia. */
export function isHypotheticalDocumentEditOffer(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;

  if (
    /\b(?:prefieres|quieres|deseas|te\s+gustar[ií]a|puedo|podemos|deber[ií]a)\s+que\b[^.?!\n]{0,160}\b(?:incorpore|integre|añada|agregue|actualice|modifique|aplique|profundice)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  if (
    /(?:^|[.!?]\s*|\n)\s*¿[^?\n]{0,240}\b(?:incorpore|integre|añada|agregue|actualice|modifique|aplique|profundice)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  if (/\b(?:o\s+)?¿quieres\s+(?:mantenerlo|dejarlo)\s+fuera\s+del\s+documento\b/i.test(t)) {
    return true;
  }

  return false;
}
