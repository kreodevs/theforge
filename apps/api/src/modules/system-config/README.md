# system-config

Configuración de plataforma persistida en `AppConfig` y editable desde **Ajustes → Sistema** (solo `super_admin`).

## API

| Método | Ruta | Rol |
|--------|------|-----|
| `GET` | `/admin/system-config` | `super_admin` |
| `PATCH` | `/admin/system-config` | `super_admin` |

Prioridad en runtime: **BD → env → default** (`platform-config.runtime.ts`).

**Fuera de alcance:** claves API, modelos, embeddings y fallbacks de chat → **Ajustes → Proveedores** (BYOK/tenant).

**Migración Dokploy (v1.3.0+):** [`docs/DOKPLOY-MIGRACION-CONFIG-SISTEMA.md`](../../../docs/DOKPLOY-MIGRACION-CONFIG-SISTEMA.md)

## Archivos

- `system-config.service.ts` — CRUD allowlist + recarga de overrides en memoria.
- `system-config.controller.ts` — REST admin.
- `platform-config.runtime.ts` — resolución síncrona para el resto del API.
