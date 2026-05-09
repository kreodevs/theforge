# constants

- **`legacy-workshop-loading-steps.ts`** — Textos que rotan cada ~6s en **WorkshopView** (panel central) y **ChatContainer** (columna chat) mientras `loadingReason` es `legacy-codebase-doc`, `legacy-mdd`, `legacy-deliverables`, `legacy-brd-suggest`, `legacy-as-is`, o **`brd-from-dbga`** (usa **`BRD_TOBE_FROM_DBGA_STEPS`** — nombre pendiente de renombrar). No reflejan eventos reales del API (la generación es una petición larga); sirven de feedback de UX.
