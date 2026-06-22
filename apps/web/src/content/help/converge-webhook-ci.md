# Webhook converge (CI brownfield)

En proyectos **legacy / brownfield**, el código real y la especificación (MDD, Spec, `tasks.md`) se desincronizan con el tiempo. **Converge** compara el plan abierto, los gaps de conformidad y evidencia del codebase (vía **Ariadne**) para proponer nuevas tareas en la sección `## Tareas pendientes (converge)`.

El **webhook converge** automatiza ese ciclo desde **CI** u orquestadores externos: un `POST` dispara converge y, opcionalmente, reenvía el resultado a una URL que tú configuras.

> **En una frase:** después de cada merge (o en cron), el pipeline llama a The Forge → converge detecta drift → tu webhook recibe el informe y decide si persistir, notificar o crear issues.

---

## ¿Cuándo usarlo?

| Situación | ¿Usar webhook converge? |
|-----------|---------------------------|
| Proyecto **legacy** con `tasks.md` y repo indexado en Ariadne | **Sí** — drift post-merge |
| Proyecto **nuevo** sin código en producción | **No** — converge no aporta; usa el flujo SDD normal |
| Solo quieres probar converge una vez | **No** — usa el botón **Converge** en la pestaña Tasks del Workshop o `POST /converge` |
| Quieres **automatizar** drift + notificación / persistencia | **Sí** |
| El grafo Ariadne está **obsoleto** (push sin reindex) | **Primero** reindexa en Ariadne; converge sin grafo fresco da evidencia vacía |

---

## Qué hace converge (resumen técnico)

1. Lee `tasks.md` de la etapa (o proyecto) y filtra tareas abiertas `- [ ]`.
2. Calcula **gaps de conformidad** (MDD vs entregables).
3. Si hay `theforgeProjectId` y MCP Ariadne configurado, consulta el codebase con las tareas abiertas (`ask_codebase`).
4. Un prompt especializado genera/actualiza `## Tareas pendientes (converge)`.
5. Con `persist: true`, guarda el markdown en `tasksContent` (etapa o proyecto).

**Requisito:** debe existir `tasks.md` generado. Sin tasks, la API responde error.

---

## Dos endpoints: manual vs CI

| Endpoint | Webhook saliente | Uso típico |
|----------|------------------|------------|
| `POST /projects/:id/converge` | No | Workshop, prueba manual, scripts internos |
| `POST /projects/:id/converge/trigger` | **Sí** (si hay URL configurada) | GitHub Actions, n8n, cron, post-merge |

Query opcional en ambos: `?stageId=<uuid>` para converge sobre una etapa concreta (brownfield multi-etapa).

---

## Configuración

### 1. En el Workshop (por proyecto)

1. Abrí el proyecto **legacy** en el Workshop.
2. Pestaña **Integración** → tarjeta **Webhook converge (CI)**.
3. Pegá la URL destino (n8n, Slack incoming webhook, servicio interno, etc.).
4. **Guardar webhook**.

Esa URL se guarda en `Project.convergeWebhookUrl`. Tiene **prioridad sobre** la variable de entorno global del servidor.

### 2. Variable de entorno (fallback global)

En el deploy de la API The Forge:

```bash
CONVERGE_WEBHOOK_URL=https://hooks.example.com/theforge-converge-default
```

Se usa solo si el proyecto **no** tiene URL propia y el body del trigger **no** trae `webhookUrl`.

### 3. Prioridad de URL (de mayor a menor)

1. `webhookUrl` en el body del `POST /converge/trigger`
2. `Project.convergeWebhookUrl` (UI Integración)
3. `CONVERGE_WEBHOOK_URL` (env del servidor)

### 4. Firma HMAC (opcional, solo API hoy)

Campo `Project.convergeWebhookSecret` (mín. 8 caracteres). Si está definido, The Forge firma el body JSON:

```http
X-TheForge-Signature: sha256=<hex>
```

Verificá con el mismo secret en el receptor. **No** hay campo en la UI todavía; se configura vía `PATCH /projects/:id` o administración de BD.

### 5. Autenticación hacia The Forge

