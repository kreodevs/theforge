/**
 * Parses NestJS-style JSON error bodies or plain text (proxies, HTML errors).
 */
export function parseErrorBodyText(text: string, fallback: string, httpStatus?: number): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return httpStatus != null ? `${fallback} (HTTP ${httpStatus})` : fallback;
  }
  try {
    const data = JSON.parse(trimmed) as { message?: string | string[] };
    const m = data.message;
    if (typeof m === "string" && m.trim()) return m.trim();
    if (Array.isArray(m) && m.length > 0) return m.filter(Boolean).join(", ");
  } catch {
    /* not JSON */
  }
  if (trimmed.length <= 400) return trimmed;
  return `${trimmed.slice(0, 280)}…`;
}

export async function parseErrorMessageFromResponse(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  return parseErrorBodyText(text, fallback, res.status);
}

export function parseApiErrorPayload(
  text: string,
  fallback: string,
  httpStatus?: number,
): { message: string; code?: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { message: httpStatus != null ? `${fallback} (HTTP ${httpStatus})` : fallback };
  }
  try {
    const data = JSON.parse(trimmed) as { message?: string | string[]; code?: string };
    const m = data.message;
    const message =
      typeof m === "string" && m.trim()
        ? m.trim()
        : Array.isArray(m) && m.length > 0
          ? m.filter(Boolean).join(", ")
          : parseErrorBodyText(trimmed, fallback, httpStatus);
    const code = typeof data.code === "string" && data.code.trim() ? data.code.trim() : undefined;
    return { message, code };
  } catch {
    return { message: parseErrorBodyText(trimmed, fallback, httpStatus) };
  }
}

export async function parseApiErrorPayloadFromResponse(
  res: Response,
  fallback: string,
): Promise<{ message: string; code?: string }> {
  const text = await res.text();
  return parseApiErrorPayload(text, fallback, res.status);
}
