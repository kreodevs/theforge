# Plan: validación de componentes UI vía MCP corporativo (`@imj_media/ui`)

> **Estado: PROPUESTA / GAP — NO implementado en The Forge (junio 2026).**
> Este documento registra un contrato externo (proveniente de una spec de producto OBP/ERP) y lo contrasta con lo que The Forge tiene hoy. No describe código existente en este repo. No fabricar endpoints ni dependencias a partir de aquí sin implementación real.

## 1. Contrato externo (tal como llegó)

- **Librerías de UI:** `@imj_media/orbit-tokens` (sistema de tokens de diseño) y `@imj_media/ui` (componentes UI reutilizables). `@imj_media/ui` depende de `@imj_media/orbit-tokens`. Base visual y componentes atómicos para los módulos **07** y **08**.
- **Validación de componentes vía MCP:** todos los componentes de `@imj_media/ui` se validan contra el **Model Context Protocol** en `https://componentes.obp.mx/mcp` **antes de renderizarse**.
  - El frontend llama a `POST /api/v1/validate-component` en el backend, que actúa de **proxy** hacia el MCP externo.
  - Ante error (componente no permitido o fallo de comunicación): **fallback controlado** en el frontend + **registro del incidente** en el sistema de monitoreo.
  - Aplica en **todos** los módulos (07 y 08) para garantizar uso exclusivo de componentes aprobados por el repositorio corporativo.

> Contexto de módulos: la numeración 07/08 aparece en el discovery OBP (`docs/recovery/dbga-obp-recovery-*.md`, módulo 07 = *Listas de Márgenes Dinámicos*). El módulo 08 no está en ese discovery. Este contrato pertenece a la **app OBP/ERP**, no a The Forge.

## 2. Qué tiene The Forge hoy (y por qué no es lo mismo)

Búsqueda en el repo: **0 referencias** a `@imj_media/ui`, `@imj_media/orbit-tokens`, `componentes.obp.mx`, `validate-component`.

| Contrato externo | Equivalente más cercano en The Forge | Diferencia clave |
|------------------|--------------------------------------|------------------|
| `@imj_media/orbit-tokens` + `@imj_media/ui` | Tab **Guía UX/UI** → `design-system.md`; `DesignMdPreview`, `DesignSystemUIKit`, `design-system-utils.ts` | Tokens/UI **del proyecto en diseño**, no el paquete corporativo IMJ |
| Validación MCP **antes de renderizar** (allowlist de componentes en runtime) | `validate_before_edit` (MCP **Ariadne**, grafo de código) | Valida **impacto/contrato al editar código**, no una allowlist de componentes UI en runtime |
| Props reales de componentes desde MCP corporativo | `get_contract_specs` (MCP Ariadne, `TheForgeService`) | Lee props del **repo indexado en Ariadne**, no de `componentes.obp.mx` |
| Tokens desde paquete `orbit-tokens` | `extract_design_tokens` (MCP Ariadne, flujo legacy UX/UI) | Extrae Tailwind/CSS **del codebase**, no del paquete publicado |
| `POST /api/v1/validate-component` (proxy a MCP) | — | No existe endpoint ni proxy de validación de componentes UI |
| "MCP de componentes UI puede instanciar la interfaz" | Frase **genérica** en `apps/api/src/modules/ai-analysis/utils/mdd-enrich-uiux-intent.ts` y mapeo entidad→componente en `apps/api/src/modules/engine/blueprint-enrich-ui-system.ts` | Intención de spec **generada** (sin URL, sin proxy, sin runtime) |

**Conclusión:** The Forge **documenta y genera** guías UX/UI y consulta Ariadne por contratos/tokens del código; **no implementa** el pipeline `validate-component → render con fallback` contra un MCP corporativo de componentes.

## 3. Dónde encajaría si se implementara en The Forge

Solo como referencia de diseño (no comprometido):

- **Spec / Blueprint del proyecto OBP** (no en el código de The Forge): el contrato debería vivir en el MDD/Spec del proyecto que consume `@imj_media/ui`, idealmente en §3 (contratos/datos) y en la **Guía UX/UI** (`design-system.md`) de ese proyecto.
- **Si The Forge tuviera que enseñarlo a agentes:** un bloque en la Guía UX/UI o en Agent Governance que obligue a usar solo componentes aprobados, con el paso de validación `POST /api/v1/validate-component` documentado como contrato de API en la cascada (`api-contracts.md`).
- **No** confundir con `validate_before_edit` (Ariadne) ni con `extract_design_tokens`: son herramientas de **análisis de código indexado**, no de **gobernanza de runtime UI**.

## 4. Riesgos / notas

- Acoplar render a un MCP externo introduce un **punto de fallo en runtime**; el "fallback controlado" debe estar definido (qué se renderiza, qué se loguea, y degradación sin bloquear la vista).
- Versionado: `@imj_media/ui` ↔ `@imj_media/orbit-tokens` ↔ catálogo del MCP deben mantener coherencia de versiones (drift = componentes "no permitidos" falsos positivos).
- En el ecosistema IMJ, el consumo de `@imj_media/ui` debe ser por **registry/semver** (ver reglas del repo OBP), no por enlace local.

## 5. Relacionado

- Discovery OBP (módulo 07): `docs/recovery/dbga-obp-recovery-2026-05-26.md`
- Herramientas MCP Ariadne (qué sí existe): `docs/notebooklm/integracion-theforge/HERRAMIENTAS-MCP-THEFORGE.md`
- Guía UX/UI en la cascada: `docs/THEFORGE-DOC-CONSUMPTION-GUIDE.md` (`design-system.md`)
