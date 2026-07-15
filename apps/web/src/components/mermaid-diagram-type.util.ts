/**
 * Detects Mermaid diagram type from content and determines Excalidraw support.
 * Used by ExcalidrawDiagramBlock to decide conversion strategy.
 */

export type MermaidDiagramType =
  | "flowchart"
  | "erDiagram"
  | "sequenceDiagram"
  | "classDiagram"
  | "stateDiagram"
  | "unsupported";

/**
 * Detects the Mermaid diagram type from raw content.
 * Handles common variations: flowchart TD/LR, stateDiagram-v2, etc.
 */
export function detectMermaidDiagramType(content: string): MermaidDiagramType {
  const trimmed = content.trim();
  if (/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)\b/i.test(trimmed)) return "flowchart";
  if (/^erDiagram\b/i.test(trimmed)) return "erDiagram";
  if (/^sequenceDiagram\b/i.test(trimmed)) return "sequenceDiagram";
  if (/^classDiagram\b/i.test(trimmed)) return "classDiagram";
  if (/^stateDiagram(-v2)?\b/i.test(trimmed)) return "stateDiagram";
  return "unsupported";
}

/**
 * Returns true if the diagram type can be converted to Excalidraw elements.
 * - flowchart: native elements (editable)
 * - erDiagram, sequenceDiagram, classDiagram: image fallback (read-only in Excalidraw)
 */
export function isExcalidrawSupported(type: MermaidDiagramType): boolean {
  return ["flowchart", "erDiagram", "sequenceDiagram", "classDiagram"].includes(type);
}

/**
 * Returns true if the diagram type converts to native Excalidraw elements (fully editable).
 * Currently only flowcharts produce native elements.
 */
export function isNativeExcalidraw(type: MermaidDiagramType): boolean {
  return type === "flowchart";
}
