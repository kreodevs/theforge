# Web components — spec-kit alignment

| Component | Role |
|-----------|------|
| `LlevarAlRepoWizardDialog.tsx` | Post-VERDE wizard: download repo handoff ZIP (spec-kit + agent governance) |
| `AnalyzeDashboard.tsx` | Cross-artifact SDD analyze (`GET /projects/:id/analyze`) |
| `DocumentClarificationSection.tsx` | Banner (si hay marcadores) + modal para responder `[NEEDS CLARIFICATION]` existentes y regenerar. |
| `ResolveClarificationsPanel.tsx` | Diálogo de respuestas (`POST /projects/:id/resolve-clarifications`). |
| `ClarifyDocumentPanel.tsx` | (Legacy) Marca nuevas ambigüedades vía IA (`POST /projects/:id/clarify-document`). |
| `ClarifySpecPanel.tsx` | Wrapper de `ResolveClarificationsPanel` para Spec (compat). |
| `WorkshopExportSddButton.tsx` | Quick spec-kit-only export |

**API:** `POST /projects/:id/clarify-document` · `POST /projects/:id/resolve-clarifications` (integra respuestas y regenera sin marcadores). Legacy: `POST /projects/:id/clarify-spec`.