Los endpoints requieren **JWT** (Bearer), igual que el resto de la API. En CI usá un token de servicio o el flujo de login que ya tengáis automatizado.

---

## Cadena brownfield recomendada: Ariadne + The Forge

Converge **depende** de un grafo Ariadne actualizado. El flujo correcto en brownfield es:

```text
push/merge → Ariadne reindexa el repo → The Forge converge/trigger → webhook downstream
```

### Opción A — Automático en Ariadne (recomendado)

En **Ariadne → Repos → Editar repositorio → Brownfield converge (The Forge)**:

| Campo | Valor típico |
|-------|----------------|
| The Forge project ID | UUID del proyecto legacy en Workshop |
| Stage ID | UUID de etapa brownfield activa (opcional) |
| Cuándo disparar | `incremental` (post-push) o `all` |
| Persistir tareas | según política del equipo |

En el **ingest** de Ariadne:

```bash
THEFORGE_API_URL=https://api.theforge.example
THEFORGE_SERVICE_JWT=eyJ...   # token largo plazo; o JWT por repo en la UI
```

Tras cada sync exitoso, Ariadne llama `POST /projects/:id/converge/trigger` **sin** pipeline externo. Ver `docs/notebooklm/BROWNFIELD-CONVERGE-THEFORGE.md` en el monorepo Ariadne.

### Opción B — Orquestación manual (CI / n8n)

| Paso | Servicio | Acción |
|------|----------|--------|
| 1 | **Ariadne** | Webhook Bitbucket/GitHub o `POST /repositories/:repoId/resync` |
| 2 | **Esperar** | Job de sync completado |
| 3 | **The Forge** | `POST /projects/:projectId/converge/trigger` |
| 4 | **Tu webhook** | Slack, issues, etc. |

Útil si no tenés Ariadne ingest desplegado con `THEFORGE_*` o querés lógica custom entre pasos.

---

## Llamada desde CI (ejemplos)

### cURL mínimo

```bash
curl -sS -X POST \
  "https://api.theforge.example/projects/${PROJECT_ID}/converge/trigger" \
  -H "Authorization: Bearer ${THEFORGE_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"persist": false}'
```

Con etapa y persistencia:

```bash
curl -sS -X POST \
  "https://api.theforge.example/projects/${PROJECT_ID}/converge/trigger?stageId=${STAGE_ID}" \
  -H "Authorization: Bearer ${THEFORGE_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"persist": true}'
```

Override puntual de webhook (ignora URL del proyecto):

```bash
-d '{"persist": false, "webhookUrl": "https://hooks.example.com/one-off"}'
```

### GitHub Actions (esquema)

```yaml
jobs:
  brownfield-converge:
    runs-on: ubuntu-latest
    steps:
      - name: Reindex in Ariadne
        run: |
          curl -sS -X POST \
            "${{ secrets.ARIADNE_INGEST_URL }}/repositories/${{ vars.ARIADNE_REPO_ID }}/resync-for-project" \
            -H "Authorization: Bearer ${{ secrets.ARIADNE_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d "{\"projectId\": \"${{ vars.ARIADNE_PROJECT_ID }}\"}"
          # Opcional: poll hasta job OK

      - name: Trigger converge
        run: |
          curl -sS -X POST \
            "${{ secrets.THEFORGE_API_URL }}/projects/${{ vars.THEFORGE_PROJECT_ID }}/converge/trigger" \
            -H "Authorization: Bearer ${{ secrets.THEFORGE_JWT }}" \
            -H "Content-Type: application/json" \
            -d '{"persist": false}'
```

### n8n / Make

1. **Trigger:** schedule o webhook de Bitbucket.
2. **HTTP Request:** Ariadne resync.
3. **Wait / poll:** job completado.
4. **HTTP Request:** The Forge `converge/trigger`.
5. **Branch:** si `openTaskCount > 0` o hay gaps → Slack / `tasks-to-issues`.

---

## Payload que recibe tu webhook

The Forge hace `POST` JSON a tu URL:

