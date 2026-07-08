# utils — export SDD

- **`loadJsZip.ts`:** carga dinámica de `jszip` (no va en el bundle inicial).
- **`downloadSpecKitBundle.ts`:** ZIP con layout [github/spec-kit](https://github.com/github/spec-kit) (`.specify/memory/constitution.md`, `specs/{NNN}-{slug}/`). `downloadSpecKitBundleFromApi` usa `GET /projects/:id/export/sdd-bundle`.
- **`downloadRepoHandoff.ts`:** handoff completo (spec-kit + gobernanza aplanada en raíz del ZIP) vía `GET /projects/:id/export/repo-handoff`. `downloadWorkshopProjectZip` es el botón del header Workshop: handoff si hay gobernanza; si no, `-documentos.zip` plano.
- **`downloadDocumentsZip.ts`:** solo `.md` sueltos en la raíz (fallback sin gobernanza); `pantallas.md` sin anexo JSON embebido + `ui-project.json` aparte cuando exista.
- **`downloadAgentGovernanceZip.ts`:** gobernanza + spec-kit client-side (`-implement-handoff.zip`); fallback si falla repo-handoff API.
