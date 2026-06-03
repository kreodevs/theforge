# @theforge/component-source-mcp

Adaptador **genérico** de `ComponentSourcePort` sobre MCP Streamable HTTP (URL + token opcional).

No depende del código de Orbita ni de ningún otro producto: solo requiere un endpoint MCP que exponga las tools del catálogo (`list_modules`, `resolve_components`, `get_design_system`, etc.).

## Uso

```typescript
import { createMcpPlugin } from "@theforge/component-source-mcp";

const plugin = createMcpPlugin(async (userId) => ({
  url: process.env.COMPONENT_MCP_URL!,
  token: process.env.COMPONENT_MCP_TOKEN,
}));
```

Registro en TheForge: `apps/api/src/modules/component-source/component-source.plugins.ts`.

El plugin id canónico es **`mcp`**. Configs guardadas con `pluginId: "orbita"` siguen resolviendo vía alias en el registry.

## Scripts

```bash
pnpm --filter @theforge/component-source-mcp build
pnpm --filter @theforge/component-source-mcp test
```
