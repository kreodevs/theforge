# Diagramas

Diagramas de arquitectura y flujos del proyecto (Excalidraw + checkpoints MCP).

## Archivos

| Archivo | Uso |
|---------|-----|
| `the-forge-arquitectura-dokploy.excalidraw` | Abrir en [Excalidraw](https://excalidraw.com) o VS Code (extensión Excalidraw) |
| `the-forge-arquitectura-dokploy.checkpoint.json` | Elementos para MCP `create_view` / `restoreCheckpoint` (`0ad801e2600c43babd`) |
| `scripts/build-excalidraw-export.mjs` | Regenera `.excalidraw` desde un `.checkpoint.json` |

## Arquitectura Dokploy (2026-05-26)

Capas:

1. **Cliente** — Usuario → Traefik → `theforge-web` (React + Nginx, `/`)
2. **Aplicación** — `theforge-api` (NestJS) + IA/MDD (LangGraph, BYOK)
3. **Datos** — PostgreSQL, Redis (BullMQ), FalkorDB (grafo SDD)
4. **Integraciones** — `theforge-mcp`, Ariadne MCP, proveedores LLM

Fuente de verdad despliegue: `docker-compose.yml`, `blueprint.md` §7.

### Editar en Cursor (MCP)

```json
[{"type":"restoreCheckpoint","id":"0ad801e2600c43babd"}, ...]
```

Skill: `.cursor/skills/excalidraw/SKILL.md`.

### Regenerar `.excalidraw`

```bash
node docs/diagramas/scripts/build-excalidraw-export.mjs \
  docs/diagramas/the-forge-arquitectura-dokploy.checkpoint.json
```
