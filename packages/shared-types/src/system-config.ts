/**
 * Catálogo allowlist de configuración de plataforma (UI Ajustes → Sistema + tabla AppConfig).
 * Prioridad en runtime: BD → env → defaultValue.
 */

export type SystemConfigCategory =
  | "integrations"
  | "llm"
  | "queues"
  | "mcp"
  | "legacy"
  | "debug";

export type SystemConfigFieldType = "string" | "number" | "boolean" | "secret";

export interface SystemConfigDefinition {
  key: string;
  envKey: string;
  type: SystemConfigFieldType;
  defaultValue: string;
  label: string;
  description: string;
  category: SystemConfigCategory;
  min?: number;
  max?: number;
  /** Si true, la UI enmascara el valor y PATCH vacío no borra el secreto existente. */
  secret?: boolean;
  /** BullMQ/workers: el valor en BD aplica tras reiniciar el proceso worker. */
  restartRequired?: boolean;
}

export const SYSTEM_CONFIG_CATEGORIES: ReadonlyArray<{
  id: SystemConfigCategory;
  label: string;
}> = [
  { id: "integrations", label: "Integraciones" },
  { id: "llm", label: "LLM y LangGraph" },
  { id: "queues", label: "Colas BullMQ" },
  { id: "mcp", label: "MCP y caché" },
  { id: "legacy", label: "Legacy / brownfield" },
  { id: "debug", label: "Depuración" },
] as const;

function def(
  key: string,
  envKey: string,
  type: SystemConfigFieldType,
  defaultValue: string,
  label: string,
  description: string,
  category: SystemConfigCategory,
  extra?: Pick<SystemConfigDefinition, "min" | "max" | "secret" | "restartRequired">,
): SystemConfigDefinition {
  return { key, envKey, type, defaultValue, label, description, category, ...extra };
}

