import { api } from "./api.js";

export async function regenerateMermaidDiagram(content: string): Promise<string> {
  const res = await api.post("/ai/mermaid/regenerate", { content });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Error al regenerar diagrama (${res.status})`);
  }
  const data = (await res.json()) as { content?: string };
  if (typeof data.content !== "string" || !data.content.trim()) {
    throw new Error("La IA no devolvió un diagrama válido");
  }
  return data.content.trim();
}
