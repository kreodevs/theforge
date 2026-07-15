type NestStructuredErrorMessage = {
  code?: string;
  message?: string;
  deliveryGate?: { blockers?: string[] };
};

function formatStructuredNestMessage(message: unknown): string | null {
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return null;
  }
  const m = message as NestStructuredErrorMessage;
  const blockers = (m.deliveryGate?.blockers ?? []).filter(
    (b): b is string => typeof b === "string" && b.trim().length > 0,
  );
  if (blockers.length > 0) return blockers.join(" · ");
  if (typeof m.message === "string" && m.message.trim()) return m.message.trim();
  if (typeof m.code === "string" && m.code.trim()) return m.code.trim();
  return null;
}

/**
 * Formatea respuestas de error de la API Nest (JSON `{ message, statusCode }`) en mensajes claros en español.
 */
export function formatNestApiError(status: number, body: string): string {
  let apiMessage = "";
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] | NestStructuredErrorMessage };
    const structured = formatStructuredNestMessage(parsed.message);
    if (structured) {
      apiMessage = structured;
    } else if (typeof parsed.message === "string") {
      apiMessage = parsed.message;
    } else if (Array.isArray(parsed.message)) {
      apiMessage = parsed.message.filter((m) => typeof m === "string").join("; ");
    }
  } catch {
    // body no JSON — usar texto crudo abajo
  }

  if (apiMessage) {
    switch (status) {
      case 403:
        return `Acceso denegado (403): ${apiMessage}`;
      case 404:
        return `No encontrado (404): ${apiMessage}`;
      case 400:
        return `Solicitud inválida (400): ${apiMessage}`;
      default:
        return `Error HTTP ${status}: ${apiMessage}`;
    }
  }

  const trimmed = body.trim();
  if (trimmed) return `HTTP ${status}: ${trimmed.slice(0, 500)}`;
  return `HTTP ${status}`;
}
