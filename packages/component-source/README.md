# @theforge/component-source

Contrato de **fuente de componentes** para TheForge: tipos, puerto (`ComponentSourcePort`), metadatos de plugin, `NullComponentSource` y utilidades MCP compartidas.

## Paquetes relacionados

| Paquete | Rol |
|---------|-----|
| `@theforge/component-source` | Contrato y tipos (este paquete) |
| `@theforge/component-source-mcp` | Cliente MCP Streamable HTTP genérico |

## Scripts

```bash
pnpm --filter @theforge/component-source build
pnpm --filter @theforge/component-source test
```

## Consumo

```json
"@theforge/component-source": "workspace:*"
```

Integración Nest: `apps/api/src/modules/component-source/`.