```json
{
  "event": "theforge.converge",
  "projectId": "uuid",
  "stageId": "uuid-or-null",
  "featureDir": "specs/001-feature-name",
  "openTaskCount": 12,
  "conformanceGaps": ["..."],
  "codebaseEvidence": "... markdown o null ...",
  "convergeSection": "## Tareas pendientes (converge)\n\n- [ ] ...",
  "suggestedTasksMarkdown": "... tasks.md completo propuesto ...",
  "persisted": false,
  "webhookSent": true,
  "webhookUrl": "https://hooks.example.com/..."
}
```

Tu servicio debe responder **2xx** para que `webhookSent` quede en `true`. Errores HTTP se registran en logs de la API; **no** fallan el converge en sí.

---

## Casos de uso concretos

### 1. Informe semanal de drift (sin persistir)

- **Cron** viernes 18:00.
- `persist: false`.
- Webhook → canal Slack con `convergeSection` y conteo de gaps.
- El equipo revisa en Workshop y pulsa Converge manualmente si acuerdan cambios.

### 2. Post-merge en `main` (persistir tareas)

- Pipeline tras merge a `main`.
- Ariadne resync del repo legacy.
- `converge/trigger` con `persist: true`.
- `tasks.md` del proyecto se actualiza automáticamente; el equipo implementa la siguiente tarea con **Siguiente tarea** / MCP.

### 3. Puerta de calidad antes de release

- Webhook receptor compara `conformanceGaps.length` y tareas nuevas en converge.
- Si hay drift crítico → bloquea release o abre issue automático (`POST /tasks-to-issues` en un paso posterior).

### 4. Multi-etapa legacy (etapa 2+)

- Proyecto con etapa 1 = as-is cerrada, etapa 2 = cambio activo.
- Pasá `?stageId=` de la etapa 2 para que converge use MDD/tasks de esa etapa, no la foto histórica.

### 5. Monorepo (varios repos, un proyecto Ariadne)

- Resync por repo con `resync-for-project` y el `projectId` multi-root correcto.
- En The Forge, la etapa debe tener el `theforgeProjectId` que apunta al scope Ariadne (MCP `list_known_projects` → `roots[].id` o UUID de proyecto según configuración).

---

## Errores frecuentes

| Síntoma | Causa probable | Qué hacer |
|---------|----------------|-----------|
| `Genera tasks.md antes de ejecutar converge` | No hay tasks en la etapa/proyecto | Generá entregables Tasks en Workshop |
| `codebaseEvidence` null | Sin MCP / sin `theforgeProjectId` | Configurá integración Ariadne en la etapa |
| Evidencia vacía pero MCP OK | Grafo desactualizado | Resync en Ariadne **antes** del trigger |
| Webhook no llega | URL vacía y sin env global | Configurá URL en Integración o `CONVERGE_WEBHOOK_URL` |
| `webhookSent: false` | Tu endpoint devolvió 4xx/5xx | Revisá logs del receptor y firewall |
| Converge “inventa” pendientes | Índice incompleto o alcance mal acotado | Revisá `indexIncludeRules` del repo en Ariadne |

---

## Relación con otras herramientas The Forge

| Herramienta | Complemento |
|-------------|-------------|
| **Analyze** (`GET /analyze`) | Dashboard de salud; no sustituye converge |
| **Tasks → Issues** | Paso posterior si el webhook detecta tareas accionables |
| **Export repo-handoff** | Entrega spec-kit al repo; converge mantiene `tasks.md` vivo después |
| **Integración NEW ↔ LEGACY** | Ortogonal; el webhook es por **proyecto** legacy, no por enlace NEW |

---

## Referencias en el repositorio

- `README.md` — sección *Converge webhook (brownfield CI)*
- `docs/plans/PLAN-BROWNFIELD-P1-P2-P3.md` — entregables P2.5 / D3
- `docs/speckit-vs-theforge.md` — converge vs spec-kit `/speckit.converge`
- Ariadne: `docs/manual/CONFIGURACION_Y_USO.md`, webhook Bitbucket, `POST /repositories/:id/resync`
- Ariadne brownfield hook: `docs/notebooklm/BROWNFIELD-CONVERGE-THEFORGE.md` (reindex → converge automático por repo)
