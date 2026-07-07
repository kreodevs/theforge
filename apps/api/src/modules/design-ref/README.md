# Design references (Guía UX/UI)

Biblioteca de sistemas visuales para inyectar tokens en la generación del **Design System** (`uxUiGuideContent`).

## Fuentes (P0 + P1)

| Fuente | Archivo | Estado |
|--------|---------|--------|
| Builtin (54 refs) | `data/design-references.ts` | ✅ |
| [design-extractor.com/gallery](https://www.design-extractor.com/gallery) (26 sitios) | `data/design-extractor-gallery.ts` + imports | ✅ P1 congelado |
| Catálogo unificado | `data/design-catalog.ts` | merge + auto-match |
| Slugs URL ↔ catálogo | `data/design-extractor-slugs.ts` | alias (`linear-app` → `linear-638bvy`, etc.) |
| DESIGN.md en runtime | `data/design-extractor-imports/*.md` | **local only** (sin scraping en prod) |
| Atribución | `design-ref-inspiration.util.ts` + `design-ref-attribution.util.ts` | API + pie del markdown generado |

## API

- `GET /api/design-refs` — lista (`hasDesignMdImport`, `inspirationSource`, `inspirationUrl`, `attributionNote`)
- `GET /api/design-refs/:slug` — detalle + campos de inspiración
- `POST /api/design-refs/auto-match` — `{ mddContext }` → top matches

## Proyecto

Campo Prisma `Project.uxGuideDesignRef`:

- `null` → en generación se persiste `"auto"` y se resuelve por dominio del MDD
- `"auto"` → `matchDesignByDomainMerged(mdd)`
- `"stripe"`, `"klarna"`, … → referencia explícita

Workshop: `DesignRefSelector` en pestaña **Design System** (`UxUiGuidePanel`).

## Biblioteca congelada (sin scraping en prod)

The Forge **no llama** a design-extractor en runtime. Los 26 `DESIGN.md` viven en repo y se copian al build (`nest-cli.json` assets).

Sync **solo dev/manual** (no CI):

```bash
node scripts/sync-design-extractor-gallery.mjs
```

## Atribución / “inspirado en”

- **UI:** copy en `DesignRefSelector` + `attributionNote` en listado API.
- **Output:** `appendUxGuideDesignAttribution()` añade `## Atribución` al final de `uxUiGuideContent` cuando la ref usa design-extractor.
- **Legal:** ver `NOTICE` en la raíz del monorepo.

## Resolución en generación

| Modo | LLM | Comportamiento |
|------|-----|----------------|
| Ref explícita o auto-match con slug | **No** (fast path) | `composeDesignSystemFromRef()` → `POST /projects/:id/compose-ux-guide-from-ref` |
| Sin match / legacy con codebase AS-IS | Sí | Chat stream / `generateUxUiGuide` como antes |

`resolveUxGuideDesignRef()` → `composeDesignSystemFromRef()` (import DESIGN.md o YAML desde catálogo) → `appendUxGuideDesignAttribution()`.

Flujo LLM (fallback): `formatDesignReferencePrompt()` → `uxGuideLlmOptions()` → system prompt.
