/**
 * Utilidades HTTP mínimas para cliente MCP Streamable HTTP (JSON-RPC / SSE).
 * Compartidas entre TheForgeService y pruebas de contrato.
 */

/**
 * Parsea la respuesta del MCP: puede ser JSON directo o SSE (líneas event:/data:).
 * @param raw - Texto crudo de la respuesta HTTP del MCP.
 * @returns Objeto parseado o null si no se puede extraer JSON.
 */
export function parseMcpResponse(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(raw) as unknown;
  }
  for (const line of raw.split("\n")) {
    const dataLine = line.startsWith("data:") ? line.slice(5).trim() : null;
    if (dataLine && dataLine.startsWith("{")) {
      return JSON.parse(dataLine) as unknown;
    }
  }
  return null;
}
