/**
 * The Forge document timestamp header (creation / last regeneration).
 *
 * Written by API `prependDocumentTimestamps`. Must survive Workshop
 * `formatDocumentMarkdown` / AST `removePreamble`, which otherwise drop
 * everything before the first H1/H2.
 *
 * ```
 * <!-- theforge-doc:created=ISO|updated=ISO -->
 * > 📅 Creado: … · Última regeneración: …
 *
 * ---
 * ```
 */

const META_COMMENT_RE =
  /^<!--\s*theforge-doc:created=([^|]+)\|updated=([^|]+)\s*-->\s*\n?/;

/** Human line (current Creado/… or legacy Generado/…) + optional `---` separator. */
const HUMAN_HEADER_WITH_SEP_RE = /^>\s*📅[\s\S]*?\n\n---\n\n/;

/** Blockquote stamp without `---` (regeneraciones que van directo al H1). */
const HUMAN_BLOCKQUOTE_LINE_RE = /^>\s*📅[^\n]*\n+/;

const STAMP_LOCALE = "es-MX";

export type TheforgeDocTimestamps = {
  created: string;
  updated: string;
};

/** ISO timestamps from the HTML comment (machine-readable stamp). */
export function parseTheforgeDocTimestamps(text: string): Partial<TheforgeDocTimestamps> {
  const match = (text ?? "").match(META_COMMENT_RE);
  if (!match) return {};
  const created = match[1]?.trim();
  const updated = match[2]?.trim();
  return {
    ...(created ? { created } : {}),
    ...(updated ? { updated } : {}),
  };
}

/** Human-readable UTC label (seconds) for Workshop UI. */
export function formatTheforgeDocDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString(STAMP_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const timePart = d.toLocaleTimeString(STAMP_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${datePart}, ${timePart} UTC`;
}

export function formatTheforgeDocTimestampsForDisplay(
  raw: Partial<TheforgeDocTimestamps>,
): TheforgeDocTimestamps | null {
  if (!raw.created || !raw.updated) return null;
  return {
    created: formatTheforgeDocDateTime(raw.created),
    updated: formatTheforgeDocDateTime(raw.updated),
  };
}

export function peelTheforgeDocStamp(text: string): { stamp: string; body: string } {
  if (!text) return { stamp: "", body: text };
  let body = text;
  let stamp = "";

  const meta = body.match(META_COMMENT_RE);
  if (meta?.[0]) {
    stamp += meta[0];
    body = body.slice(meta[0].length);
  }

  const humanWithSep = body.match(HUMAN_HEADER_WITH_SEP_RE);
  if (humanWithSep?.[0]) {
    stamp += humanWithSep[0];
    body = body.slice(humanWithSep[0].length);
  } else {
    const humanLine = body.match(HUMAN_BLOCKQUOTE_LINE_RE);
    if (humanLine?.[0]) {
      stamp += humanLine[0];
      body = body.slice(humanLine[0].length);
      body = body.replace(/^---\s*\n+/, "");
    }
  }

  return { stamp, body };
}

export function reattachTheforgeDocStamp(stamp: string, body: string): string {
  if (!stamp) return body;
  if (!body) return stamp.replace(/\n+$/, "\n");
  return stamp + body.replace(/^\n+/, "");
}
