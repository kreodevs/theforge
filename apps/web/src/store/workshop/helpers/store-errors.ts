import { parseApiErrorPayloadFromResponse } from "../../../utils/httpError";
import { isModelsUnavailableStreamError } from "../../../utils/llm-stream-error";

export async function throwStreamHttpError(res: Response, fallback: string): Promise<never> {
  const { message, code } = await parseApiErrorPayloadFromResponse(res, fallback);
  const err = new Error(message) as Error & { code?: string };
  if (code) err.code = code;
  throw err;
}

export function friendlyFetchError(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message;
    if (
      msg === "Load failed" ||
      msg === "Failed to fetch" ||
      msg === "NetworkError when attempting to fetch resource." ||
      msg === "The network connection was lost." ||
      msg.startsWith("TypeError: Failed to fetch") ||
      msg.startsWith("TypeError: NetworkError") ||
      msg.startsWith("TypeError: Load failed") ||
      msg.includes("ERR_CONNECTION") ||
      msg.includes("ERR_NETWORK") ||
      msg.includes("network") ||
      msg.includes("NetworkError") ||
      /load\s+fail/i.test(msg) ||
      /failed\s+to\s+fetch/i.test(msg)
    ) {
      return "Error de conexión con el servidor. Reintenta en unos segundos.";
    }
    return msg;
  }
  return String(e);
}

export function streamErrorPatch(event: { message?: string; code?: string }) {
  const message = String(event.message ?? "Error en el análisis");
  return {
    error: message,
    modelsUnavailableModalOpen: isModelsUnavailableStreamError(event),
  };
}

export function errorStateFromCaught(e: unknown) {
  const message = friendlyFetchError(e);
  if (e instanceof Error) {
    const code =
      "code" in e && typeof (e as { code?: string }).code === "string"
        ? (e as { code?: string }).code
        : undefined;
    return streamErrorPatch({ message, code });
  }
  return streamErrorPatch({ message });
}
