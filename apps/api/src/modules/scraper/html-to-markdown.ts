/**
 * Convierte un fragmento HTML (ya limpiado) a markdown.
 * Reglas: h1–h6, p, ul/ol, a, pre/code. Sin dependencias extra.
 */
export function htmlToMarkdown(html: string): string {
  if (!html?.trim()) return "";
  const normalized = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
    .replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n")
    .replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n")
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n")
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const trimmed = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return trimmed.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Dado texto plano (por ej. extraído por Cheerio), escapa y formatea mínimamente a markdown.
 * Útil cuando Cheerio devuelve .text() y no HTML.
 */
export function plainTextToMarkdown(text: string): string {
  if (!text?.trim()) return "";
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");
}
