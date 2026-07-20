import { formatNestApiError } from "./api-error.util.js";

const API_BASE = process.env.THEFORGE_API_URL ?? "http://theforge-api:3000";
const TIMEOUT_MS = Number(process.env.THEFORGE_MCP_TIMEOUT) || 120_000;

let jwtToken: string | null = null;
let lastClientSecret = "";
let tokenExpiresAt = 0;

export async function login(secret?: string): Promise<string> {
  const s = secret || lastClientSecret;
  if (!s) {
    throw new Error("MCP_M2M_SECRET header required — usa el secret de Settings en TheForge");
  }
  if (jwtToken && lastClientSecret === s && Date.now() < tokenExpiresAt - 300_000) {
    return jwtToken;
  }
  lastClientSecret = s;
  try {
    const res = await fetch(`${API_BASE}/auth/mcp-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: s }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MCP login failed: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as { accessToken: string };
    jwtToken = data.accessToken;
    tokenExpiresAt = Date.now() + 55 * 60 * 1000;
    return jwtToken;
  } catch (err) {
    jwtToken = null;
    tokenExpiresAt = 0;
    throw err;
  }
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (jwtToken) h.Authorization = `Bearer ${jwtToken}`;
  return h;
}

async function apiFetch(
  method: string,
  path: string,
  body?: unknown,
  retried = false,
): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: body != null ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 401 && !retried) {
      await login();
      return apiFetch(method, path, body, true);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(formatNestApiError(res.status, text));
    }
    return res.json();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${TIMEOUT_MS}ms: ${method} ${path}`);
    }
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error(`Network error connecting to API at ${API_BASE}${path}: ${err.message}`);
    }
    throw err;
  }
}

async function apiFetchAllowStatuses(
  method: string,
  path: string,
  body: unknown | undefined,
  allowedStatuses: number[],
  retried = false,
): Promise<{ status: number; data: unknown }> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (res.status === 401 && !retried) {
    await login();
    return apiFetchAllowStatuses(method, path, body, allowedStatuses, true);
  }

  const text = await res.text().catch(() => "");
  let data: unknown = text;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  } else {
    data = null;
  }

  if (res.ok || allowedStatuses.includes(res.status)) {
    return { status: res.status, data };
  }

  throw new Error(formatNestApiError(res.status, text));
}

/** Cliente HTTP tipado hacia la API Nest de The Forge (JWT M2M con retry en 401). */
export const mcpApiClient = {
  get: <T = unknown>(path: string) => apiFetch("GET", path) as Promise<T>,
  post: (path: string, body?: unknown) => apiFetch("POST", path, body),
  patch: (path: string, body?: unknown) => apiFetch("PATCH", path, body),
  delete: (path: string) => apiFetch("DELETE", path),
  fetchAllowStatuses: apiFetchAllowStatuses,
};
