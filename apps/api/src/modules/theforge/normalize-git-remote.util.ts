/**
 * Normaliza URLs de remoto git para comparación estable (lowercase host/path, sin .git).
 */
export function normalizeGitRemoteUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  let url = trimmed.toLowerCase();
  if (url.endsWith(".git")) url = url.slice(0, -4);
  if (url.endsWith("/")) url = url.slice(0, -1);
  return url;
}

export function normalizeProjectKey(raw: string | null | undefined): string | null {
  const t = raw?.trim().toLowerCase();
  return t || null;
}

export function normalizeRepoSlug(raw: string | null | undefined): string | null {
  const t = raw?.trim().toLowerCase();
  return t || null;
}
