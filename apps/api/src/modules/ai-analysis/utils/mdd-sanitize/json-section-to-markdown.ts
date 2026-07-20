/** Convierte objeto con subsections (array de {title, description: string[]}) a markdown legible. */
export function subsectionsToMarkdown(val: unknown): string | null {
  if (!val || typeof val !== "object" || Array.isArray(val)) return null;
  const rec = val as Record<string, unknown>;
  const subsections = rec.subsections;
  if (!Array.isArray(subsections)) return null;
  const out: string[] = [];
  for (const sub of subsections) {
    if (!sub || typeof sub !== "object") continue;
    const s = sub as Record<string, unknown>;
    const title = s.title;
    if (title != null) out.push(`### ${String(title)}`, "");
    const desc = s.description;
    if (Array.isArray(desc)) {
      for (const d of desc) linesPushDesc(out, d);
      out.push("");
    } else if (typeof desc === "string") {
      out.push(`- ${desc}`, "");
    }
  }
  return out.length ? out.join("\n").trim() : null;
}

function linesPushDesc(out: string[], d: unknown): void {
  out.push(typeof d === "string" ? `- ${d}` : `- ${JSON.stringify(d)}`);
}

/** Convierte un item (string u objeto con title/description o subsections) a línea(s) markdown. */
function contentItemToMarkdown(item: unknown): string[] {
  if (typeof item === "string") return [item.trim()].filter(Boolean);
  if (typeof item !== "object" || item === null) return [String(item)];
  const subMd = subsectionsToMarkdown(item);
  if (subMd) return [subMd];
  const rec = item as Record<string, unknown>;
  if (rec.title != null && rec.description != null) {
    const lines: string[] = [`### ${String(rec.title)}`, ""];
    const desc = rec.description;
    if (Array.isArray(desc)) {
      for (const d of desc) linesPushDesc(lines, d);
    } else if (typeof desc === "string") {
      lines.push(desc);
    }
    return [lines.join("\n")];
  }
  return [JSON.stringify(item, null, 2)];
}

/**
 * Si el contenido de una sección (Seguridad/Integración) es un objeto JSON con claves como títulos
 * y valores como arrays de strings u objetos (subsections), lo convierte a markdown legible.
 */
export function jsonSectionToMarkdown(sectionContent: string, sectionTitle: string): string {
  const trimmed = (sectionContent || "").trim();
  if (!trimmed || !trimmed.startsWith("{") || !trimmed.includes('"')) return sectionContent;
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof obj !== "object" || Array.isArray(obj)) return sectionContent;
    const keys = Object.keys(obj);
    const isTitleContentShape =
      keys.length >= 2 &&
      keys.some((k) => k.toLowerCase() === "title") &&
      keys.some((k) => k.toLowerCase() === "content");
    const lines: string[] = [`## ${sectionTitle}`, ""];
    for (const [key, val] of Object.entries(obj)) {
      if (key.toLowerCase() === "title") continue;
      if (key.toLowerCase() === "content" && isTitleContentShape && Array.isArray(val)) {
        for (const item of val) {
          const parts = contentItemToMarkdown(item);
          for (const p of parts) lines.push(p.includes("\n") ? p : `- ${p}`);
        }
        lines.push("");
        continue;
      }
      const heading = key.trim().startsWith("###") ? key.trim() : `### ${key}`;
      lines.push(heading, "");
      if (Array.isArray(val)) {
        for (const item of val) {
          const parts = contentItemToMarkdown(item);
          for (const p of parts) lines.push(p.includes("\n") ? p : `- ${p}`);
        }
      } else if (typeof val === "string") {
        lines.push(val);
      } else if (typeof val === "object" && val !== null) {
        const subMd = subsectionsToMarkdown(val);
        lines.push(subMd ?? JSON.stringify(val, null, 2));
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  } catch {
    return sectionContent;
  }
}
