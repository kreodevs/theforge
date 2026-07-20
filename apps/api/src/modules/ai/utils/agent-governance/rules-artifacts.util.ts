import type { RuleCatalogEntry } from "../agent-governance-catalog.js";
import type { buildArtifactTemplateContext } from "../suggest-agent-governance-artifacts.js";

export function defaultTheforgeDocSyncRule(): string {
  return (
    "---\n" +
    "description: Sincronizar la documentación SDD con el código vía MCP The Forge (drift greenfield / pre-producción)\n" +
    "alwaysApply: true\n" +
    "---\n\n" +
    "# The Forge doc sync\n\n" +
    "El código es la fuente de verdad; el SDD (MDD, Blueprint, Tasks, contratos, flujos…) debe reflejarlo. En greenfield pre-producción los cambios por faltantes de documentación o funcionalidad nueva se reconcilian con **`report_documentation_gap`**, **no** abriendo una etapa nueva por cada desvío.\n\n" +
    "## Cuándo reportar\n\n" +
    "- **Inline:** durante la implementación descubres que un entregable SDD es **incorrecto o incompleto**.\n" +
    "- **Fin de sesión / pre-commit:** antes de cerrar la tarea o commitear, revisa el `git diff` contra el SDD; si el código introdujo/renombró/eliminó algo no contemplado (endpoint, entidad, flujo, tarea), repórtalo.\n\n" +
    "## Cómo\n\n" +
    "1. **No** parches la doc en silencio ni abras una etapa nueva por esto.\n" +
    "2. Lee `.theforge-project.json` (`projectId`, `stageId`).\n" +
    "3. Llama MCP `report_documentation_gap`: `description` ≥40 chars, `evidence.reference` (§, T-, `docs/sdd/`, `tasks.md`), `affectedArtifacts` acotados. El **MDD se parchea siempre**.\n" +
    "4. Continúa con el código correcto; la reconciliación parcial se aplica sola (o queda `PENDING_APPROVAL` en Workshop).\n" +
    "5. Detalle, pasos del diff y mapeo cambio→artefactos: skill `theforge-doc-sync`.\n"
  );
}
export function renderRuleFromCatalog(
  rule: RuleCatalogEntry,
  ctx: ReturnType<typeof buildArtifactTemplateContext>,
): string {
  return rule.template(ctx);
}
