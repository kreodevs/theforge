# utils — export SDD

- **`downloadSpecKitBundle.ts`:** ZIP con layout [github/spec-kit](https://github.com/github/spec-kit) (`.specify/memory/constitution.md`, `specs/{NNN}-{slug}/`). `downloadSpecKitBundleFromApi` usa `GET /projects/:id/export/sdd-bundle`.
- **`downloadRepoHandoff.ts`:** handoff completo (spec-kit raíz + `agent-governance/`) vía `GET /projects/:id/export/repo-handoff`.
- **`downloadAgentGovernanceZip.ts`:** opcionalmente incluye el mismo bundle en la raíz del ZIP (`-implement-handoff.zip`) para handoff a agentes.
