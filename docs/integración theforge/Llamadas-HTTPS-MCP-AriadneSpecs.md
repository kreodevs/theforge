# Llamadas HTTPS al MCP AriadneSpecs Oracle

Guía para **implementar llamadas HTTP/HTTPS** desde una aplicación al servidor MCP AriadneSpecs. El MCP usa el protocolo **Streamable HTTP** (JSON-RPC 2.0 sobre POST). Esta documentación describe el contrato que debe implementar el cliente.

**Fuente canónica (repo Ariadne):** `docs/MCP_HTTPS.md` y `docs/mcp_server_specs.md` (SPEC-MCP-001). Mantener esta copia sincronizada con esos archivos al cambiar el servidor MCP.

---

## 1. Endpoint y método

| Propiedad    | Valor                                                       |
| ------------ | ----------------------------------------------------------- |
| Método       | `POST`                                                      |
| URL          | `https://<host>/mcp` (ej. `https://ariadne.kreoint.mx/mcp`) |
| Content-Type | `application/json`                                          |
| Accept       | `application/json`, `text/event-stream`                     |

---

## 2. Formato de mensajes (JSON-RPC 2.0)

Todas las peticiones son mensajes JSON-RPC 2.0 en el body del POST:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "<método>",
  "params": { ... }
}
```

- `jsonrpc`: siempre `"2.0"`
- `id`: número o string único por petición (para correlacionar respuestas)
- `method`: nombre del método MCP
- `params`: parámetros según el método

---

## 3. Headers obligatorios

```
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2025-03-26
```

Si el servidor tiene `MCP_AUTH_TOKEN` configurado:

```
Authorization: Bearer <token>
```

Alternativa de auth: `X-M2M-Token: <token>`

---

## 4. Flujo de inicialización (opcional)

Algunos clientes envían `initialize` antes de usar herramientas. El servidor AriadneSpecs es **stateless**: cada petición es independiente. Si tu aplicación solo llama `tools/list` y `tools/call`, puedes omitir la inicialización.

---

## 5. Listar herramientas (`tools/list`)

### Request

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

### Response (ejemplo)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "list_known_projects",
        "description": "Lista los proyectos indexados...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

---

## 6. Invocar herramienta (`tools/call`)

### Request

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "<nombre_herramienta>",
    "arguments": {
      "<param1>": "<valor1>",
      "<param2>": "<valor2>"
    }
  }
}
```

### Response (ejemplo)

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Contenido en texto plano o Markdown devuelto por la herramienta."
      }
    ],
    "isError": false
  }
}
```

Si hay error en la ejecución de la herramienta:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[NOT_FOUND_IN_GRAPH] Nodo X no encontrado."
      }
    ],
    "isError": true
  }
}
```

---

## 7. Herramientas principales y argumentos

(Copia alineada con `MCP_HTTPS.md` §7; ver allí **FALKOR_SHARD_BY_PROJECT** y matices de `semantic_search`.)

| Herramienta                     | Argumentos requeridos   | Argumentos opcionales                                                                 |
| ------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `list_known_projects`           | —                       | —                                                                                     |
| `get_legacy_impact`             | `nodeName`              | `projectId`, `currentFilePath`                                                       |
| `get_contract_specs`            | `componentName`         | `projectId`, `currentFilePath`                                                       |
| `get_component_graph`           | `componentName`         | `depth`, `projectId`, `currentFilePath`                                                |
| `get_file_content`              | `path` + (`projectId` **o** `currentFilePath`) | `ref`                                                                              |
| `semantic_search`               | `query`; con sharding también **`projectId`** | `limit`; **`projectId`** opcional sin sharding. **No** `scope` ni `currentFilePath`. |
| `validate_before_edit`        | `nodeName`              | `projectId`, `currentFilePath`                                                       |
| `get_project_analysis`          | `projectId`             | `mode` (diagnostico, duplicados, reingenieria, codigo_muerto, seguridad)              |
| `ask_codebase`                  | `question`              | `projectId`, `currentFilePath`, `scope`, `twoPhase`                                   |
| `get_modification_plan`         | `userDescription`       | `projectId`, `currentFilePath`, `scope`                                               |
| `get_definitions`               | `symbolName`            | `projectId`, `currentFilePath`                                                       |
| `get_references`                | `symbolName`            | `projectId`, `currentFilePath`                                                       |
| `get_implementation_details`    | `symbolName`            | `projectId`, `currentFilePath`                                                       |
| `get_functions_in_file`         | `path` + (`projectId` **o** `currentFilePath`) | —                                                                 |
| `get_import_graph`              | `filePath` + (`projectId` **o** `currentFilePath`) | —                                                                                |
| `trace_reachability`            | `projectId` **o** `currentFilePath` | —                                                                             |
| `check_export_usage`            | `projectId` **o** `currentFilePath` | `filePath` opcional                                                                 |
| `get_affected_scopes`          | `nodeName`              | `projectId`, `currentFilePath`, `includeTestFiles`                                   |
| `check_breaking_changes`        | `nodeName`              | `projectId`, `currentFilePath`, `removedParams`                                         |
| `find_similar_implementations` | `query`                 | `projectId`, `currentFilePath`, `limit`                                               |
| `get_project_standards`        | `projectId` **o** `currentFilePath` | —                                                                                   |
| `get_file_context`             | `filePath` + (`projectId` **o** `currentFilePath`) | `ref`                                                                            |
| `analyze_local_changes`        | —                       | `projectId` o `currentFilePath`; `workspaceRoot` o `stagedDiff`                      |

> **projectId (The Forge API):** `list_known_projects.id` = workspace (ingest `/projects/:id/…`); `roots[].id` = repo. El cliente Nest resuelve y usa **workspace `id`** como `projectId` en **`ask_codebase`** y **`get_modification_plan`**, y **`roots[].id`** (o primer root del workspace) en herramientas de grafo / **`semantic_search`**, más `scope.repoIds` en ask/plan. Ver `apps/api/src/modules/theforge/ariadne-mcp-scope.util.ts`.

---

## 8. Implementación en TheForge

El servicio `TheForgeService` (`apps/api/src/modules/theforge/theforge.service.ts`) implementa este contrato:

- `isConfigured()`: true si `THEFORGE_MCP_URL` está definido (token opcional)
- Headers: `MCP-Protocol-Version: 2025-03-26`, `Accept: application/json, text/event-stream`; auth `Authorization: Bearer` o `X-M2M-Token` cuando el token está configurado
- Variables: `THEFORGE_MCP_URL`, `MCP_AUTH_TOKEN`, `MCP_X_M2M_TOKEN`, `THEFORGE_LIST_PROJECTS_CACHE_MS` (resolución id workspace vs repo)
- `pnpm --filter @theforge/api test:mcp-alignment`: exige que existan en el servidor las herramientas de `THEFORGE_MCP_TOOLS_WE_CALL` y que los `required` del `inputSchema` estén cubiertos en `theforge-mcp-client-contract.ts`

---

## 9. Códigos HTTP

| Código | Significado                                                               |
| ------ | ------------------------------------------------------------------------- |
| 200    | OK — Respuesta JSON-RPC en body                                           |
| 202    | Accepted — Notificación aceptada (sin body)                               |
| 400    | Bad Request — JSON malformado o método inválido                           |
| 401    | Unauthorized — Falta o token incorrecto (si MCP_AUTH_TOKEN está definido) |
| 404    | Not Found — Ruta incorrecta (verificar que sea `/mcp`)                   |
| 500    | Internal Server Error — Error del servidor                                |
