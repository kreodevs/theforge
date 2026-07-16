# Web components — spec-kit alignment

| Component | Role |
|-----------|------|
| `LlevarAlRepoWizardDialog.tsx` | Post-VERDE wizard: download repo handoff ZIP (spec-kit + agent governance) |
| `AnalyzeDashboard.tsx` | Cross-artifact SDD analyze (`GET /projects/:id/analyze`) |
| `DocumentClarificationSection.tsx` | Banner + formulario de respuestas para `[NEEDS CLARIFICATION]` en cualquier entregable. Integrado en `StandardDocPanel` y pestañas MDD / Fase 0 / BRD. |
| `ClarifyDocumentPanel.tsx` | Diálogo «Aclarar» (`POST /projects/:id/clarify-document`) — detecta ambigüedades y marca marcadores. |
| `ClarifySpecPanel.tsx` | Wrapper de `ClarifyDocumentPanel` para Spec (toolbar / compat). |
| `WorkshopExportSddButton.tsx` | Quick spec-kit-only export |

**API:** `POST /projects/:id/clarify-document` · `POST /projects/:id/resolve-clarifications` (integra respuestas y regenera sin marcadores). Legacy: `POST /projects/:id/clarify-spec`.
