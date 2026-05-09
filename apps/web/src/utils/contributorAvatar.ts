/**
 * @fileoverview Resolve contributor portrait URLs: GitHub public API, Gravatar (email hash).
 */
import md5 from "md5";

/**
 * Extract email address from a `mailto:` profile URL.
 */
export function parseMailtoEmail(profileUrl?: string): string | undefined {
  if (!profileUrl?.toLowerCase().startsWith("mailto:")) return undefined;
  const raw = profileUrl.slice("mailto:".length);
  const addr = raw.split("?")[0];
  try {
    return decodeURIComponent(addr ?? "").trim().toLowerCase();
  } catch {
    return addr?.trim().toLowerCase();
  }
}

/**
 * Gravatar URL; uses `d=404` so missing images fail fast and the UI can fall back to initials.
 */
export function gravatarAvatarUrl(email: string): string {
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=96&d=404`;
}

/**
 * Fetches the profile photo GitHub serves for a login (unauthenticated API; rate limits apply).
 */
export async function fetchGithubAvatarUrl(login: string): Promise<string | undefined> {
  const trimmed = login.trim();
  if (!trimmed) return undefined;
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(trimmed)}`);
  if (!response.ok) return undefined;
  const data = (await response.json()) as { avatar_url?: unknown };
  return typeof data.avatar_url === "string" ? data.avatar_url : undefined;
}

/**
 * Initial synchronous avatar URL: explicit override or Gravatar when no GitHub login is set.
 */
export function getContributorAvatarUrlSync(contributor: {
  avatarUrl?: string;
  githubUsername?: string;
  profileUrl?: string;
}): string | undefined {
  if (contributor.avatarUrl?.trim()) return contributor.avatarUrl.trim();
  if (contributor.githubUsername?.trim()) return undefined;
  const email = parseMailtoEmail(contributor.profileUrl);
  if (email) return gravatarAvatarUrl(email);
  return undefined;
}
