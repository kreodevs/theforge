/**
 * Contexto determinista para tasks con coordenadas exactas (archivo, función, diff sugerido).
 * Complementa el navigation map MCP y ChangeScope de la entrevista legacy.
 */

import { extractSectionByNumber } from "../engine/mdd-markdown-parser.js";
import { extractMddCoreServices } from "../engine/sdd-coverage-checklist.util.js";
import type { ChangeScope } from "../legacy-flow/change-interview.types.js";
import type { ResolveChangeResult } from "../legacy-flow/resolve-change-to-files.service.js";

export interface TasksCoordinatesContextInput {
  navigationMapMarkdown?: string | null;
  changeScope?: ChangeScope | null;
  resolveResults?: Array<{ description: string; result: ResolveChangeResult }>;
  architectureMarkdown?: string | null;
  mddMarkdown?: string | null;
}

/** Lee ChangeScope confirmado desde `Stage.legacyChangeState`. */
export function parseChangeScopeFromLegacyState(
  legacyChangeState: unknown,
): ChangeScope | null {
  if (!legacyChangeState || typeof legacyChangeState !== "object") return null;
  const raw = (legacyChangeState as Record<string, unknown>).changeScope;
  if (!raw || typeof raw !== "object") return null;
  const scope = raw as ChangeScope;
  if (!scope.description?.trim()) return null;
  return scope;
}

/** Líneas de capacidad MVP en MDD §1 para resolver archivos vía navigation map. */
export function extractMddCapabilityLines(mddMarkdown: string, max = 5): string[] {
  const section1 = extractSectionByNumber(mddMarkdown, 1);
  if (!section1.trim()) return [];
  const lines: string[] = [];
  for (const line of section1.split("\n")) {
    const t = line.trim();
    if (!/^[-*]\s+/.test(t) && !/^\d+\.\s+/.test(t)) continue;
    const text = t.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
    if (text.length > 12) lines.push(text.slice(0, 200));
    if (lines.length >= max) break;
  }
  return lines;
}

/** Rutas `modules/{slug}/` inferidas del architecture + servicios MDD §2 (greenfield sin Ariadne). */
export function buildGreenfieldModulePathHints(
  mddMarkdown: string,
  architectureMarkdown: string | null | undefined,
): string[] {
  const hints = new Set<string>();
  const arch = (architectureMarkdown ?? "").trim();
  for (const m of arch.matchAll(/modules\/([a-z0-9-]+)\//gi)) {
    if (m[1]) hints.add(`apps/api/src/modules/${m[1]}/`);
  }
  for (const svc of extractMddCoreServices(mddMarkdown)) {
    const slug = svc
      .toLowerCase()
      .replace(/\s+(engine|service|gateway|orchestrator)$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug.length > 1) hints.add(`apps/api/src/modules/${slug}/`);
  }
  return [...hints].sort().slice(0, 12);
}

function formatChangeScopeBlock(scope: ChangeScope): string {
  const lines = [
    "### ChangeScope (entrevista confirmada)",
    "",
    scope.description,
    "",
  ];
  if (scope.affectedRoutes?.length) {
    lines.push("**Rutas afectadas:**");
    for (const r of scope.affectedRoutes.slice(0, 8)) {
      lines.push(`- ${r.url} → ${r.screen} (${r.components?.join(", ") ?? "—"})`);
    }
    lines.push("");
  }
  if (scope.newFields?.length) {
    lines.push("**Campos nuevos:**");
    for (const f of scope.newFields.slice(0, 10)) {
      lines.push(
        `- ${f.form}.${f.field} (${f.type}) en ${f.component}` +
          (f.afterField ? ` — después de \`${f.afterField}\`` : ""),
      );
    }
    lines.push("");
  }
  if (scope.affectedEndpoints?.length) {
    lines.push("**Endpoints:**");
    for (const ep of scope.affectedEndpoints.slice(0, 8)) {
      lines.push(`- ${ep.changeType} ${ep.method} ${ep.path}`);
    }
  }
  return lines.join("\n");
}

function formatResolveResultBlock(
  description: string,
  result: ResolveChangeResult,
): string {
  const lines = [`#### Cambio: ${description.slice(0, 120)}`];
  if (result.suggestedFiles.length) {
    lines.push("**Archivos sugeridos:** " + result.suggestedFiles.filter(Boolean).join(", "));
  }
  if (result.affectedRoutes.length) {
    lines.push("**Rutas:** " + result.affectedRoutes.join(", "));
  }
  if (result.sharedComponents.length) {
    lines.push("**Componentes compartidos:** " + result.sharedComponents.join(", "));
  }
  if (result.sddImpact.warnings.length) {
    lines.push("**Advertencias SDD:** " + result.sddImpact.warnings.join("; "));
  }
  return lines.join("\n");
}

/**
 * Bloque markdown inyectado en generateTasks cuando hay anclaje a código real.
 * Retorna vacío si no hay datos suficientes para activar modo coordenadas.
 */
export function buildTasksCoordinatesPromptBlock(input: TasksCoordinatesContextInput): {
  block: string;
  coordinatesMode: boolean;
} {
  const parts: string[] = [];

  if (input.changeScope) {
    parts.push(formatChangeScopeBlock(input.changeScope));
  }

  if (input.resolveResults?.length) {
    parts.push("### Resolución archivo ← navigation map");
    for (const { description, result } of input.resolveResults.slice(0, 6)) {
      if (result.suggestedFiles.length || result.affectedRoutes.length) {
        parts.push(formatResolveResultBlock(description, result));
      }
    }
  }

  const moduleHints = buildGreenfieldModulePathHints(
    input.mddMarkdown ?? "",
    input.architectureMarkdown,
  );
  if (moduleHints.length) {
    parts.push("### Módulos backend sugeridos (MDD §2 / architecture)");
    for (const h of moduleHints) parts.push(`- \`${h}\``);
  }

  const nav = (input.navigationMapMarkdown ?? "").trim();
  if (nav.length > 200) {
    parts.push("### Mapa de navegación (Ariadne)");
    parts.push(nav.slice(0, 8000));
  }

  const coordinatesMode =
    !!input.changeScope ||
    (input.resolveResults?.some((r) => r.result.suggestedFiles.length > 0) ?? false) ||
    nav.length > 200 ||
    moduleHints.length > 0;

  if (!coordinatesMode) {
    return { block: "", coordinatesMode: false };
  }

  const header = [
    "## Modo coordenadas exactas (ACTIVO)",
    "",
    "Para **cada** tarea aplicable, usa el formato del system prompt con **Archivo**, **Función**, **Línea** y bloque **Cambio** con diff sugerido.",
    "Prioriza las rutas listadas abajo; no inventes paths que contradigan el mapa o la resolución determinista.",
    "",
  ].join("\n");

  return { block: header + parts.join("\n\n"), coordinatesMode: true };
}
