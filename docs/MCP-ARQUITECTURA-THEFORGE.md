# MCP: TheForge (externo) vs necesidades propias de TheForge

TheForge **no** implementa el mismo protocolo ni el mismo despliegue que el MCP de **TheForge**. Son capas distintas; mezclarlas en configuración o en documentación genera errores de despliegue y de expectativas.

## 1. MCP de TheForge (AriadneSpecs) — **ajeno** al repo

- **Qué es:** Servidor MCP operado en el entorno TheForge (p. ej. JSON-RPC sobre HTTPS). Indexa el **código** del repositorio del cliente en un grafo gestionado por TheForge.
- **Cómo lo usa TheForge:** La API Nest (`TheForgeService`) hace **HTTP POST** a `THEFORGE_MCP_URL` con JSON-RPC `tools/call` (p. ej. `ask_codebase`, `get_modification_plan`, `validate_before_edit`). No es un proceso MCP embebido en el contenedor de TheForge.
- **Autenticación:** `MCP_AUTH_TOKEN` (Bearer).
- **Timeouts:** `THEFORGE_MCP_TIMEOUT_MS` (default 60000). El grafo y la latencia son ajenos a nuestro control.
- **Depuración:** `DEBUG_MCP=1` hace que la API registre cada petición JSON-RPC y la respuesta cruda del MCP (ver también `DEBUG_MCP_MAX_REQUEST_CHARS` / `DEBUG_MCP_MAX_RESPONSE_CHARS`). En Docker: variable en el servicio `theforge-api`.
- **Cursor / IDE:** El MCP que configures en `~/.cursor/mcp.json` apuntando a TheForge sirve al **editor**, no sustituye la variable `THEFORGE_MCP_URL` de la API en producción.
- **Crítica del evaluador en el chat** (`evaluatorCritique` en la respuesta del orquestador) viene del **pipeline TheForge** (evaluador opcional), no del endpoint TheForge: son canales independientes.

## 2. Grafo SDD en TheForge (FalkorDB local)

- **Qué es:** Instancia **FalkorDB** en el mismo stack (p. ej. `theforge-falkor-sdd` en Docker) para el **grafo documental** por **etapa**: nodos `Project`, `Stage`, `MDD_Section`, `DB_Entity`, `API_Endpoint` (y reglas de seguridad donde aplique); relaciones típicas `Project-[:HAS_STAGE]->Stage`, `Stage-[:IMPLEMENTS]->MDD_Section`, `Stage-[:OWNS_ENTITY]->DB_Entity`, `API_Endpoint-[:CONSUMES]->DB_Entity`, etc. La ingesta reconstruye el subgrafo de una etapa al sincronizar el MDD (no mezclar con etiquetas antiguas `Table`/`HAS_TABLE` en grafos viejos).
- **Conexión:** `FALKORDB_SDD_URL` / `FALKORDB_URL` → cliente `falkordb` en `GraphMemoryService`. **No** pasa por el protocolo MCP.
- **Consultas (agentes / Manager):** Cypher de solo lectura vía `query_sdd_graph`, `supervisor_query_sdd_graph` y `querySddGraphReadOnly`. Parámetros: **`params.projectId` o `params.stageId`** (al menos uno) para acotar el ámbito. Herramientas adicionales en el mismo toolset: `patch_mdd_section`, `propose_mdd_amendment` (enmienda §3/§4 desde extractos Blueprint/API).

## 3. Si en el futuro TheForge expone su propio MCP

Sería un **servidor MCP distinto** (herramientas sobre el Grafo SDD, proyectos, sesiones), con otro puerto/URL y otro contrato de herramientas. No reutiliza el endpoint de TheForge ni el binario AriadneSpecs. Sigue siendo **opcional (YAGNI)**: no sustituye TheForge, el Falkor SDD local ni las respuestas del orquestador en la app.

- Variables sugeridas (ejemplo, no implementado aún): `THEFORGE_MCP_PORT`, documentación de tools en OpenAPI o README del servidor MCP.
- **No** confundir con `THEFORGE_MCP_URL`.

## 4. Resumen

| Capa              | Transporte      | Datos                    |
|------------------|-----------------|---------------------------|
| TheForge MCP        | HTTPS JSON-RPC  | Código / grafo TheForge      |
| FalkorDB SDD     | Redis/FalkorDB  | MDD y artefactos SDD      |
| MCP TheForge (?) | STDIO/HTTP MCP  | Futuro; no es TheForge       |

Ver también: `docs/THEFORGE-MCP.md`, `docs/integración theforge/`.
