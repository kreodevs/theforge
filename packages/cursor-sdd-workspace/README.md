# Cursor SDD — workspace de demo (The Forge monorepo)

Artefactos SDD de **ejemplo** (`WORKFLOW.yaml`, `paso0/`, `docs/sdd/`, `deliverables/`) para probar el flujo Paso 0 → Spec → MDD → gates **sin API** de The Forge.

El **plugin Cursor** (comandos `/forge-*`, skills, prompts, scaffold) vive en un repo aparte:

**https://github.com/OscarRubioSevilla/theforge-plugin-cursor**

## Instalar el plugin

```bash
git clone https://github.com/OscarRubioSevilla/theforge-plugin-cursor.git
mkdir -p ~/.cursor/plugins/local
ln -sf "$(pwd)/theforge-plugin-cursor" ~/.cursor/plugins/local/forge-sdd
```

Reload Window en Cursor. Usa `/forge-paso0`, `/forge-mdd-pipeline`, etc.

## Nuevo proyecto (no este demo)

Con el plugin instalado:

```bash
cd theforge-plugin-cursor
npm run init-forge -- --no-cursor --target ~/proyectos/mi-app --name "Mi App" --idea "…"
```

O en chat: `/init-forge name="…" idea="…"`.

## Trabajar en este demo

Abre `packages/cursor-sdd-workspace` (o el monorepo entero) y ejecuta el flujo sobre los archivos ya presentes en `docs/sdd/` y `paso0/`.

Panel UI (si tu proyecto tiene `ui/` copiado por init-forge):

```bash
node scripts/serve-sdd-ui.mjs
```

En este paquete de demo el UI vive en el plugin; clónalo o usa un proyecto scaffolded.

## Mantenimiento: sincronizar plugin desde `apps/api`

Cuando cambien prompts MDD en el API:

```bash
cd packages/cursor-sdd-workspace
npm run sync:plugin
```

Por defecto escribe en `../theforge-plugin-cursor` (hermano del monorepo) o en `FORGE_PLUGIN_ROOT`.

Luego commitea y pushea en el repo del plugin.

## Qué queda en este directorio

| Contenido | Propósito |
|-----------|-----------|
| `WORKFLOW.yaml`, `paso0/`, `docs/sdd/`, `deliverables/` | Demo / trabajo local |
| `scripts/vendor-prompts.mjs`, `generate-forge-commands.mjs`, `forge-plugin-path.mjs` | Sync hacia el plugin |
| `templates/` | Referencia (copias viven en el plugin) |

No dupliques `commands/`, `skills/`, `rules/` ni `prompts/` aquí — están en el plugin.
