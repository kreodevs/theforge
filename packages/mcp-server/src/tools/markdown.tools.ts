import { generateTable, normalizeTable } from "@theforge/shared-types/markdown-table";
import { generateMermaid, normalizeMermaid, validateMermaid } from "@theforge/shared-types/mermaid";
import type { McpApiClient, McpHandler, McpTool } from "../mcp-tool.types.js";

export const MARKDOWN_TOOLS: McpTool[] = [
  {
    name: "generate_markdown_table",
    description: "Genera una tabla markdown normalizada a partir de datos estructurados. Úsalo cada vez que necesites INSERTAR una tabla markdown nueva en un documento — headers, rows, alignment opcional. Es la ÚNICA fuente de verdad para tablas markdown, evita que cada LLM genere sintaxis diferente.",
    inputSchema: {
      type: "object",
      properties: {
        columns: {
          type: "array",
          items: {
            oneOf: [
              { type: "string", description: "Nombre del header (alignment=left)" },
              {
                type: "object",
                properties: {
                  header: { type: "string" },
                  align: { type: "string", enum: ["left", "center", "right"] },
                  minWidth: { type: "number" },
                },
                required: ["header"],
              },
            ],
          },
          description: "Encabezados de columna. Ej: ['Nombre', {header:'Edad', align:'right'}, 'Rol']",
        },
        rows: {
          type: "array",
          items: { type: "array", items: { type: "string" } },
          description: "Filas de datos. Cada fila debe tener el mismo número de celdas que columns.",
        },
        caption: { type: "string", description: "Título/texto opcional antes de la tabla" },
      },
      required: ["columns", "rows"],
    },
  },
  {
    name: "normalize_markdown_table",
    description: "Corrige una tabla markdown EXISTENTE (generada por un LLM) para que cumpla con el formato estandar: sin línea en blanco tras el separador, columnas padding uniforme, sin filas vacías, alignment detectado automáticamente.",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "La tabla markdown a normalizar (puede incluir ```mermaid``` fences)" },
      },
      required: ["table"],
    },
  },
  {
    name: "generate_mermaid",
    description: "Genera un diagrama Mermaid VÁLIDO a partir de datos estructurados. Soporta: flowchart, sequenceDiagram, classDiagram, erDiagram, gantt, stateDiagram, pie, gitGraph. Úsalo cada vez que necesites INSERTAR un diagrama Mermaid nuevo — es la ÚNICA fuente de verdad para sintaxis Mermaid.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["flowchart", "sequenceDiagram", "classDiagram", "erDiagram", "gantt", "stateDiagram", "pie", "gitGraph"],
          description: "Tipo de diagrama Mermaid",
        },
        options: {
          type: "object",
          description: "Opciones específicas del tipo de diagrama. Para flowchart: { direction, nodes: [{id, label, shape}], edges: [{from, to, label, type}], subgraphs }. Para sequenceDiagram: { participants: string[], messages: [{from, to, label, type}] }.",
          properties: {
            direction: { type: "string", description: "Solo para flowchart: TD, LR, BT, RL" },
            title: { type: "string", description: "Título del diagrama" },
          },
        },
      },
      required: ["type", "options"],
    },
  },
  {
    name: "normalize_mermaid",
    description: "Valida y corrige un diagrama Mermaid EXISTENTE (generado por un LLM). Detecta errores comunes: IDs con espacios, bloques alt/opt sin cerrar, subgraphs sin end, quotes inconsistentes, y los arregla automáticamente.",
    inputSchema: {
      type: "object",
      properties: {
        mermaid: { type: "string", description: "El diagrama Mermaid a normalizar (con o sin ```mermaid``` fences)" },
      },
      required: ["mermaid"],
    },
  },
];

export function createMarkdownHandlers(api: McpApiClient): Record<string, McpHandler> {
  const { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete, fetchAllowStatuses: apiFetchAllowStatuses } = api;
  return {
  async generate_markdown_table(args) {
    const { columns, rows, caption } = args as { columns: any[]; rows: string[][]; caption?: string };
    return generateTable({ columns, rows, caption });
  },
  async normalize_markdown_table(args) {
    const { table } = args as { table: string };
    return normalizeTable(table);
  },
  async generate_mermaid(args) {
    const { type, options } = args as { type: string; options: any };
    return generateMermaid({ type, options } as any);
  },
  async normalize_mermaid(args) {
    const { mermaid } = args as { mermaid: string };
    const normalized = normalizeMermaid(mermaid);
    const errors = validateMermaid(normalized);
    return JSON.stringify({ normalized, errors, hasErrors: errors.length > 0 });
  },
  };
}
