/** Extrae un mensaje legible de una respuesta API fallida (NestJS / validación). */
export async function readApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await response.json()) as {
      message?: string | string[];
      code?: string;
    };
    const msg = data.message;
    if (Array.isArray(msg) && msg.length > 0) return msg.join(", ");
    if (typeof msg === "string" && msg.trim()) return msg.trim();
    if (data.code === "ERR_DOC_ACCURACY_HARD_GATE") {
      return "Exactitud documental insuficiente para exportar (umbral 90%). Revisa conformidad en el semáforo.";
    }
  } catch {
    // body no JSON
  }
  if (response.status === 401) return "Sesión expirada. Vuelve a iniciar sesión.";
  if (response.status >= 500) return "Error del servidor al preparar la exportación.";
  return fallback;
}
