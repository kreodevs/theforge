/**
 * Parses NestJS-style JSON error bodies or plain text (proxies, HTML errors).
 */
function formatStructuredNestMessage(message: unknown): string | null {
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return null;
  }
  const m = message as {
    code?: string;
    message?: string;
    deliveryGate?: { blockers?: string[] };
  };
  const blockers = (m.deliveryGate?.blockers ?? []).filter(
    (b): b is string => typeof b === "string" && b.trim().length > 0,
  );
  if (blockers.length > 0) return blockers.join(" — ");
  if (typeof m.message === "string" && m.message.trim()) return m.message.trim();
  if (typeof m.code === "string" && m.code.trim()) return m.code.trim();
  return null;
}

export function parseErrorBodyText(text: string, fallback: string, httpStatus?: number): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return httpStatus != null ? `${fallback} (HTTP ${httpStatus})` : fallback;
  }
  try {
    const data = JSON.parse(trimmed) as { message?: string | string[] | Record<string, unknown>; code?: string };
    const structured = formatStructuredNestMessage(data.message);
    if (structured) return structured;
    if (data.code === "MODELS_UNAVAILABLE") {
      return "No hay un modelo disponible configurado. Revisa el modelo principal y los respaldos en Ajustes → Gestionar instancias.";
    }
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

function messageFromJsonObject(data: {
  type?: string;
  message?: string | string[];
  code?: string;
}): { message: string; code?: string } | null {
  const m = data.message;
  const message =
    typeof m === "string" && m.trim()
      ? m.trim()
      : Array.isArray(m) && m.length > 0
        ? m.filter(Boolean).join(", ")
        : null;
  if (!message) return null;
  const code = typeof data.code === "string" && data.code.trim() ? data.code.trim() : undefined;
  return { message, code };
}

/** Parsea cuerpo de error: JSON Nest, NDJSON (varias líneas) o texto plano. */
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
    const single = messageFromJsonObject(
      JSON.parse(trimmed) as { type?: string; message?: string | string[]; code?: string },
    );
    if (single) return single;
  } catch {
    /* puede ser NDJSON u otro formato */
  }
  for (const line of trimmed.split(/\n+/)) {
    const row = line.trim();
    if (!row) continue;
    try {
      const parsed = messageFromJsonObject(
        JSON.parse(row) as { type?: string; message?: string | string[]; code?: string },
      );
      if (parsed && (parsed.message || row.includes('"type":"error"'))) {
        return parsed;
      }
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }
  return { message: parseErrorBodyText(trimmed, fallback, httpStatus) };
}

export async function parseApiErrorPayloadFromResponse(
  res: Response,
  fallback: string,
): Promise<{ message: string; code?: string }> {
  const text = await res.text();
  return parseApiErrorPayload(text, fallback, res.status);
}

/** Maps Nest/Express technical messages to user-facing Spanish copy. */
export function formatUserFacingApiError(message: string, httpStatus?: number): string {
  const m = message.trim();
  if (!m) {
    if (httpStatus === 404) {
      return "El servicio no está disponible. Comprueba que la API esté actualizada y en ejecución.";
    }
    if (httpStatus != null && httpStatus >= 500) {
      return "Error interno del servidor. Inténtalo de nuevo en unos minutos.";
    }
    return "No se pudo completar la operación. Inténtalo de nuevo.";
  }

  if (/^Cannot (GET|POST|PUT|PATCH|DELETE) \//i.test(m)) {
    if (httpStatus === 404) {
      return "Fase 0 no está disponible en el servidor. Asegúrate de que la API esté actualizada y en ejecución, luego vuelve a intentarlo.";
    }
    return "Esta acción no está disponible en el servidor. Inténtalo de nuevo en unos momentos.";
  }

  if (httpStatus === 401 || /\bunauthorized\b/i.test(m)) {
    return "Tu sesión ha expirado. Vuelve a iniciar sesión e inténtalo de nuevo.";
  }
  if (httpStatus === 403 || /\bforbidden\b/i.test(m)) {
    return "No tienes permiso para realizar esta acción.";
  }
  if (httpStatus === 429) {
    return "Demasiadas peticiones. Espera un momento e inténtalo de nuevo.";
  }
  if (httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
    return "El servidor no está disponible temporalmente. Inténtalo de nuevo en unos minutos.";
  }
  if (httpStatus != null && httpStatus >= 500) {
    return "Error interno del servidor. Si el problema continúa, contacta al administrador.";
  }

  return m;
}

export async function parseUserFacingErrorMessageFromResponse(
  res: Response,
  fallback: string,
): Promise<string> {
  const text = await res.text();
  const parsed = parseErrorBodyText(text, fallback, res.status);
  return formatUserFacingApiError(parsed, res.status);
}

export function formatUserFacingThrownError(e: unknown, fallback: string): string {
  if (e instanceof TypeError && /fetch|network|failed/i.test(e.message)) {
    return "No se pudo conectar con el servidor. Comprueba tu conexión y que la API esté en marcha.";
  }
  if (e instanceof Error) {
    return formatUserFacingApiError(e.message, undefined);
  }
  return fallback;
}
