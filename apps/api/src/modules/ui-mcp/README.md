# `ui-mcp` — MCP gráfico (componentes UI)

Integración con **MCPs externos de componentes UI**. The Forge define un contrato
(`@theforge/shared-types/ui-mcp-contract`) y usa el MCP **compatible y activo** para sustituir
componentes genéricos por reales en las secciones UI/UX del MDD/Blueprint, inferir el design system
y generar el deliverable **«Pantallas / UI Screens Spec»** (texto, sin TSX).

## Contrato de compatibilidad

Un MCP es **compatible** cuando `tools/list` expone los tools obligatorios y `describe_capabilities`
declara un `contractVersion` reconocido:

- **Obligatorios:** `describe_capabilities`, `list_components`, `resolve_component`.
- **Opcionales:** `list_screens` (deliverable Pantallas), `get_design_tokens` (design system).

## Piezas

| Archivo | Rol |
|---------|-----|
| `ui-mcp.service.ts` | CRUD de `UiMcpInstance` (team-wide), activación exclusiva, detección de compatibilidad (persistida) y token cifrado con `TokenCryptoService`. Expone `getActiveCompatibleConnection` / `hasActiveCompatible` / `getActiveCompatibleMeta`. |
| `ui-mcp-client.service.ts` | Cliente de alto nivel del MCP activo+compatible. Tools parseados con Zod; cualquier error → `null` para fallback heurístico. |
| `ui-mcp-transport.util.ts` | Transporte JSON-RPC sobre HTTP/SSE con URL/token explícitos (evita el bug de `baseUrl` de `TheForgeService`). |
| `ui-mcp.controller.ts` | REST `/api/ui-mcp` (list/create/update/delete/activate/detect/test/active). Solo admin/super_admin para mutaciones. |
| `ui-component-resolver.ts` | `UiComponentResolver` pluggable: `HeuristicUiComponentResolver` (comportamiento previo) y `McpUiComponentResolver` (MCP con **fallback por-entidad**). |
| `ui-screens.service.ts` + `ui-screens.controller.ts` | Deliverable «Pantallas»: `syncUiScreens` (usa `list_screens`, respaldo `resolve_component`) → `POST /api/projects/:id/ui-screens/sync`; persiste en `Project.uiScreensContent`. |
| `ui-screens-markdown.util.ts` | Ensambla la spec de pantallas en markdown de texto (sin TSX ni preview). |
| `ui-design-system-section.util.ts` | Construye la sección de design system inferido del MCP para la Guía UX/UI. |

## Consumo

- **MDD UI/UX Design Intent** — `mdd-enrich-uiux-intent` recibe el resolver (async) vía el chokepoint `prepareMddForOutput`.
- **Blueprint §8** — `enrichBlueprintWithUiDesignSystem` recibe el resolver (async) desde `ProjectsService`.
- **Guía UX/UI** — `ProjectsService.generateUxUiGuide` anexa la sección de design system del MCP si hay uno compatible activo.

Sin MCP compatible activo, **todo cae al comportamiento heurístico/Ariadne** actual.
