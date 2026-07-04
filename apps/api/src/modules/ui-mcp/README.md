# `ui-mcp` — MCP gráfico (componentes UI)

Integración con **MCPs externos de componentes UI**. The Forge define un contrato
(`@theforge/shared-types/ui-mcp-contract`) y usa el MCP **compatible y activo** para sustituir
componentes genéricos por reales en las secciones UI/UX del MDD/Blueprint, inferir el design system
y generar el deliverable **«Pantallas / UI Screens Spec»** (texto, sin TSX).

## Contrato de compatibilidad

Un MCP es **compatible** cuando:

1. **Nativo:** `tools/list` expone `describe_capabilities`, `list_components`, `resolve_component` y
   `describe_capabilities` declara un `contractVersion` reconocido, **o**
2. **Adaptador genérico:** no cumple el contrato nativo pero `tools/list` coincide con un adaptador
   registrado (p. ej. **Kreo UI MCP** → `resolve_component_for_entity` + `get_ui_component_catalog`).

Tools opcionales del contrato nativo: `list_screens`, `get_design_tokens`.

## Piezas

| Archivo | Rol |
|---------|-----|
| `adapters/kreo-ui-mcp.adapter.ts` | Shim Kreo → contrato The Forge (resolve, catálogo, tokens DTCG). |
| `adapters/ui-mcp-adapter.registry.ts` | Matching de adaptadores por `tools/list`. |
| `ui-mcp.service.ts` | CRUD de `UiMcpInstance` (team-wide), activación exclusiva, detección de compatibilidad (persistida) y token cifrado con `TokenCryptoService`. Expone `getActiveCompatibleConnection` / `hasActiveCompatible` / `getActiveCompatibleMeta`. |
| `ui-mcp-client.service.ts` | Cliente de alto nivel del MCP activo+compatible. Tools parseados con Zod; cualquier error → `null` para fallback heurístico. |
| `ui-mcp-transport.util.ts` | Transporte JSON-RPC sobre HTTP/SSE con URL/token explícitos (evita el bug de `baseUrl` de `TheForgeService`). |
| `ui-mcp.controller.ts` | REST `/api/ui-mcp` (list/create/update/delete/activate/detect/test/active). Solo admin/super_admin para mutaciones. |
| `ui-component-resolver.ts` | `UiComponentResolver` pluggable: `HeuristicUiComponentResolver` (comportamiento previo) y `McpUiComponentResolver` (MCP con **fallback por-entidad**). |
| `ui-screens.service.ts` + `ui-screens.controller.ts` | Deliverable «Pantallas»: `syncUiScreens` (cruce §3 + HU, `list_screens`, respaldo `resolve_component`) → `POST /api/projects/:id/ui-screens/sync`; persiste en `Project.uiScreensContent`. Lee MDD del stage activo y `userStoriesContent`. |
| `ui-screens-mdd.util.ts` | Extracción tolerante de entidades §3 (`CREATE TABLE`) con headings pegados o SQL sin fence ```sql. |
| `ui-screens-plan.util.ts` | Cruce §3 + Historias de Usuario → plan de pantallas (nombre, propósito, `uiHint`, clasificación). |
| `ui-screens-markdown.util.ts` | Ensambla la spec de pantallas en markdown de texto (sin TSX ni preview). |
| `ui-design-system-section.util.ts` | Construye la sección de design system inferido del MCP para la Guía UX/UI. |

## Consumo

- **MDD UI/UX Design Intent** — `mdd-enrich-uiux-intent` recibe el resolver (async) vía el chokepoint `prepareMddForOutput`.
- **Blueprint §8** — `enrichBlueprintWithUiDesignSystem` recibe el resolver (async) desde `ProjectsService`.
- **Guía UX/UI** — `ProjectsService.generateUxUiGuide` anexa la sección de design system del MCP si hay uno compatible activo.
- **Export / handoff** — `uiScreensContent` se incluye como `{featureDir}/pantallas.md` (spec-kit) y espejo `docs/sdd/pantallas.md` en ZIP handoff, gobernanza y MCP `get_project_deliverables`. Rule/skill `ui-pantallas` en gobernanza IA cuando hay superficie UI.

Sin MCP compatible activo, **todo cae al comportamiento heurístico/Ariadne** actual.
