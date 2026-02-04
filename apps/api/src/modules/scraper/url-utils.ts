import { MAX_URLS } from "./constants.js";

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
const MAX_URL_LENGTH = 2048;
const VALID_SCHEMES = ["http:", "https:"];

/**
 * Extrae URLs únicas y válidas de un string (idea del usuario).
 * Respeta MAX_URLS. Quita fragmento # para scraping.
 */
export function extractUrlsFromText(text: string): string[] {
  if (!text?.trim()) return [];
  const matches = text.trim().match(URL_REGEX) ?? [];
  const normalized = matches.map((u) => normalizeUrl(u)).filter((u) => isValidUrl(u));
  return dedupeAndLimit(normalized, MAX_URLS);
}

/**
 * Normaliza una URL: trim y quita fragmento # para scraping.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/**
 * Valida esquema (http/https) y longitud razonable.
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.length > MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(url);
    return VALID_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Combina urls explícitas con las extraídas del texto, deduplica y limita.
 */
export function resolveUrls(explicitUrls: string[] | undefined, text: string): string[] {
  const fromBody = (explicitUrls ?? [])
    .filter((u) => typeof u === "string" && u.trim())
    .map((u) => normalizeUrl(u.trim()))
    .filter(isValidUrl);
  const fromText = extractUrlsFromText(text);
  const combined = [...fromBody];
  for (const u of fromText) {
    if (!combined.includes(u)) combined.push(u);
  }
  return dedupeAndLimit(combined, MAX_URLS);
}

function dedupeAndLimit(urls: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= limit) break;
  }
  return out;
}
