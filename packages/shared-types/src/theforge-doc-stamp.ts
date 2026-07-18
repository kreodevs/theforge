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

export type TheforgeDocDateTimeFormatOptions = {
  /** IANA timezone; default `UTC` (API stamp). Web should pass `Intl.DateTimeFormat().resolvedOptions().timeZone`. */
  timeZone?: string;
};

function formatTimeZoneSuffix(d: Date, timeZone: string): string {
  if (timeZone === "UTC") return " UTC";
  const parts = new Intl.DateTimeFormat(STAMP_LOCALE, {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(d);
  const label = parts.find((p) => p.type === "timeZoneName")?.value;
  return label ? ` ${label}` : ` (${timeZone})`;
}

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

/** Human-readable label (seconds). Default UTC for persisted markdown; pass browser TZ in Workshop. */
export function formatTheforgeDocDateTime(
  iso: string,
  options?: TheforgeDocDateTimeFormatOptions,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const timeZone = options?.timeZone ?? "UTC";
  const datePart = d.toLocaleDateString(STAMP_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
  const timePart = d.toLocaleTimeString(STAMP_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  });
  return `${datePart}, ${timePart}${formatTimeZoneSuffix(d, timeZone)}`;
}

export function formatTheforgeDocTimestampsForDisplay(
  raw: Partial<TheforgeDocTimestamps>,
  options?: TheforgeDocDateTimeFormatOptions,
): TheforgeDocTimestamps | null {
  if (!raw.created || !raw.updated) return null;
  return {
    created: formatTheforgeDocDateTime(raw.created, options),
    updated: formatTheforgeDocDateTime(raw.updated, options),
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

  // Fragmento huérfano si el comentario HTML quedó truncado (`--> > 📅 …`).
  if (body.startsWith("-->")) {
    const orphan = body.match(/^-->\s*/);
    if (orphan?.[0]) {
      stamp += orphan[0];
      body = body.slice(orphan[0].length);
    }
  }

  const humanPatterns = [
    HUMAN_HEADER_WITH_SEP_RE,
    /^>\s*📅[^\n]*\n---\s*\n+/,
    /^>\s*📅[^\n]*\s+---\s+/,
    HUMAN_BLOCKQUOTE_LINE_RE,
  ];
  for (const re of humanPatterns) {
    const human = body.match(re);
    if (human?.[0]) {
      stamp += human[0];
      body = body.slice(human[0].length);
      break;
    }
  }

  body = body.replace(/^---\s*\n+/, "");

  return { stamp, body };
}

export function reattachTheforgeDocStamp(stamp: string, body: string): string {
  if (!stamp) return body;
  if (!body) return stamp.replace(/\n+$/, "\n");
  return stamp + body.replace(/^\n+/, "");
}
