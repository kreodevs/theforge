/**
 * Unión de claves de `arguments` que `TheForgeService` puede enviar por herramienta MCP.
 * Debe cubrir `inputSchema.required` devuelto por `tools/list` del despliegue AriadneSpecs.
 * Mantener alineado con los métodos que llaman `callTool` / `postTheForgeMcp`.
 */
export const THEFORGE_MCP_CLIENT_ARG_KEYS: Readonly<Record<string, ReadonlySet<string>>> = {
  list_known_projects: new Set<string>(),
  ask_codebase: new Set([
    "question",
    "projectId",
    "twoPhase",
    "currentFilePath",
    "scope",
    "responseMode",
  ]),
  get_modification_plan: new Set([
    "userDescription",
    "projectId",
    "currentFilePath",
    "scope",
  ]),
  get_file_content: new Set(["path", "projectId", "ref", "currentFilePath"]),
  get_legacy_impact: new Set(["nodeName", "projectId", "currentFilePath"]),
  validate_before_edit: new Set(["nodeName", "projectId", "currentFilePath"]),
  get_contract_specs: new Set(["componentName", "projectId", "currentFilePath"]),
  get_component_graph: new Set([
    "componentName",
    "projectId",
    "depth",
    "currentFilePath",
  ]),
  semantic_search: new Set(["query", "projectId", "limit"]),
  get_functions_in_file: new Set(["path", "projectId", "currentFilePath"]),
  get_definitions: new Set(["symbolName", "projectId", "currentFilePath"]),
  get_references: new Set(["symbolName", "projectId", "currentFilePath"]),
};

/** Herramientas que el cliente espera que existan en el MCP (falla el humo si faltan). */
export const THEFORGE_MCP_TOOLS_WE_CALL = new Set(Object.keys(THEFORGE_MCP_CLIENT_ARG_KEYS));
