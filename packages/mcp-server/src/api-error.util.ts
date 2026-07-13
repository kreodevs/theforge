/**
 * Formatea respuestas de error de la API Nest (JSON `{ message, statusCode }`) en mensajes claros en español.
 */
export function formatNestApiError(status: number, body: string): string {
  let apiMessage = "";
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] };
    if (typeof parsed.message === "string") {
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
