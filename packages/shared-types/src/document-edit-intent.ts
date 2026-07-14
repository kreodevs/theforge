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

/** Bloque markdown largo pegado por el usuario (spec externa, portal de licencias, etc.). */
export function hasEmbeddedSpecificationBlock(message: string): boolean {
  const m = message.trim();
  if (m.length < 500) return false;
  // Catálogo puro de endpoints REST (POST/GET…) no es un DBGA completo ni “spec” a sustituir el panel.
  if (looksLikeApiEndpointCatalog(m) && !/^#\s+(?:Domain\s+Benchmark|Fase\s+0|Research\s+Report)/im.test(m)) {
    return false;
  }
  return (
    /#\s+Especificaci[oó]n/i.test(m) ||
    /##\s+1\.\s+Visi[oó]n/i.test(m) ||
    /POST\s+[`'"]\/licenses/i.test(m) ||
    (/^---\s*$/m.test(m) && /\n##\s+\d+\./m.test(m)) ||
    ((m.match(/\n##\s+/g)?.length ?? 0) >= 3 && m.length >= 1200)
  );
}

/**
 * Lista numerada de rutas HTTP (POST/GET/…) — fragmento a integrar, no documento DBGA completo.
 * Evita que Fase 0 persista solo el catálogo y borre el panel.
 * Specs largas con título/secciones (p. ej. Portal de Licencias) no cuentan como catálogo.
 */
export function looksLikeApiEndpointCatalog(text: string): boolean {
  const t = text.trim();
  if (t.length < 80 || t.length > 12_000) return false;
  // Documento de especificación / DBGA con estructura real — no es un dump de endpoints.
  if (/#\s+Especificaci[oó]n/i.test(t)) return false;
  if (/##\s+1\.\s+Visi[oó]n/i.test(t)) return false;
  if ((t.match(/\n##\s+/g)?.length ?? 0) >= 3 && t.length >= 1200) return false;
  const methodHits = (t.match(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[v\w{}/:_-]+/gi) ?? []).length;
  if (methodHits < 3) return false;
  const numbered = (t.match(/(?:^|\n)\d+\.\s+/g) ?? []).length;
  const hasBenchmarkTitle =
    /^#\s+(?:Domain\s+Benchmark|Fase\s+0\s+[—–-]|Research\s+Report|Benchmark\s*&\s*Gap)/im.test(t);
  if (hasBenchmarkTitle && t.length > 4000) return false;
  // Catálogo corto dominado por verbos HTTP + outline 1/2/3
  return methodHits >= 4 || (methodHits >= 3 && numbered >= 2 && t.length < 3500);
}

/** Usuario pide integrar una spec pegada en el DBGA (no brainstorming). */
export function looksLikeDbgaSpecIntegrationRequest(message: string): boolean {
  const m = message.trim();
  if (!hasEmbeddedSpecificationBlock(m)) return false;
  return /\b(?:estas?\s+especificaci[oó]n|pudier[ae]\s+cumplir|debe\s+cumplir|lo\s+ideal\s+es\s+que|cumplir\s+con\s+est|integra(?:r)?\s+(?:en\s+el\s+)?(?:documento|dbga|panel)|incorpora(?:r)?\s+(?:en\s+el\s+)?(?:documento|dbga))\b/i.test(
    m,
  );
}

/** Cuerpo de documento DBGA en texto de chat (no debe mostrarse en chatLog). */
export function looksLikeDbgaDocumentBody(text: string): boolean {
  const t = text.trim();
  if (t.length < 450) return false;
  if (looksLikeApiEndpointCatalog(t)) return false;
  if (
    /^#\s+(?:Domain\s+Benchmark|Fase\s+0\s+[—–-]|Benchmark\s*&\s*Gap|Research\s+Report)/im.test(t)
  ) {
    return true;
  }
  if ((t.match(/\n##\s+/g)?.length ?? 0) >= 2) return true;
  if (/^\d+\.\s+Resumen Ejecutivo/im.test(t)) return true;
  if (/\n\d+\.\s+(?:Benchmark|Análisis|Oportunidades|Conclusiones)\b/im.test(t)) return true;
  if (/\n##\s+Registro de cambios del documento/im.test(t) && t.length >= 800) return true;
  return false;
}

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

  // Respuesta a pregunta pendiente con catálogo HTTP → editar documento (sin “integra en el DBGA”).
  if (looksLikeApiEndpointCatalog(m)) return true;

  if (looksLikeDbgaSpecIntegrationRequest(m)) return true;

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
