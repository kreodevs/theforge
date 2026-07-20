# agent-governance/

Módulos extraídos de `agent-governance.util.ts` (Fase 6-4 — GOD-REFACTOR): plantillas y helpers por **tipo de artefacto**.

| Archivo | Rol |
| ------- | --- |
| **rules-artifacts.util.ts** | Regla canónica `theforge-doc-sync.mdc` y `renderRuleFromCatalog`. |
| **skills-artifacts.util.ts** | Skill `theforge-doc-sync/SKILL.md` y `renderSkillFromCatalog`. |
| **agents-artifacts.util.ts** | `AGENTS.md`, agentes Cursor dinámicos, commands, secciones de instalación. |
| **install-map.util.ts** | Tablas de path map e instalación multi-target. |
| **sdd-conflict.util.ts** | Bloques de conflictos SDD en overlays de gobernanza. |

El orquestador (`parseAgentGovernanceResponse`, `reconcileAgentGovernanceScaffold`, export ZIP, fallbacks LLM) permanece en **`../agent-governance.util.ts`** (~1 870 L tras 6-4).
