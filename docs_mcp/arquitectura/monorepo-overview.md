---
id: monorepo-overview
title: Visión general del monorepo
category: Arquitectura
last_updated: 2026-06-29
---

# Visión general del monorepo (The Forge)

> **AI Context Brief:** Mapa de paquetes y apps del monorepo pnpm/turbo de The Forge; léelo primero para ubicar dónde vive el backend, la web, los tipos compartidos y los servidores MCP.

## 1. Uso Básico (Quick Start)

```bash
# Gestor: pnpm 9 (workspaces: apps/*, packages/*). Orquestador: Turbo. Node >= 20.
pnpm install
pnpm build                 # turbo run build (dependsOn ^build)
pnpm --filter @theforge/api dev
pnpm --filter @theforge/web dev
pnpm --filter @theforge/docs-mcp-server build
```

## 2. API & Contrato de Tipos (Specs)

| Paquete                       | Rol                                                                    |
| ----------------------------- | ---------------------------------------------------------------------- |
| `@theforge/api`               | Backend NestJS: proyectos, IA, flujo legacy, cliente MCP a Ariadne.    |
| `@theforge/web`               | SPA React 18 + Vite (UI Workshop).                                     |
| `@theforge/mcp-server`        | Servidor MCP que expone la API REST como tools (JSON-RPC manual).      |
| `@theforge/docs-mcp-server`   | Servidor MCP de documentación (SDK oficial; sirve `docs_mcp/`).        |
| `@theforge/database`          | Esquema Prisma, cliente y migraciones.                                 |
| `@theforge/shared-types`      | DTOs Zod, utilidades de markdown/mermaid.                              |
| `@theforge/business-rules`    | Lógica de negocio compartida (api + web).                              |
| `@theforge/config`            | `tsconfig.base.json`, ESLint, Tailwind (sin runtime).                  |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** Hay **dos capas MCP distintas**: `@theforge/mcp-server` (servidor que expone la API) y `apps/api/src/modules/theforge` (cliente que llama a Ariadne externa). No las confundas.
- **Regla 2:** Los paquetes internos se referencian con `workspace:*`. Base TS compartida: `target ES2022`, `module NodeNext`, `strict: true`.
- **Regla 3:** Documentos vivos de producto: `blueprint.md` y `mdd.md` en la raíz (no bajo `docs/`).
- **Regla 4:** Código, comentarios y JSDoc en inglés; respuestas a humanos en el idioma del usuario.
