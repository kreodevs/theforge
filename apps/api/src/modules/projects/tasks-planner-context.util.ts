/**
 * Contexto compacto para Tasks Planner (evita saturar ventana del graphChatModel).
 */

import type { DomainInventory } from "@theforge/shared-types";
import { formatDomainInventoryForPrompt } from "../engine/domain-inventory.util.js";
import { extractSectionByNumber } from "../engine/mdd-markdown-parser.js";
import {
  extractHttpEndpointsFromMarkdown,
  formatEndpointList,
} from "../ui-mcp/api-contract-endpoints.util.js";
import { extractPantallaRoutes } from "./tasks-generation-structure.util.js";

export type SlimTasksPlannerContextInput = {
  mddMarkdown: string;
  blueprintMarkdown?: string | null;
  taskOpts: {
    specContent?: string | null;
    apiContractsContent?: string | null;
    uiScreensContent?: string | null;
  };
};

/** Contexto reducido (~35–45k chars) para reintento del planner. */
export function buildSlimTasksPlannerContext(
  input: SlimTasksPlannerContextInput,
  inventory?: DomainInventory | null,
): string {
  const mdd = input.mddMarkdown.trim();
  const parts: string[] = [
    "Genera el plan JSON de Tasks (solo JSON). Prioriza cobertura MVP con IDs T-001… sin saltos.",
    "\n\nMDD §1 Contexto:\n---\n" + mddSection(mdd, 1, 4_000) + "\n---",
    "\n\nMDD §3 Modelo:\n---\n" + mddSection(mdd, 3, 8_000) + "\n---",
    "\n\nMDD §4 API:\n---\n" + mddSection(mdd, 4, 6_000) + "\n---",
    "\n\nMDD §5 Lógica:\n---\n" + mddSection(mdd, 5, 5_000) + "\n---",
    "\n\nMDD §6 Seguridad:\n---\n" + mddSection(mdd, 6, 3_000) + "\n---",
    "\n\nMDD §7 Infra:\n---\n" + mddSection(mdd, 7, 3_000) + "\n---",
  ];

  const spec = (input.taskOpts.specContent ?? "").trim();
  if (spec) parts.push("\n\nSpec (extracto):\n---\n" + spec.slice(0, 5_000) + "\n---");

  const api = (input.taskOpts.apiContractsContent ?? "").trim();
  if (api) parts.push("\n\nAPI Contracts (resumen):\n---\n" + apiEndpointSummary(api) + "\n---");

  const blueprint = (input.blueprintMarkdown ?? "").trim();
  if (blueprint) parts.push("\n\nBlueprint (extracto):\n---\n" + blueprint.slice(0, 6_000) + "\n---");

  const ui = (input.taskOpts.uiScreensContent ?? "").trim();
  if (ui) parts.push("\n\nPantallas (rutas):\n---\n" + pantallaRouteSummary(ui) + "\n---");

  if (inventory) {
    parts.push(
      "\n\nInventario dominio:\n---\n" + formatDomainInventoryForPrompt(inventory, 2_500) + "\n---",
    );
  } else if (api) {
    const eps = extractHttpEndpointsFromMarkdown(api);
    parts.push("\n\nEndpoints clave: " + formatEndpointList(eps, 12));
  }

  return parts.join("");
}

function mddSection(md: string, n: number, cap: number): string {
  const body = extractSectionByNumber(md, n).trim();
  return body.length > cap ? body.slice(0, cap) + "\n…[truncado]" : body;
}

function apiEndpointSummary(apiMarkdown: string, maxLines = 80): string {
  const endpoints = extractHttpEndpointsFromMarkdown(apiMarkdown);
  if (endpoints.length === 0) return (apiMarkdown ?? "").trim().slice(0, 6_000);
  const lines = endpoints.slice(0, maxLines).map((e) => `- ${e.method} ${e.path}`);
  const tail =
    endpoints.length > maxLines ? `\n…(+${endpoints.length - maxLines} endpoints)` : "";
  return `# Endpoints (${endpoints.length})\n${lines.join("\n")}${tail}`;
}

function pantallaRouteSummary(uiMarkdown: string, max = 40): string {
  const routes = extractPantallaRoutes(uiMarkdown).filter((r) => !/\/admin\/proc-cap/i.test(r));
  if (routes.length === 0) return (uiMarkdown ?? "").trim().slice(0, 4_000);
  return `# Rutas (${routes.length})\n${routes
    .slice(0, max)
    .map((r) => `- ${r}`)
    .join("\n")}${routes.length > max ? `\n…(+${routes.length - max})` : ""}`;
}
