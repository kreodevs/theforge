/**
 * Integra un catálogo de endpoints (respuesta a pregunta pendiente de Fase 0)
 * en la §11 del DBGA sin reescribir el documento completo vía LLM.
 */

import {
  appendDocumentChangelogEntry,
  formatDocumentChangelogDate,
} from "./document-changelog.js";
import { looksLikeApiEndpointCatalog } from "./document-edit-intent.js";
import { deduplicateDbgaDocument, hasDuplicateDbgaBlocks } from "./deduplicate-dbga-document.js";

const SECTION_11_HEADING = "## 11. API de Integración con Chat Externo";

const PENDING_ENDPOINTS_Q_RE =
  /^([-*]\s*)(\¿?Qué endpoints específicos debe exponer la API para integración con el chat externo\?[^\n]*)/gim;

const SECTION_11_BLOCK_RE =
  /\n##\s*11\.\s*[^\n]*\n[\s\S]*?(?=\n##\s+(?:\d+\.|Registro de cambios)|\n#\s|$)/i;

const INTEGRATION_API_BLOCK_RE =
  /\n##\s+Integraci[oó]n\s+API[^\n]*\n[\s\S]*?(?=\n##\s+(?:\d+\.|Registro de cambios)|\n#\s|$)/i;

const CHANGELOG_HEADING_RE = /\n##\s+Registro de cambios del documento\b/i;

/** Corta concatenaciones `…\n---\n\n# Domain Benchmark` / segundo H1. */
export function stripTrailingDuplicateDbga(content: string): string {
  const t = (content ?? "").trim();
  if (!t) return t;
  const restart = /\n---\s*\n+#\s+(?:Domain\s+Benchmark|Fase\s+0|Research\s+Report)\b/i.exec(t);
  if (restart?.index != null) return t.slice(0, restart.index).trim();
  if (hasDuplicateDbgaBlocks(t)) return deduplicateDbgaDocument(t);
  return t;
}

function formatEndpointCatalogMarkdown(catalog: string): string {
  const cleaned = catalog
    .trim()
    .replace(/^Aqu[ií]\s+tienes[^\n]*:\s*/i, "")
    .trim();
  return [
    "Endpoints esenciales para que la aplicación de chat externa integre el copiloto:",
    "",
    cleaned,
  ].join("\n");
}

function nextChangelogVersion(doc: string): string {
  const versions = [...doc.matchAll(/^\|\s*(\d+)\.(\d+)\s*\|/gm)].map((m) => ({
    major: Number(m[1]),
    minor: Number(m[2]),
  }));
  if (versions.length === 0) return "1.1";
  const best = versions.reduce((a, b) =>
    a.major > b.major || (a.major === b.major && a.minor >= b.minor) ? a : b,
  );
  return `${best.major}.${best.minor + 1}`;
}

/**
 * Inserta/actualiza §11 con el catálogo, marca la pregunta pendiente como respondida
 * y añade fila de changelog. Idempotente si `/v1/chats` ya está en §11.
 */
export function mergeApiEndpointCatalogIntoDbga(current: string, catalog: string): string {
  if (!looksLikeApiEndpointCatalog(catalog)) return (current ?? "").trim();

  let doc = stripTrailingDuplicateDbga(current);
  if (!doc) return formatEndpointCatalogMarkdown(catalog);

  const body = formatEndpointCatalogMarkdown(catalog);
  const section = `${SECTION_11_HEADING}\n\n${body}`;

  if (SECTION_11_BLOCK_RE.test(doc)) {
    doc = doc.replace(SECTION_11_BLOCK_RE, `\n${section}\n`);
  } else if (INTEGRATION_API_BLOCK_RE.test(doc)) {
    doc = doc.replace(INTEGRATION_API_BLOCK_RE, `\n${section}\n`);
  } else if (CHANGELOG_HEADING_RE.test(doc)) {
    doc = doc.replace(CHANGELOG_HEADING_RE, `\n\n${section}\n\n## Registro de cambios del documento`);
  } else {
    doc = `${doc}\n\n${section}`;
  }

  doc = doc.replace(PENDING_ENDPOINTS_Q_RE, (full, bullet: string, question: string) => {
    if (/\*\*Respuesta:\*\*/i.test(full)) return full;
    return `${bullet}${question.trim()} **Respuesta:** ver ${SECTION_11_HEADING.replace(/^##\s+/, "")}`;
  });

  const changelogTail = doc.match(/##\s+Registro de cambios del documento[\s\S]*$/i)?.[0] ?? "";
  const alreadyLogged =
    /Secci[oó]n 11|API de Integraci[oó]n con Chat Externo/i.test(changelogTail);
  if (!alreadyLogged) {
    doc = appendDocumentChangelogEntry(doc, {
      version: nextChangelogVersion(doc),
      date: formatDocumentChangelogDate(),
      description:
        "Añadida Sección 11 (API de Integración con Chat Externo) con endpoints de sesión, mensajería y monitoreo; cerrada la pregunta pendiente correspondiente.",
    });
  }

  return doc.trim();
}
