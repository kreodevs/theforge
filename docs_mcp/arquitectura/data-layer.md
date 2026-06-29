---
id: data-layer
title: Data Layer (Web → API)
category: Arquitectura
last_updated: 2026-06-29
---

# Data Layer (Web → NestJS API)

> **AI Context Brief:** Cómo el frontend (React/Vite) llama al backend NestJS en The Forge; léelo antes de añadir llamadas a la API o tocar autenticación/streaming.

## 1. Uso Básico (Quick Start)

```typescript
// Cliente canónico del Workshop: fetch nativo + JWT desde localStorage.
import { apiFetch, API_BASE } from "@/utils/apiClient";

const res = await apiFetch(`${API_BASE}/projects/${id}`);
if (!res.ok) throw new Error("Proyecto no encontrado");
const project = await res.json();

// Wrapper fino para APIs de settings:
import { api } from "@/lib/api";
const catalog = await api.get("/user-providers/catalog");
```

## 2. API & Contrato de Tipos (Specs)

| Pieza                              | Símbolos clave                                   | Rol                                                        |
| ---------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `apps/web/src/utils/apiClient.ts`  | `API_BASE`, `apiFetch`, `fetchWithRetry`, `getAccessToken`, `setAccessToken` | Cliente canónico del Workshop (REST + streams NDJSON).     |
| `apps/web/src/lib/api.ts`          | `api` (`get/post/put/delete`)                    | Wrapper fino para APIs de settings/providers.              |
| `apps/web/src/store/workshopStore.ts` | `useWorkshopStore`, `fetchProject`, `sendMessage` | Orquesta toda la I/O del Workshop.                      |
| `apps/web/vite.config.ts`          | dev proxy `/api` → `http://localhost:3000`       | En dev reescribe y quita el prefijo `/api`.                |

- **Base URL:** `import.meta.env.VITE_API_URL ?? "/api"` (en `apiClient.ts`).
- **Auth:** JWT en `localStorage` (`theforge_access_token`) → header `Authorization: Bearer …`. Un 401 limpia el token y dispara el evento `theforge:auth-expired`.
- **Streams IA:** `POST ${API_BASE}/ai-analysis/mdd/stream/manager` (y `/resume`, `/stream`), parseados como **NDJSON** en `workshopStore`.

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** No hay axios ni TanStack Query ni cliente generado: usa **`apiFetch`** (Workshop) o **`api`** (settings). No introduzcas otra capa HTTP.
- **Regla 2:** No leas el token a mano de `localStorage`; usa `getAccessToken()` para mantener el manejo de expiración.
- **Regla 3:** Para respuestas en streaming usa el parser NDJSON existente en `workshopStore`, no acumules el body completo.
- **Regla 4:** Ojo: `API_BASE` es `"/api"` en `apiClient.ts` pero `""` en `lib/api.ts`; respeta el cliente correcto por dominio.
