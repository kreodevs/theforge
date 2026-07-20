import type { SkillCatalogEntry } from "../agent-governance-catalog.js";
import type { buildArtifactTemplateContext } from "../suggest-agent-governance-artifacts.js";

export function defaultTheforgeDocSyncSkill(): string {
  return (
    "---\n" +
    "name: theforge-doc-sync\n" +
    "description: Reporta gaps de documentación SDD vía MCP The Forge cuando el código diverge de los entregables (inline o al revisar el diff al cerrar la sesión / antes de commit).\n" +
    "---\n\n" +
    "# The Forge doc sync\n\n" +
    "## Cuándo usar\n\n" +
    "El código implementado es correcto pero el SDD (MDD, Blueprint, Tasks, contratos, flujos, infra…) no lo refleja. Dos disparadores:\n\n" +
    "- **Inline:** detectas el desvío mientras implementas.\n" +
    "- **Fin de sesión / pre-commit:** revisas el diff acumulado antes de cerrar la tarea o commitear.\n\n" +
    "En greenfield pre-producción esto es lo normal: entra funcionalidad nueva o afloran faltantes de documentación. **No abras una etapa nueva por cada desvío** (proliferan etapas difíciles de auditar); reconcilia el SDD de la **etapa activa** con este flujo.\n\n" +
    "## Pasos (fin de sesión / pre-commit)\n\n" +
    "1. `git diff` (o `git diff --staged`) para ver qué cambió realmente.\n" +
    "2. Contrasta con el SDD: ¿el cambio contradice o no está en el MDD §, `docs/sdd/*` o `tasks.md`?\n" +
    "3. Lee `.theforge-project.json` → `projectId`, `stageId`.\n" +
    "4. Por cada desvío relevante, llama `report_documentation_gap` con:\n" +
    "   - `description`: qué cambió y por qué el SDD queda desalineado (≥40 caracteres).\n" +
    "   - `evidence.reference`: cita §, T-, ruta `docs/sdd/` o `tasks.md`.\n" +
    "   - `evidence.codePaths`: archivos del diff que lo justifican.\n" +
    "   - `affectedArtifacts`: solo los que cambian (el **MDD se parchea siempre**).\n" +
    "5. Continúa con el código correcto; la reconciliación parcial se aplica sola o queda `PENDING_APPROVAL` en Workshop.\n" +
    "6. Confirma con `get_agent_session_log` / `get_change_log`.\n\n" +
    "## Mapa cambio → affectedArtifacts\n\n" +
    "| Cambio en código | affectedArtifacts típicos |\n" +
    "| --- | --- |\n" +
    "| Endpoint nuevo/borrado/renombrado | `apiContracts`, `logicFlows`, `tasks` |\n" +
    "| Entidad o modelo de datos | `blueprint`, `apiContracts` |\n" +
    "| Flujo o regla de negocio | `logicFlows`, `useCases`, `userStories` |\n" +
    "| Pantalla / UI | `uxUiGuide`, `pantallas` |\n" +
    "| Infra / deploy | `infra` |\n\n" +
    "## Notas\n\n" +
    "- **Agrupa** por desvío; no un gap por línea. Hay dedup (24 h) y rate limit (~10/h).\n" +
    "- Sin `DOC_GAP_AUTO_APPLY=1` el gap queda `PENDING_APPROVAL` (se aprueba en Workshop).\n" +
    "- Reserva **abrir etapa** para hitos reales (cambio de alcance, handoff), no para drift de documentación.\n"
  );
}
export function renderSkillFromCatalog(
  skill: SkillCatalogEntry,
  ctx: ReturnType<typeof buildArtifactTemplateContext>,
  folder: string,
): string {
  const prev = ctx.domainSkillFolder;
  if (skill.dynamicFolder) {
    ctx.domainSkillFolder = folder;
  }
  const content = skill.template(ctx);
  ctx.domainSkillFolder = prev;
  return content;
}