export const SYSTEM_CONFIG_DEFINITIONS: readonly SystemConfigDefinition[] = [
  def(
    "hermes_webhook_url",
    "HERMES_WEBHOOK_URL",
    "string",
    "",
    "Hermes — URL del webhook",
    "URL del proxy Hermes Agent para el botón «Lanzar a Hermes».",
    "integrations",
  ),
  def(
    "hermes_api_key",
    "HERMES_API_KEY",
    "secret",
    "",
    "Hermes — API key",
    "Bearer token del proxy Hermes.",
    "integrations",
    { secret: true },
  ),
  def(
    "theforge_mcp_url",
    "THEFORGE_MCP_URL",
    "string",
    "",
    "TheForge MCP — URL",
    "URL Streamable HTTP del MCP AriadneSpecs. Vacío = MCP desconfigurado.",
    "integrations",
  ),
  def(
    "tech_docs_mcp_default_url",
    "TECH_DOCS_MCP_DEFAULT_URL",
    "string",
    "https://mcp.context7.com/mcp",
    "Docs técnicas — URL MCP por defecto",
    "URL Context7 remota si el usuario no personaliza la suya en Ajustes.",
    "integrations",
  ),
  def(
    "tavily_api_key",
    "TAVILY_API_KEY",
    "secret",
    "",
    "Tavily — API key",
    "Búsqueda web Scout (opcional).",
    "integrations",
    { secret: true },
  ),
  def(
    "ariadne_brownfield_converge_auto",
    "ARIADNE_BROWNFIELD_CONVERGE_AUTO",
    "boolean",
    "1",
    "Brownfield — auto converge",
    "PATCH repos al crear proyecto LEGACY cuando MCP está configurado.",
    "integrations",
  ),
  def(
    "ariadne_brownfield_converge_mode",
    "ARIADNE_BROWNFIELD_CONVERGE_MODE",
    "string",
    "incremental",
    "Brownfield — modo converge",
    "Valores: off | incremental | full | all.",
    "integrations",
  ),
  def(
    "ariadne_brownfield_converge_persist",
    "ARIADNE_BROWNFIELD_CONVERGE_PERSIST",
    "boolean",
    "0",
    "Brownfield — persistir converge",
    "Persistir resultado de converge en el repo Ariadne.",
    "integrations",
  ),
  def(
    "llm_max_tokens",
    "LLM_MAX_TOKENS",
    "number",
    "131072",
    "LLM — tope global max_tokens",
    "Techo de tokens de salida; los perfiles por tarea nunca lo superan.",
    "llm",
    { min: 1024, max: 1_000_000 },
  ),
  def(
    "langgraph_recursion_limit",
    "LANGGRAPH_RECURSION_LIMIT",
    "number",
    "100",
    "LangGraph — límite de recursión",
    "Pasos LangGraph por invocación (MDD Manager puede superar el default 25).",
    "llm",
    { min: 10, max: 500 },
  ),
  def(
    "agent_evaluator_legacy",
    "AGENT_EVALUATOR_LEGACY",
    "boolean",
    "0",
    "Evaluador legacy en respuesta",
    "Incluir evaluador legacy en la respuesta del orquestador.",
    "llm",
  ),
  def(
    "mdd_bullmq_concurrency",
    "MDD_BULLMQ_CONCURRENCY",
    "number",
    "2",
    "Cola MDD — concurrencia",
    "Jobs MDD concurrentes por worker (pipeline LangGraph pesado).",
    "queues",
    { min: 1, max: 8, restartRequired: true },
  ),
  def(
    "deliverables_bullmq_concurrency",
    "DELIVERABLES_BULLMQ_CONCURRENCY",
    "number",
    "2",
    "Cola entregables — concurrencia",
    "Jobs de entregables greenfield concurrentes por worker.",
    "queues",
    { min: 1, max: 6, restartRequired: true },
  ),
  def(
    "legacy_deliverables_bullmq_concurrency",
    "LEGACY_DELIVERABLES_BULLMQ_CONCURRENCY",
    "number",
    "1",
    "Cola legacy entregables — concurrencia",
    "Jobs legacy/generate-deliverables concurrentes por worker.",
    "queues",
    { min: 1, max: 4, restartRequired: true },
  ),
  def(
    "theforge_mcp_timeout_ms",
    "THEFORGE_MCP_TIMEOUT_MS",
    "number",
    "60000",
    "TheForge MCP — timeout (ms)",
    "Timeout por llamada JSON-RPC a herramientas rápidas.",
    "mcp",
    { min: 1000, max: 600_000 },
  ),
  def(
    "theforge_mcp_ask_codebase_timeout_ms",
    "THEFORGE_MCP_ASK_CODEBASE_TIMEOUT_MS",
    "number",
    "900000",
    "TheForge MCP — timeout ask_codebase (ms)",
    "Timeout solo para tools/call ask_codebase (ingest puede tardar minutos).",
    "mcp",
    { min: 60_000, max: 3_600_000 },
  ),
  def(
    "tech_docs_mcp_timeout_ms",
    "TECH_DOCS_MCP_TIMEOUT_MS",
    "number",
    "15000",
    "Docs técnicas — timeout MCP (ms)",
    "Timeout por llamada al MCP Context7.",
    "mcp",
    { min: 1000, max: 120_000 },
  ),
  def(
    "tech_docs_mcp_max_libraries",
    "TECH_DOCS_MCP_MAX_LIBRARIES",
    "number",
    "3",
    "Docs técnicas — máx. librerías",
    "Máximo de librerías por generación desde MDD §2.",
    "mcp",
    { min: 1, max: 6 },
  ),
  def(
    "theforge_list_projects_cache_ms",
    "THEFORGE_LIST_PROJECTS_CACHE_MS",
    "number",
    "60000",
    "MCP — caché list_known_projects (ms)",
    "TTL de caché para list_known_projects. 0 = sin caché.",
    "mcp",
    { min: 0, max: 3_600_000 },
  ),
  def(
    "theforge_context_cache",
    "THEFORGE_CONTEXT_CACHE",
    "boolean",
    "1",
    "Caché contexto MCP",
    "Caché en memoria del contexto TheForge/Ariadne.",
    "mcp",
  ),
  def(
    "theforge_context_cache_ttl_ms",
    "THEFORGE_CONTEXT_CACHE_TTL_MS",
    "number",
    "1800000",
    "Caché contexto — TTL (ms)",
    "TTL de entradas (mínimo efectivo 60000).",
    "mcp",
    { min: 60_000, max: 86_400_000 },
  ),
  def(
    "theforge_context_cache_max_entries",
    "THEFORGE_CONTEXT_CACHE_MAX_ENTRIES",
    "number",
    "80",
    "Caché contexto — máx. entradas",
    "Máximo de entradas en caché (mínimo efectivo 8).",
    "mcp",
    { min: 8, max: 500 },
  ),
  def(
    "theforge_context_revision",
    "THEFORGE_CONTEXT_REVISION",
    "string",
    "",
    "Caché contexto — revisión manual",
    "Bump manual para invalidar caché (cualquier string).",
    "mcp",
  ),
  def(
    "theforge_context_prepend_max_chars",
    "THEFORGE_CONTEXT_PREPEND_MAX_CHARS",
    "number",
    "16000",
    "Contexto TheForge — tope en prompts",
    "Tope de caracteres del bloque TheForge en prompts de entregables.",
    "legacy",
    { min: 2000, max: 200_000 },
  ),
  def(
    "mdd_proposed_component_diagram",
    "MDD_PROPOSED_COMPONENT_DIAGRAM",
    "boolean",
    "1",
    "MDD greenfield — diagrama §2",
    "Inyecta diagrama de componentes propuesto en §2 del MDD greenfield.",
    "legacy",
  ),
  def(
    "legacy_evidence_first_context",
    "LEGACY_EVIDENCE_FIRST_CONTEXT",
    "boolean",
    "1",
    "Legacy — pipeline evidencia-primero",
    "Activa pipeline evidencia-primero en flujo legacy.",
    "legacy",
  ),
  def(
    "legacy_analyzer_compact",
    "LEGACY_ANALYZER_COMPACT",
    "boolean",
    "1",
    "Legacy — analyzer compacto",
    "Legacy Analyzer en modo compacto.",
    "legacy",
  ),
  def(
    "legacy_analyzer_require_graph_hits",
    "LEGACY_ANALYZER_REQUIRE_GRAPH_HITS",
    "boolean",
    "1",
    "Legacy — exigir hits en grafo",
    "No ejecutar Analyzer si el índice MCP está vacío.",
    "legacy",
  ),
  def(
    "legacy_sdd_index_gate",
    "LEGACY_SDD_INDEX_GATE",
    "boolean",
    "1",
    "Legacy — gate índice SDD",
    "Cruce índice MCP vs SDD Falkor.",
    "legacy",
  ),
  def(
    "legacy_mdd_component_diagram",
    "LEGACY_MDD_COMPONENT_DIAGRAM",
    "boolean",
    "1",
    "Legacy MDD — diagrama componentes",
    "Añade diagrama Mermaid de componentes en doc. partida y §2 legacy.",
    "legacy",
  ),
  def(
    "legacy_deliverables_section_merge",
    "LEGACY_DELIVERABLES_SECTION_MERGE",
    "string",
    "all",
    "Legacy entregables — section merge",
    "Valores: all | blueprint | auto | off.",
    "legacy",
  ),
  def(
    "debug_mcp",
    "DEBUG_MCP",
    "boolean",
    "0",
    "Debug MCP",
    "Log petición/respuesta MCP en consola.",
    "debug",
  ),
  def(
    "debug_mdd_section3",
    "DEBUG_MDD_SECTION3",
    "boolean",
    "0",
    "Debug MDD §3",
    "Log detallado de la sección 3 del MDD.",
    "debug",
  ),
  def(
    "debug_mcp_max_request_chars",
    "DEBUG_MCP_MAX_REQUEST_CHARS",
    "number",
    "65536",
    "Debug MCP — truncado request",
    "Máximo de caracteres logueados por petición MCP.",
    "debug",
    { min: 1024, max: 1_048_576 },
  ),
  def(
    "debug_mcp_max_response_chars",
    "DEBUG_MCP_MAX_RESPONSE_CHARS",
    "number",
    "32768",
    "Debug MCP — truncado response",
    "Máximo de caracteres logueados por respuesta MCP.",
    "debug",
    { min: 1024, max: 1_048_576 },
  ),
  def(
    "otp_dev_expose_code",
    "OTP_DEV_EXPOSE_CODE",
    "boolean",
    "0",
    "OTP dev — exponer código",
    "POST /auth/otp/request devuelve devCode sin enviar correo (solo desarrollo).",
    "debug",
  ),
] as const;

const DEFINITION_BY_KEY = new Map(SYSTEM_CONFIG_DEFINITIONS.map((d) => [d.key, d]));

export function getSystemConfigDefinition(key: string): SystemConfigDefinition | undefined {
  return DEFINITION_BY_KEY.get(key);
}

export function isTruthyPlatformFlag(raw: string | undefined | null): boolean {
  const v = raw?.trim().toLowerCase();
  if (!v) return false;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function normalizePlatformBooleanInput(value: unknown): string {
  if (value === true || value === 1) return "1";
  if (value === false || value === 0) return "0";
  if (typeof value === "string") {
    return isTruthyPlatformFlag(value) ? "1" : "0";
  }
  return "0";
}

export type SystemConfigSource = "database" | "env" | "default";

export interface SystemConfigSettingView {
  key: string;
  envKey: string;
  label: string;
  description: string;
  type: SystemConfigFieldType;
  category: SystemConfigCategory;
  value: string;
  defaultValue: string;
  source: SystemConfigSource;
  secret: boolean;
  restartRequired: boolean;
  min?: number;
  max?: number;
}

export interface SystemConfigSnapshot {
  version: string;
  categories: typeof SYSTEM_CONFIG_CATEGORIES;
  settings: SystemConfigSettingView[];
}
