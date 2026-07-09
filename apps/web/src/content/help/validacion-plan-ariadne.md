# Validación de plan (Ariadne — Gate 2)

The Forge puede auditar el **plan de cambio** (Tasks + archivos del flujo Modificación) contra el **grafo indexado en Ariadne** antes de implementar en Cursor.

## Cuándo se ejecuta

- Tras **regenerar Tasks** en un proyecto con **`theforgeProjectId`** (greenfield en prod o legacy).
- Manualmente: `POST /projects/:id/validate-change-plan` o botón **Validar plan** en el panel Estado (Workshop).

## Qué valida Ariadne (`validate_change_plan`)

| Check | Significado |
|-------|-------------|
| Archivos en grafo | Paths de Tasks existen en el índice (salvo `changeType: add`) |
| Símbolos | Componentes/funciones citados existen |
| Overlap Gate 1 | Coincidencia con `get_modification_plan` inicial |
| Cobertura tasks | Archivos en tasks ⊆ plan.files |
| API | Endpoints declarados vs grafo |

## Veredictos

- **APPROVED** — plan alineado con el código indexado.
- **APPROVED_WITH_WARNINGS** — viable; revisar warnings (p. ej. archivos sugeridos faltantes).
- **BLOCKED** — paths inventados o símbolos inválidos; corregir antes del handoff.

## Sin MCP Ariadne

El flujo SDD normal sigue; la validación de plan se omite (`skipped: no_codebase_link` o `ariadne_mcp_not_configured`).

## Cursor

Puedes llamar directamente la tool MCP **`validate_change_plan`** con el JSON `ChangePlan` (contrato v1 en Ariadne `docs/contracts/change-plan-validation-v1.md`).

Flujo recomendado:

1. `get_modification_plan` (Gate 1)
2. Generar / escribir tasks
3. `validate_change_plan` (Gate 2)
4. `validate_before_edit` por archivo al editar
