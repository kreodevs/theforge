/**
 * Parsea la respuesta del MCP: puede ser JSON directo o SSE (líneas event:/data:).
 * Parsea respuestas JSON-RPC directas o SSE del transporte MCP Streamable HTTP.
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
