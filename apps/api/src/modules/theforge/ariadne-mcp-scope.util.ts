/**
 * Alineación con Ariadne `list_known_projects` y SPEC-MCP-001 / MCP_HTTPS.md:
 * - `id` = proyecto workspace (ingest: `/projects/:id/...`).
 * - `roots[].id` = repo indexado (ingest: `/repositories/:id/...`, nodo `projectId` en Falkor según sync).
 *
 * `get_modification_plan` → `POST /projects/:projectId/modification-plan` → **projectId = workspace `id`**.
 * `ask_codebase` → `POST /projects/:id/chat` primero → **projectId = workspace `id`** + `scope.repoIds`: si el id guardado es un **root**, se envían **todos** los `roots[].id` del proyecto (código del proyecto Ariadne), no solo ese repo.
 * `semantic_search` **no** admite `scope` ni `currentFilePath` (solo `projectId` + `limit`).
 */

export type AriadneListedRoot = { id: string };

export type AriadneListedProject = {
  id: string;
  roots?: AriadneListedRoot[];
};

/** Misma forma que TheForgeScope (evita import circular con theforge.service). */
export type AriadneCodebaseScope = {
  repoIds?: string[];
  includePathPrefixes?: string[];
  excludePathGlobs?: string[];
};

export type AriadneCodebaseResolution = {
  /**
   * UUID del **proyecto Ariadne** (`list_known_projects[].id`): rutas ingest proyecto
   * (`ask_codebase`, `get_modification_plan`).
   */
  workspaceProjectId: string;
  /**
   * UUID para **grafo Falkor** / herramientas que no usan `scope`: típicamente `roots[].id`
   * del repo (primer root si el usuario eligió el workspace completo).
   */
  graphProjectId: string;
  /**
   * Solo `ask_codebase` y `get_modification_plan` (mismo objeto que envía el MCP al ingest).
   */
  scopeForScopedTools?: AriadneCodebaseScope;
};

/**
 * @param storedTheforgeId - Valor persistido en `Project.theforgeProjectId` (workspace o `roots[].id`).
 * @param catalog - Resultado reciente de `list_known_projects` (o [] si no disponible).
 */
export function resolveAriadneCodebaseMcpTarget(
  storedTheforgeId: string,
  catalog: AriadneListedProject[] | null | undefined,
): AriadneCodebaseResolution {
  const raw = storedTheforgeId.trim();
  if (!raw) {
    return { workspaceProjectId: raw, graphProjectId: raw };
  }

  if (!catalog?.length) {
    return { workspaceProjectId: raw, graphProjectId: raw };
  }

  const asWorkspace = catalog.find((p) => p.id === raw);
  if (asWorkspace?.roots?.length) {
    const repoIds = Array.from(
      new Set(asWorkspace.roots.map((r) => r.id.trim()).filter(Boolean)),
    );
    const scopeForScopedTools: AriadneCodebaseScope | undefined =
      repoIds.length > 0 ? { repoIds: repoIds } : undefined;
    return {
      workspaceProjectId: asWorkspace.id,
      graphProjectId: repoIds[0] ?? asWorkspace.id,
      ...(scopeForScopedTools?.repoIds?.length ? { scopeForScopedTools } : {}),
    };
  }

  if (asWorkspace) {
    return { workspaceProjectId: raw, graphProjectId: raw };
  }

  for (const p of catalog) {
    const roots = p.roots;
    if (!roots?.length) continue;
    if (!roots.some((r) => r.id === raw)) continue;
    /** Mismo criterio que si el usuario guardó el `id` del workspace: chat/plan ingest ven **todo** el proyecto Ariadne, no un solo root. `graphProjectId` sigue siendo el root guardado (shard Falkor / selección). */
    const allRepoIds = Array.from(new Set(roots.map((r) => r.id.trim()).filter(Boolean)));
    return {
      workspaceProjectId: p.id,
      graphProjectId: raw,
      ...(allRepoIds.length > 0 ? { scopeForScopedTools: { repoIds: allRepoIds } } : {}),
    };
  }

  return { workspaceProjectId: raw, graphProjectId: raw };
}

/** Combina scope resuelto desde catálogo con overrides del caller (overlay gana en cada campo presente). */
export function mergeAriadneCodebaseScope(
  resolved: AriadneCodebaseScope | undefined,
  overlay: AriadneCodebaseScope | undefined,
): AriadneCodebaseScope | undefined {
  if (!resolved && !overlay) return undefined;
  const out: AriadneCodebaseScope = {};
  const repoIds = overlay?.repoIds?.length ? overlay.repoIds : resolved?.repoIds;
  if (repoIds?.length) out.repoIds = Array.from(new Set(repoIds.map((x) => x.trim()).filter(Boolean)));
  const ipp = overlay?.includePathPrefixes?.length
    ? overlay.includePathPrefixes
    : resolved?.includePathPrefixes;
  if (ipp?.length) out.includePathPrefixes = ipp;
  const ex = overlay?.excludePathGlobs?.length ? overlay.excludePathGlobs : resolved?.excludePathGlobs;
  if (ex?.length) out.excludePathGlobs = ex;
  return Object.keys(out).length ? out : undefined;
}
