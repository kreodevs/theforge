/** Mismo digest que el API (sha256 del markdown recortado, 24 hex). */
export async function contentDigestHash(content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) return "";
  const data = new TextEncoder().encode(trimmed);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 24);
}
