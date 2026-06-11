import type { AriadneCodebaseScope } from "./ariadne-mcp-scope.util.js";

export type LegacyDocumentationCatalogProject = {
  id: string;
  roots?: Array<{ id: string; name?: string }>;
};

export type LegacyDocumentationRepoPart = {
  repoId: string;
  label: string;
  markdown: string;
};

/**
 * Lista de `roots[].id` para doc. partida: todos los del scope resuelto, o fallback al repo del grafo.
 */
export function legacyDocumentationRepoIds(
  scope: AriadneCodebaseScope | undefined,
  graphProjectId: string,
): string[] {
  const fromScope = scope?.repoIds?.map((x) => x.trim()).filter(Boolean) ?? [];
  if (fromScope.length > 0) {
    return Array.from(new Set(fromScope));
  }
  const g = graphProjectId.trim();
  return g ? [g] : [];
}

/** Etiqueta legible de un `roots[].id` desde el catálogo MCP. */
export function repoLabelFromProjectsCatalog(
  catalog: LegacyDocumentationCatalogProject[],
  repoId: string,
): string {
  for (const p of catalog) {
    const r = p.roots?.find((x) => x.id === repoId);
    if (r?.name?.trim()) return r.name.trim();
  }
  return `repo:${repoId.slice(0, 8)}…`;
}

/**
 * Fusiona MDD markdown por repositorio (mismo separador que `semanticSearch` multi-root).
 */
export function mergeLegacyDocumentationByRepo(parts: LegacyDocumentationRepoPart[]): string {
  const chunks = parts
    .map((p) => {
      const md = p.markdown.trim();
      if (!md) return "";
      const label = p.label.trim() || `repo:${p.repoId.slice(0, 8)}…`;
      return `## Repositorio: ${label} (\`${p.repoId.slice(0, 8)}…\`)\n\n${md}`;
    })
    .filter(Boolean);
  return chunks.join("\n\n---\n\n");
}
