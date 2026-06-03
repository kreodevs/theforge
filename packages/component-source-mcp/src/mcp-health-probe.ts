import type { ComponentHealthCheck } from "@theforge/component-source";

/** URL GET /health derivada del endpoint MCP (p. ej. …/mcp → …/health). */
export function deriveMcpHealthUrl(mcpUrl: string): string {
  return mcpUrl.replace(/\/mcp\/?$/, "/health").replace(/\/+$/, "");
}

/**
 * Si GET /health falla (404, página estática, etc.), probar MCP vía tools/list.
 */
export function shouldFallbackHealthToMcpTools(httpError: string | undefined): boolean {
  if (!httpError?.trim()) return true;
  const e = httpError.toLowerCase();
  if (/\b404\b|\b405\b|\b501\b/.test(e)) return true;
  if (e.includes("page not found") || e.includes("not found")) return true;
  if (e.includes("/health")) return true;
  return true;
}

export async function probeHttpHealthEndpoint(
  mcpUrl: string,
  token?: string,
): Promise<ComponentHealthCheck> {
  const healthUrl = deriveMcpHealthUrl(mcpUrl);
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const raw = await res.text();
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      return { ok: true, service: typeof data.service === "string" ? data.service : undefined };
    } catch {
      const trimmed = raw.trim().toLowerCase();
      if (trimmed === "ok" || trimmed.includes("ok")) {
        return { ok: true, service: "component-mcp" };
      }
      return { ok: false, error: `Respuesta inesperada: ${raw.slice(0, 100)}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de conexión" };
  }
}
