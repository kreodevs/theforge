/**
 * Prepend creation / last-updated timestamp header to any SDD document.
 *
 * Format (at the very top of the markdown):
 *
 * ```
 * <!-- theforge-doc:created=ISO:updated=ISO -->
 * > 📅 Generado: DD MMM YYYY, HH:MM · Actualizado: DD MMM YYYY, HH:MM
 *
 * ---
 * ```
 *
 * - The HTML comment is machine-parseable and hidden in renderers.
 * - The blockquote is human-visible in Workshop and AI IDE.
 * - `---` separates the header from the document body.
 *
 * On first call, `created = updated = now`. On subsequent calls the original
 * `created` is preserved from the existing content and only `updated` changes.
 */

const META_COMMENT_RE =
  /^<!--\s*theforge-doc:created=([^|]+)\|updated=([^|]+)\s*-->\s*\n?/;

const HUMAN_HEADER_RE =
  /^>\s*📅\s*Generado:.*?\n\n---\n\n/;

const LOCALE = "es-MX";

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function formatHumanDate(d: Date): string {
  return `${formatShortDate(d)}, ${formatTime(d)} UTC`;
}

/**
 * Parse existing timestamps from the document content.
 * Returns `undefined` dates when the header is absent.
 */
export function extractDocumentTimestamps(content: string): {
  created?: Date;
  updated?: Date;
} {
  const match = content.match(META_COMMENT_RE);
  if (!match) return {};
  return {
    created: new Date(match[1].trim()),
    updated: new Date(match[2].trim()),
  };
}

/**
 * Prepend or update the timestamp header on a document.
 *
 * @param content  Current markdown content (may already have a header).
 * @param now      Timestamp to use (defaults to `new Date()`).
 * @returns        Content with fresh header at the top.
 */
export function prependDocumentTimestamps(
  content: string,
  now: Date = new Date(),
): string {
  const existing = extractDocumentTimestamps(content);

  // Strip any existing header (both comment and human-readable)
  let body = content;
  body = body.replace(META_COMMENT_RE, "");
  body = body.replace(HUMAN_HEADER_RE, "");

  const created = existing.created ?? now;
  const updated = now;

  const comment = `<!-- theforge-doc:created=${created.toISOString()}|updated=${updated.toISOString()} -->`;
  const human = `> 📅 Generado: ${formatHumanDate(created)} · Actualizado: ${formatHumanDate(updated)}`;

  return `${comment}\n${human}\n\n---\n\n${body}`;
}
