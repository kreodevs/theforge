const TOKEN_KEY = "theforge_access_token";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Fetch al API con Authorization si hay sesión; ante 401 limpia token y emite evento. */
async function request(url: string, init?: RequestInit): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${url}`, { ...init, headers });
  if (res.status === 401 && token) {
    clearAccessToken();
    window.dispatchEvent(new Event("theforge:auth-expired"));
  }
  return res;
}

class ApiClient {
  get(url: string) {
    return request(url);
  }

  post(url: string, body?: unknown) {
    return request(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put(url: string, body?: unknown) {
    return request(url, {
      method: "PUT",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch(url: string, body?: unknown) {
    return request(url, {
      method: "PATCH",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete(url: string) {
    return request(url, { method: "DELETE" });
  }
}

export const api = new ApiClient();
