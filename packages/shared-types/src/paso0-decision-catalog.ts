/**
 * Catálogo determinístico extraído de un Paso 0 definitivo pegado (D-IDs).
 */

import { z } from "zod";

export const PASO0_DECISION_CATALOG_KIND = "paso0_decision_catalog" as const;
export const PASO0_PASTE_SIDECAR_KIND = "paso0_paste_sidecar" as const;

export const paso0DecisionItemSchema = z.object({
  id: z.string().min(1),
  rule: z.string().min(1),
  classification: z.string().optional(),
  assertionType: z.string().optional(),
  scope: z.string().optional(),
});
export type Paso0DecisionItem = z.infer<typeof paso0DecisionItemSchema>;

export const paso0MvpCapabilitySchema = z.object({
  title: z.string().min(1),
  decisionIds: z.array(z.string()).default([]),
  rule: z.string().min(1),
  classification: z.string().optional(),
});
export type Paso0MvpCapability = z.infer<typeof paso0MvpCapabilitySchema>;

export const paso0OutOfScopeItemSchema = z.object({
  rule: z.string().min(1),
  decisionIds: z.array(z.string()).optional(),
});
export type Paso0OutOfScopeItem = z.infer<typeof paso0OutOfScopeItemSchema>;

export const paso0EntityTermSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
  decisionIds: z.array(z.string()).optional(),
});
export type Paso0EntityTerm = z.infer<typeof paso0EntityTermSchema>;

export const paso0RiskItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  mitigation: z.string().optional(),
});
export type Paso0RiskItem = z.infer<typeof paso0RiskItemSchema>;

export const paso0BusinessRuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  givenWhenThen: z.string().optional(),
  decisionIds: z.array(z.string()).optional(),
});
export type Paso0BusinessRule = z.infer<typeof paso0BusinessRuleSchema>;

export const paso0ApiRouteFamilySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  pathPatterns: z.array(z.string()).min(1),
  methods: z.array(z.string()).optional(),
  decisionIds: z.array(z.string()).optional(),
  /** Si true, ausencia en §4 es blocker del delivery gate con Paso 0 pegado. */
  critical: z.boolean().optional(),
});
export type Paso0ApiRouteFamily = z.infer<typeof paso0ApiRouteFamilySchema>;

/** 38 tablas canónicas Workspace Chat (EXPECTED-MDD §3.10). */
export const WORKSPACE_CHAT_CANONICAL_ENTITIES = [
  "applications",
  "application_credentials",
  "application_capabilities",
  "identities",
  "platform_scopes",
  "contexts",
  "context_memberships",
  "topics",
  "topic_memberships",
  "mention_labels",
  "mention_label_members",
  "messages",
  "message_revisions",
  "reactions",
  "mentions",
  "pinned_messages",
  "attachments",
  "business_events",
  "outbox",
  "devices",
  "topic_key_epochs",
  "key_escrow_records",
  "trusted_processors",
  "retention_policies",
  "legal_holds",
  "export_requests",
  "break_glass_requests",
  "audit_entries",
  "purge_tombstones",
  "agents",
  "agent_enablements",
  "agent_topic_memberships",
  "agent_invocations",
  "read_states",
  "notification_intents",
  "migration_jobs",
  "migration_items",
  "analytics_rollups",
] as const;

/** Familias de rutas MVP obligatorias (EXPECTED-MDD §4.2). */
export const WORKSPACE_CHAT_MANDATORY_API_ROUTE_FAMILIES: readonly Paso0ApiRouteFamily[] = [
  {
    id: "ingest-events",
    label: "Ingesta idempotente de eventos",
    pathPatterns: ["/ingest/events"],
    methods: ["POST"],
    decisionIds: ["D-080", "D-141"],
    critical: true,
  },
  {
    id: "attachments",
    label: "Adjuntos con cuarentena",
    pathPatterns: ["/attachments"],
    methods: ["POST", "GET"],
    decisionIds: ["D-125", "D-086"],
    critical: true,
  },
  {
    id: "break-glass",
    label: "Acceso break-glass",
    pathPatterns: ["/break-glass-requests", "/break-glass"],
    methods: ["POST", "GET"],
    decisionIds: ["D-083", "D-150", "D-151"],
    critical: true,
  },
  {
    id: "realtime-ws",
    label: "Conexión WebSocket realtime",
    pathPatterns: ["/ws"],
    methods: ["GET"],
    decisionIds: ["D-126"],
    critical: true,
  },
  {
    id: "migration",
    label: "Migración OBP / Teams",
    pathPatterns: ["/migration-jobs"],
    methods: ["POST", "GET"],
    decisionIds: ["D-119", "D-121", "D-154"],
    critical: true,
  },
  {
    id: "applications",
    label: "Alta y gobierno de aplicaciones",
    pathPatterns: ["/applications"],
    methods: ["POST", "GET", "PATCH"],
    decisionIds: ["D-133", "D-134", "D-145"],
    critical: false,
  },
  {
    id: "contexts-topics",
    label: "Contextos y temas",
    pathPatterns: ["/contexts", "/topics"],
    methods: ["GET", "POST", "PATCH"],
    decisionIds: ["D-002", "D-011", "D-136"],
    critical: false,
  },
  {
    id: "messages",
    label: "Mensajería y subconversaciones",
    pathPatterns: ["/messages", "/topics/"],
    methods: ["POST", "GET", "PATCH"],
    decisionIds: ["D-124", "D-047"],
    critical: false,
  },
  {
    id: "search",
    label: "Búsqueda gobernada",
    pathPatterns: ["/search"],
    methods: ["GET", "POST"],
    decisionIds: ["D-031", "D-157"],
    critical: false,
  },
  {
    id: "agents-mcp",
    label: "Agente externo MCP",
    pathPatterns: ["/agents", "/mcp"],
    methods: ["POST", "GET"],
    decisionIds: ["D-103", "D-106"],
    critical: false,
  },
];

/** Reglas RN-XX canónicas (EXPECTED-MDD §5.1 — extracto BDD). */
export const WORKSPACE_CHAT_BUSINESS_RULES: readonly Paso0BusinessRule[] = [
  {
    id: "RN-01",
    title: "Alta de aplicación consumidora",
    decisionIds: ["D-133", "D-134", "D-135"],
    givenWhenThen:
      "Dado un usuario con scope global_admin, cuando registra una aplicación con responsable funcional, política de administradores, retención, E2EE por defecto y orígenes autorizados, entonces se crea la aplicación, se emite credencial rotable y se audita.",
  },
  {
    id: "RN-02",
    title: "Creación de contexto y tema General",
    decisionIds: ["D-011", "D-080", "D-136"],
    givenWhenThen:
      "Dado un evento intent=ensure_context con credencial vigente, cuando el contexto no existe, entonces se crea el contexto, su tema General (origin=default, visibility=public) y la membresía inicial de forma idempotente.",
  },
  {
    id: "RN-03",
    title: "Privacidad de tema manual",
    decisionIds: ["D-081"],
    givenWhenThen:
      "Dado un tema manual sin mensajes, cuando se publica el primer mensaje, entonces se fija privacy_locked_at y cualquier cambio posterior de visibilidad se rechaza con 409.",
  },
  {
    id: "RN-04",
    title: "Publicación de mensaje",
    decisionIds: ["D-124", "D-155", "D-045"],
    givenWhenThen:
      "Dado un member con membresía válida, cuando publica un mensaje, entonces se persiste, se escribe outbox en el mismo commit, se actualizan contadores y se emite realtime; read_only recibe 403.",
  },
  {
    id: "RN-05",
    title: "Un miembro nunca añade participantes",
    decisionIds: ["D-156", "D-018"],
    givenWhenThen:
      "Dado un member o read_only, cuando intenta añadir participantes a contexto o tema, entonces se rechaza con 403.",
  },
  {
    id: "RN-06",
    title: "Adjunto en cuarentena",
    decisionIds: ["D-086", "D-125"],
    givenWhenThen:
      "Dado un adjunto registrado, cuando scan_status no es clean, entonces visualización y descarga devuelven 403; blocked y unscannable son terminales.",
  },
  {
    id: "RN-07",
    title: "Adjunto en contexto E2EE sin analizador",
    decisionIds: ["D-092", "D-086"],
    givenWhenThen:
      "Dado un contexto E2EE sin trusted_processor antimalware activo, cuando se intenta cargar adjunto, entonces se rechaza con 409.",
  },
  {
    id: "RN-08",
    title: "Emisión de evento de negocio",
    decisionIds: ["D-141", "D-080", "D-025"],
    givenWhenThen:
      "Dado un productor con credencial vigente, cuando entrega un evento tras persistir su cambio de negocio, entonces se deduplica por sourceApplication+eventId y el mensaje es inmutable en Chat.",
  },
  {
    id: "RN-09",
    title: "Indisponibilidad de Workspace Chat",
    decisionIds: ["D-141", "D-009"],
    givenWhenThen:
      "Dado Workspace Chat caído, cuando el productor intenta entregar evento, entonces falla sin bloquear la operación de negocio del productor.",
  },
  {
    id: "RN-10",
    title: "Archivado por eliminación en origen",
    decisionIds: ["D-136"],
    givenWhenThen:
      "Dado intent=archive_context por source_object_deleted, entonces el contexto pasa a archived en solo lectura sin eliminar filas.",
  },
  {
    id: "RN-11",
    title: "Invocación del agente en tema privado",
    decisionIds: ["D-106", "D-107"],
    givenWhenThen:
      "Dado invocación de agente, entonces se validan autorización del usuario y membresía técnica del agente; E2EE rechaza con 409 en MVP.",
  },
  {
    id: "RN-12",
    title: "Agente durante break-glass",
    decisionIds: ["D-108"],
    givenWhenThen:
      "Dado sesión break-glass activa, cuando se intenta invocar agente, entonces se rechaza con 403 y se audita.",
  },
  {
    id: "RN-13",
    title: "Solicitud y aprobación de break-glass",
    decisionIds: ["D-083", "D-150", "D-151"],
    givenWhenThen:
      "Dado solicitud break-glass, entonces requiere aprobación de global_admin (gerencia) distinto del solicitante.",
  },
  {
    id: "RN-14",
    title: "Break-glass sobre contenido E2EE",
    decisionIds: ["D-083", "D-091", "D-147"],
    givenWhenThen:
      "Dado break-glass aprobado sobre contexto E2EE, entonces requiere servicio de llaves; si no está disponible queda aprobado pero no ejecutable.",
  },
  {
    id: "RN-15",
    title: "Purga por retención",
    decisionIds: ["D-098", "D-152", "D-153"],
    givenWhenThen:
      "Dado plazos de retención vencidos sin legal hold, entonces se purga según capas D-098 (3/6/2 años + hold +30 días).",
  },
  {
    id: "RN-16",
    title: "Restauración desde backup",
    decisionIds: ["D-098"],
    givenWhenThen:
      "Dado restauración, entonces no reintroduce contenido ya purgado ni viola legal holds.",
  },
  {
    id: "RN-17",
    title: "Rotación de llaves y mensajes programados",
    decisionIds: ["D-092", "D-053"],
    givenWhenThen:
      "Dado rotación de epoch o revocación de dispositivo, entonces mensajes programados se re-cifran o se cancelan según política.",
  },
  {
    id: "RN-18",
    title: "Revocación de dispositivo",
    decisionIds: ["D-091"],
    givenWhenThen:
      "Dado dispositivo revocado, entonces pierde acceso a llaves futuras sin acceso retroactivo.",
  },
  {
    id: "RN-19",
    title: "Notificación en contexto E2EE",
    decisionIds: ["D-092", "D-061"],
    givenWhenThen:
      "Dado contexto E2EE, entonces notification_intents no incluyen plaintext del contenido.",
  },
  {
    id: "RN-20",
    title: "Búsqueda",
    decisionIds: ["D-031", "D-157", "D-092"],
    givenWhenThen:
      "Dado búsqueda, entonces respeta aislamiento por application_id y no indexa ciphertext sin procesador confiable.",
  },
  {
    id: "RN-21",
    title: "Ausencia de descubrimiento",
    decisionIds: ["D-160"],
    givenWhenThen:
      "Dado usuario sin membresía, cuando busca contextos, entonces no existe descubrimiento abierto ni solicitud de acceso.",
  },
  {
    id: "RN-22",
    title: "Exclusión de campaña en migración",
    decisionIds: ["D-119", "D-154"],
    givenWhenThen:
      "Dado exclusión explícita por gerencia, entonces la campaña queda fuera del trabajo de migración.",
  },
  {
    id: "RN-23",
    title: "Corte de campaña",
    decisionIds: ["D-121"],
    givenWhenThen:
      "Dado avance de fase de migración, entonces congelamiento de escritura, delta final y solo lectura temporal sin convivencia permanente.",
  },
  {
    id: "RN-24",
    title: "Identidad histórica no resoluble",
    decisionIds: ["D-120"],
    givenWhenThen:
      "Dado autor no resoluble en SSO, entonces se conserva autoría con is_historical sin conceder permisos.",
  },
  {
    id: "RN-25",
    title: "Analítica sobre temas privados o E2EE",
    decisionIds: ["D-109", "D-161"],
    givenWhenThen:
      "Dado rollup analítico, entonces excluye contenido de temas privados o E2EE (solo metadatos agregados permitidos).",
  },
];

export const paso0DecisionCatalogSchema = z.object({
  kind: z.literal(PASO0_DECISION_CATALOG_KIND),
  version: z.literal(1),
  extractedAt: z.string().min(1),
  sourceHash: z.string().min(1),
  decisions: z.array(paso0DecisionItemSchema),
  mvpCapabilities: z.array(paso0MvpCapabilitySchema),
  outOfScope: z.array(paso0OutOfScopeItemSchema),
  entities: z.array(paso0EntityTermSchema),
  invariants: z.array(z.string()),
  risks: z.array(paso0RiskItemSchema),
  canonicalEntities: z.array(z.string()).default([]),
  mandatoryApiRouteFamilies: z.array(paso0ApiRouteFamilySchema).default([]),
  businessRules: z.array(paso0BusinessRuleSchema).default([]),
  stackFraming: z.enum(["proposal", "decision"]).default("proposal"),
});
export type Paso0DecisionCatalog = z.infer<typeof paso0DecisionCatalogSchema>;

/** Sidecar persistido en phase0SummaryContent tras ingest por pegado. */
export const paso0PasteSidecarSchema = z.object({
  envelopeKind: z.literal(PASO0_PASTE_SIDECAR_KIND),
  version: z.literal(1),
  catalog: paso0DecisionCatalogSchema,
  borrador: z.record(z.unknown()).optional(),
  /** Deep Research u otro markdown auxiliar — no reemplaza el catálogo D-ID. */
  deepResearchMarkdown: z.string().optional(),
});
export type Paso0PasteSidecar = z.infer<typeof paso0PasteSidecarSchema>;

/** Tablas/raíces de dominio prohibidas cuando hay catálogo Paso 0 pegado. */
export const PASO0_FORBIDDEN_ENTITY_TABLES = new Set([
  "tenants",
  "tenant",
  "tenant_quotas",
  "tenant_subscriptions",
  "channels",
  "channel",
  "conversations",
  "conversation",
]);

/**
 * Tablas plataforma frecuentemente alucinadas en MDD §3.
 * Se eliminan post-gen salvo aparición explícita en entidades sugeridas del catálogo.
 */
export const PASO0_INVENTED_PLATFORM_TABLES = new Set([
  "calendarios",
  "calendario",
  "llm_configs",
  "llm_config",
  "requests",
  "request",
  "agent_runs",
  "agent_run",
  "conversation_memory",
  "mcp_plugins",
  "mcp_tools",
  "whatsapp_devices",
  "wasender_devices",
]);

/** Rutas API prohibidas como raíz de dominio cuando hay catálogo Paso 0. */
export const PASO0_FORBIDDEN_API_ROUTE_SEGMENTS = [
  "/tenants",
  "/tenant",
  "/channels",
  "/channel",
  "/conversations",
  "/conversation",
  "/llm-configs",
  "/llm_configs",
  "/agent-runs",
  "/agent_runs",
  "/mcp-plugins",
  "/mcp_plugins",
  "/requests",
  "/request",
] as const;

/** Rutas de auth local prohibidas cuando D-003 / SSO Integral aplica. */
export const PASO0_SSO_FORBIDDEN_AUTH_ROUTE_SEGMENTS = [
  "/auth/login",
  "/auth/register",
  "/auth/signup",
  "/auth/sign-up",
  "/auth/password",
  "/auth/local",
  "/auth/callback",
  "/auth/refresh",
  "/auth/logout",
  "/auth/user",
  "/auth/users",
  "/auth/mfa",
  "/auth/totp",
  "/auth/token",
  "/auth/sso",
  "/auth/session",
  "/auth/verify",
  "/auth/jwks",
  "/.well-known/jwks",
  "/.well-known/openid-configuration",
  "/register",
  "/login",
] as const;

/** Reservado — Workspace Chat no expone endpoints auth propios (D-003); lista vacía. */
export const PASO0_SSO_ALLOWED_AUTH_ROUTE_SEGMENTS = [] as const;

/** Edge cases canónicos §5.2 (EXPECTED-MDD — EC-05…EC-22). */
export const WORKSPACE_CHAT_EDGE_CASES: readonly {
  id: string;
  case: string;
  treatment: string;
  decisionIds: string;
}[] = [
  { id: "EC-05", case: "`ensure_topic` sobre un tema archivado", treatment: "`ensure` es no destructivo: no reactiva; devuelve `accepted` sin efecto", decisionIds: "D-080" },
  { id: "EC-06", case: "Renombrar un tema automático de OBP", treatment: "`409`: `is_renamable=false`", decisionIds: "D-012" },
  { id: "EC-07", case: "Cambiar `encryption_policy` con contenido existente", treatment: "`409`: política inmutable tras primer contenido", decisionIds: "D-089" },
  { id: "EC-08", case: "Analizador antimalware caído en contexto no E2EE", treatment: "Adjuntos `pending`; no se sirven; alerta por cuarentena", decisionIds: "D-086, D-111" },
  { id: "EC-09", case: "Analizador caído en contexto E2EE", treatment: "El contexto rechaza nuevas cargas de adjunto", decisionIds: "D-092" },
  { id: "EC-10", case: "Purga con legal hold parcialmente solapado", treatment: "El hold prevalece sobre su alcance exacto", decisionIds: "D-098" },
  { id: "EC-11", case: "Último administrador contextual se desactiva en SSO", treatment: "Contexto huérfano; `application_admin` reasigna sin leer mensajes", decisionIds: "D-085" },
  { id: "EC-12", case: "Solicitante intenta aprobar su propio `break-glass`", treatment: "`409`: `approved_by <> requested_by`", decisionIds: "D-150" },
  { id: "EC-13", case: "Aprobador de `break-glass` sin scope `global_admin`", treatment: "`403`: sólo gerencia aprueba", decisionIds: "D-150, D-151" },
  { id: "EC-14", case: "Invocación de agente en tema privado sin membresía técnica", treatment: "`403`, aunque el usuario sí esté autorizado", decisionIds: "D-106" },
  { id: "EC-15", case: "Invocación de agente en contexto E2EE", treatment: "`409`: posterior al MVP", decisionIds: "D-107" },
  { id: "EC-16", case: "Búsqueda sin aplicación seleccionada en el cliente central", treatment: "`400`: selección de aplicación obligatoria", decisionIds: "D-157" },
  { id: "EC-17", case: "Consulta de un contexto sin membresía", treatment: "`404`, nunca `403`", decisionIds: "D-160" },
  { id: "EC-18", case: "Mensaje programado cuyo autor pierde acceso antes de publicar", treatment: "No se publica; queda `cancelled` auditado", decisionIds: "D-053" },
  { id: "EC-19", case: "Restauración de backup que contiene contenido purgado", treatment: "Se reaplican tombstones antes de servir", decisionIds: "D-098" },
  { id: "EC-20", case: "Campaña OBP que nunca pasa a inactiva", treatment: "Retención no arranca; señal de anomalía (M-027, R-020)", decisionIds: "D-120" },
  { id: "EC-21", case: "Productor emite antes de persistir", treatment: "No detectable en recepción; discrepancia en M-008 sin acción automática", decisionIds: "D-142, D-143" },
  { id: "EC-22", case: "Servicio de llaves no disponible al ejercer `break-glass` E2EE", treatment: "Solicitud aprobada pero no ejecutable; se registra indisponibilidad", decisionIds: "D-147, R-021" },
];

/** Glosario §5.1 mínimo (EXPECTED-MDD) cuando el extract del pegado no trae entidades. */
export const WORKSPACE_CHAT_GLOSSARY_TERMS: readonly Paso0EntityTerm[] = [
  { term: "Aplicación", definition: "Producto consumidor registrado; frontera de configuración, integración y aislamiento mediante application_id", decisionIds: ["D-002", "D-093", "D-133"] },
  { term: "Contexto", definition: "Entidad o propósito de negocio alrededor del cual se colabora dentro de una aplicación", decisionIds: ["D-002", "D-004"] },
  { term: "Identidad", definition: "Representación de una persona o actor autenticable; para usuarios internos, su fuente es SSO Integral", decisionIds: ["D-003"] },
  { term: "Tema", definition: "Línea de tiempo de conversación perteneciente a un contexto; no es ticket, tarea ni workflow", decisionIds: ["D-015"] },
  { term: "Mensaje", definition: "Unidad de contenido publicada en un tema o subconversación y atribuida a un autor", decisionIds: ["D-124"] },
];

/** Segmentos §4 a eliminar según catálogo (plataforma + auth local si SSO). */
export function listPaso0ForbiddenApiRouteSegmentsForCatalog(
  catalog?: Paso0DecisionCatalog | null,
): readonly string[] {
  const segments: string[] = [...PASO0_FORBIDDEN_API_ROUTE_SEGMENTS];
  if (catalog && catalogRequiresSsoIntegral(catalog)) {
    segments.push(...PASO0_SSO_FORBIDDEN_AUTH_ROUTE_SEGMENTS);
  }
  return segments;
}

export function apiPathMatchesPaso0ForbiddenSegment(
  path: string,
  segments: readonly string[],
  options?: { allowSegments?: readonly string[] },
): boolean {
  const normalized = (path ?? "").toLowerCase().replace(/\{[^}]+\}/g, "*");
  const allow = options?.allowSegments ?? [];
  if (allow.some((seg) => normalized.includes(seg.toLowerCase()))) return false;
  return segments.some((seg) => normalized.includes(seg.toLowerCase()));
}

/** D-121 / EXPECTED-MDD: Strangler Fig implica convivencia operativa permanente — fuera de alcance. */
export function catalogMarksStranglerOutOfScope(catalog: Paso0DecisionCatalog): boolean {
  if (catalog.decisions.some((d) => d.id === "D-121")) return true;
  if (
    catalog.outOfScope.some(
      (o) =>
        /\bstrangler\b/i.test(o.rule) ||
        o.decisionIds?.some((id) => id === "D-121" || id === "D-070"),
    )
  ) {
    return true;
  }
  return catalog.decisions.some(
    (d) =>
      d.id === "D-121" &&
      /\b(convivencia\s+operativa|solo\s+lectura\s+temporal|corte\s+por\s+campaña)\b/i.test(d.rule),
  );
}

/** Valores canónicos D-098 (política de retención Workspace Chat). */
export const PASO0_CANONICAL_RETENTION_MARKERS = [
  "3 meses",
  "6 meses",
  "2 años",
  "2 anos",
  "35 días",
  "35 dias",
  "30 días adicionales",
  "30 dias adicionales",
] as const;

/** Vocabulario que el MDD no debe introducir como concepto de dominio raíz. */
export const PASO0_FORBIDDEN_DOMAIN_VOCABULARY = [
  "tenant como raíz de dominio o tabla `tenants`",
  "canales corporativos generales / tabla `channels` (D-073 fuera de alcance)",
  "modelo Slack de DMs/grupos/canales generales",
  "autenticación local con contraseña, MFA propio o registro de usuarios (D-003 → SSO Integral)",
  "stack fijo (PostgreSQL, NestJS, React, RLS) como requisito — D-162 son propuestas",
] as const;

/** Términos ubicuo §5.1 → entidades sugeridas (snake_case). */
export const PASO0_UBIQUITOUS_TERM_ENTITY: Readonly<Record<string, string>> = {
  aplicacion: "applications",
  aplicaciones: "applications",
  contexto: "contexts",
  identidad: "identities",
  identidades: "identities",
  "membresia contextual": "context_memberships",
  tema: "topics",
  temas: "topics",
  "membresia de tema": "topic_memberships",
  subconversacion: "messages",
  actor: "messages",
  mensaje: "messages",
  mensajes: "messages",
  archivo: "attachments",
  adjunto: "attachments",
  adjuntos: "attachments",
  evento: "business_events",
  "evento de negocio": "business_events",
  reaccion: "reactions",
  mencion: "mentions",
  membresia: "context_memberships",
  agente: "agents",
  agentes: "agents",
};

export const phase0IngestPastedBodySchema = z.object({
  dbgaContent: z.string().min(1),
  source: z.literal("paste"),
});
export type Phase0IngestPastedBody = z.infer<typeof phase0IngestPastedBodySchema>;

const D_ID_RE = /\bD-\d{3}\b/g;

export function extractDecisionIds(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(D_ID_RE)) {
    if (m[0]) found.add(m[0]);
  }
  return [...found].sort();
}

export function isPaso0DecisionCatalogJson(raw: string | null | undefined): boolean {
  const t = raw?.trim() ?? "";
  if (!t.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
    return parsed.kind === PASO0_DECISION_CATALOG_KIND;
  } catch {
    return false;
  }
}

export function isPaso0PasteSidecarJson(raw: string | null | undefined): boolean {
  const t = raw?.trim() ?? "";
  if (!t.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
    return parsed.envelopeKind === PASO0_PASTE_SIDECAR_KIND;
  } catch {
    return false;
  }
}

/** Parsea catálogo desde phase0SummaryContent (catálogo plano o sidecar de pegado). */
export function parsePaso0DecisionCatalog(raw: string | null | undefined): Paso0DecisionCatalog | null {
  const t = raw?.trim() ?? "";
  if (!t.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(t) as unknown;
    const direct = paso0DecisionCatalogSchema.safeParse(parsed);
    if (direct.success) return enrichPaso0DecisionCatalog(direct.data);
    const sidecar = paso0PasteSidecarSchema.safeParse(parsed);
    if (sidecar.success) return enrichPaso0DecisionCatalog(sidecar.data.catalog);
    return null;
  } catch {
    return null;
  }
}

export function serializePaso0PasteSidecar(sidecar: Paso0PasteSidecar): string {
  return JSON.stringify(sidecar, null, 2);
}

export function normalizePaso0UbiquitousTerm(term: string): string {
  return term
    .replace(/`/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function paso0UbiquitousTermToEntitySlug(term: string): string | null {
  const key = normalizePaso0UbiquitousTerm(term);
  if (!key || key.length < 2) return null;
  return PASO0_UBIQUITOUS_TERM_ENTITY[key] ?? null;
}

/** Catálogo Workspace Chat (STEP_0 / EXPECTED-MDD). */
export function isWorkspaceChatPaso0Catalog(catalog: Paso0DecisionCatalog): boolean {
  if ((catalog.canonicalEntities?.length ?? 0) >= 30) return true;
  return (
    (catalog.entities ?? []).some((e) => /workspace\s+chat/i.test(e.term)) ||
    (catalog.decisions.some((d) => d.id === "D-002") && catalog.mvpCapabilities.length >= 15)
  );
}

/** D-162 / filas Propuesta → stack e infra son propuestas, no requisitos. */
export function catalogRequiresStackAsProposal(catalog: Paso0DecisionCatalog): boolean {
  if (catalog.stackFraming === "proposal") return true;
  if (catalog.stackFraming === "decision") return false;
  return catalog.decisions.some(
    (d) =>
      d.id === "D-162" ||
      /propuesta/i.test(`${d.classification ?? ""} ${d.assertionType ?? ""}`),
  );
}

/** Entidades derivadas de términos ubicuo §5.1 + CREATE TABLE en decisiones (sin canónicas fijas). */
export function deriveEntitySlugsFromCatalogTerms(catalog: Paso0DecisionCatalog): string[] {
  const found = new Set<string>();
  for (const entity of catalog.entities) {
    const slug = paso0UbiquitousTermToEntitySlug(entity.term);
    if (slug && !PASO0_FORBIDDEN_ENTITY_TABLES.has(slug)) found.add(slug);
  }
  for (const d of catalog.decisions) {
    for (const m of d.rule.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([a-z_][a-z0-9_]*)/gi)) {
      const table = m[1]?.toLowerCase();
      if (table && !PASO0_FORBIDDEN_ENTITY_TABLES.has(table)) found.add(table);
    }
  }
  return [...found].sort();
}

/** Lista completa de entidades obligatorias §3 cuando hay catálogo Paso 0. */
export function listPaso0MandatoryEntities(catalog: Paso0DecisionCatalog): string[] {
  const canonical =
    catalog.canonicalEntities && catalog.canonicalEntities.length > 0
      ? catalog.canonicalEntities
      : isWorkspaceChatPaso0Catalog(catalog)
        ? [...WORKSPACE_CHAT_CANONICAL_ENTITIES]
        : [];
  const merged = new Set<string>([...canonical, ...deriveEntitySlugsFromCatalogTerms(catalog)]);
  return [...merged]
    .filter((e) => !PASO0_FORBIDDEN_ENTITY_TABLES.has(e.toLowerCase()))
    .sort();
}

/** Familias de rutas §4 obligatorias (MVP / EXPECTED). */
export function listPaso0MandatoryRouteFamilies(
  catalog: Paso0DecisionCatalog,
): readonly Paso0ApiRouteFamily[] {
  if (catalog.mandatoryApiRouteFamilies && catalog.mandatoryApiRouteFamilies.length > 0) {
    return catalog.mandatoryApiRouteFamilies;
  }
  if (isWorkspaceChatPaso0Catalog(catalog)) {
    return WORKSPACE_CHAT_MANDATORY_API_ROUTE_FAMILIES;
  }
  return [];
}

/** Reglas RN-XX para §5 (catálogo o Workspace Chat). */
export function listPaso0BusinessRules(catalog: Paso0DecisionCatalog): readonly Paso0BusinessRule[] {
  if (catalog.businessRules && catalog.businessRules.length > 0) {
    return catalog.businessRules;
  }
  if (isWorkspaceChatPaso0Catalog(catalog)) {
    return WORKSPACE_CHAT_BUSINESS_RULES;
  }
  return [];
}

/** Enriquece catálogo extraído con canónicas Workspace Chat cuando aplica. */
export function enrichPaso0DecisionCatalog(catalog: Paso0DecisionCatalog): Paso0DecisionCatalog {
  if (!isWorkspaceChatPaso0Catalog(catalog)) return catalog;
  return {
    ...catalog,
    entities:
      catalog.entities && catalog.entities.length > 0
        ? catalog.entities
        : [...WORKSPACE_CHAT_GLOSSARY_TERMS],
    canonicalEntities:
      catalog.canonicalEntities && catalog.canonicalEntities.length > 0
        ? catalog.canonicalEntities
        : [...WORKSPACE_CHAT_CANONICAL_ENTITIES],
    mandatoryApiRouteFamilies:
      catalog.mandatoryApiRouteFamilies && catalog.mandatoryApiRouteFamilies.length > 0
        ? catalog.mandatoryApiRouteFamilies
        : [...WORKSPACE_CHAT_MANDATORY_API_ROUTE_FAMILIES],
    businessRules:
      catalog.businessRules && catalog.businessRules.length > 0
        ? catalog.businessRules
        : [...WORKSPACE_CHAT_BUSINESS_RULES],
    stackFraming: catalogRequiresStackAsProposal(catalog) ? "proposal" : "decision",
  };
}

/** Entidades sugeridas derivadas del catálogo (§5.1 + canónicas obligatorias). */
export function catalogToSuggestedEntitySlugs(catalog: Paso0DecisionCatalog): string[] {
  return listPaso0MandatoryEntities(catalog);
}

export function isPaso0ForbiddenEntityTable(
  entity: string,
  _catalog?: Paso0DecisionCatalog | null,
): boolean {
  return PASO0_FORBIDDEN_ENTITY_TABLES.has(entity.toLowerCase());
}

/** D-003 / SSO Integral: sin contraseñas locales ni registro propio de usuarios. */
export function catalogRequiresSsoIntegral(catalog: Paso0DecisionCatalog): boolean {
  return catalog.decisions.some(
    (d) => d.id === "D-003" || /\bsso\s+integral\b/i.test(d.rule),
  );
}

/** D-088 / cliente móvil solo en línea: sin PWA, cola offline ni historial local. */
export function catalogRequiresMobileOnlineOnly(catalog: Paso0DecisionCatalog): boolean {
  return catalog.decisions.some(
    (d) =>
      d.id === "D-088" ||
      /\b(solo\s+en\s+l[ií]nea|online[- ]only|sin\s+historial\s+local|sin\s+cola\s+offline)\b/i.test(
        d.rule,
      ),
  );
}

/** Patrones §2 incompatibles con D-088 (offline-first / PWA / cola local). */
export const PASO0_OFFLINE_FIRST_PATTERNS: readonly RegExp[] = [
  /\b(pwa|progressive\s+web\s+app)\b/i,
  /\bservice\s+worker/i,
  /\boffline[- ]first\b/i,
  /\bcola\s+offline\b/i,
  /\boffline\s+(?:queue|cola)\b/i,
  /\b(historial|mensajes|messages)\s+local(es)?\b/i,
  /\bencol(ar|a)\s+(acciones|mensajes|reacciones)[^\n.]{0,40}offline\b/i,
  /\bindexeddb\b[^\n.]{0,60}\b(historial|cache|mensajes|messages)\b/i,
  /\bbackground\s+sync\b/i,
  /\bsync\s+queue\b/i,
  /\blocal\s+storage\b[^\n.]{0,40}\b(historial|mensajes|messages)\b/i,
];

/** Notas D-162 / filas Propuesta — stack concreto no vinculante. */
export function catalogStackProposalNotes(catalog: Paso0DecisionCatalog): string[] {
  const notes = new Set<string>([
    "D-162: tecnologías concretas (PostgreSQL, RLS, React/Next.js, NestJS, etc.) son PROPUESTAS — documentar como opciones, no como requisitos fijos.",
  ]);
  for (const d of catalog.decisions) {
    const kind = `${d.classification ?? ""} ${d.assertionType ?? ""}`;
    if (!/propuesta/i.test(kind)) continue;
    if (/\b(postgres|postgresql|react|nestjs|redis|rls|next\.js|prisma|docker|kubernetes)\b/i.test(d.rule)) {
      notes.add(`${d.id}: ${d.rule.slice(0, 140)}${d.rule.length > 140 ? "…" : ""}`);
    }
  }
  return [...notes].slice(0, 10);
}

/** Bloque de guardrails para prompts MDD (entidades canónicas + prohibidas + D-162). */
export function formatPaso0CatalogGuardBlock(
  catalog: Paso0DecisionCatalog,
  maxChars = 4_500,
): string {
  const enriched = enrichPaso0DecisionCatalog(catalog);
  const canonical = enriched.entities
    .slice(0, 35)
    .map((e) => `- **${e.term}:** ${e.definition.slice(0, 120)}${e.definition.length > 120 ? "…" : ""}`)
    .join("\n");
  const mandatory = listPaso0MandatoryEntities(enriched);
  const routeFamilies = listPaso0MandatoryRouteFamilies(enriched)
    .filter((f) => f.critical)
    .map((f) => `- ${f.label}: ${f.pathPatterns.join(", ")} (${f.methods?.join("/") ?? "any"})`)
    .join("\n");
  const outOfScope = enriched.outOfScope
    .slice(0, 12)
    .map((o) => `- ${o.rule.slice(0, 100)}${o.rule.length > 100 ? "…" : ""}`)
    .join("\n");
  const stackNotes = catalogStackProposalNotes(enriched).map((n) => `- ${n}`).join("\n");
  const stackFramingNote = catalogRequiresStackAsProposal(enriched)
    ? "**Stack §2/§7 = PROPUESTA (D-162):** documentar tecnologías como opciones, no requisitos fijos."
    : "";

  const lines = [
    "**Guardrails Paso 0 (catálogo D-ID — obligatorio):**",
    "",
    "1. **No inventes** entidades, tablas ni capacidades fuera del catálogo y del DBGA pegado.",
    "2. Usa el lenguaje ubicuo §5.1; no sustituyas por vocabulario genérico de plataforma (tenants/channels/conversations).",
    "3. Identidad = SSO Integral (D-003); aislamiento = `application_id` (D-093), no multi-tenant SaaS.",
    "4. **§3 SQL:** incluye TODAS las tablas canónicas listadas abajo con columnas de dominio (no stubs vacíos).",
    "5. **§4 API:** incluye familias de rutas MVP obligatorias (ingest/events, attachments, break-glass, ws, migration).",
    stackFramingNote,
    "",
    "**Términos canónicos (muestra §5.1):**",
    canonical || "(sin términos)",
    "",
    `**Entidades canónicas obligatorias §3 (${mandatory.length}):** ${mandatory.join(", ") || "(ninguna)"}`,
    "",
    "**Familias de rutas MVP críticas §4:**",
    routeFamilies || "(derivar del catálogo MVP)",
    "",
    "**Prohibido como raíz de dominio:**",
    ...PASO0_FORBIDDEN_DOMAIN_VOCABULARY.map((v) => `- ${v}`),
    "",
    "**Fuera de alcance (muestra §3.3):**",
    outOfScope || "(sin filas)",
    "",
    "**Stack / propuestas (no fijar como requisito):**",
    stackNotes,
  ].filter(Boolean);

  const text = lines.join("\n");
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n…[guardrails truncados]`;
}

/** Bloque §5: reglas RN-XX en formato BDD para el nodo section5. */
export function formatPaso0BusinessRulesForSection5(
  catalog: Paso0DecisionCatalog,
  maxRules = 25,
  maxChars = 6_000,
): string {
  const rules = listPaso0BusinessRules(enrichPaso0DecisionCatalog(catalog)).slice(0, maxRules);
  if (rules.length === 0) return "";
  const lines = [
    "**Reglas de negocio obligatorias del Paso 0 (formato RN-XX — incluir en §5):**",
    "",
    ...rules.map((r) => {
      const ids = r.decisionIds?.length ? ` (${r.decisionIds.join(", ")})` : "";
      const bdd = r.givenWhenThen ? `\n  ${r.givenWhenThen}` : "";
      return `- **${r.id} — ${r.title}**${ids}${bdd}`;
    }),
    "",
    "Genera §5 con al menos estas reglas en formato Dado/Cuando/Entonces y edge cases EC-XX alineados.",
  ];
  const text = lines.join("\n");
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n…[reglas truncadas]`;
}

/** Bloque arquitecto: checklist entidades + rutas MVP. */
export function formatPaso0ArchitectMandatoryBlock(
  catalog: Paso0DecisionCatalog,
  maxChars = 3_500,
): string {
  const enriched = enrichPaso0DecisionCatalog(catalog);
  const entities = listPaso0MandatoryEntities(enriched);
  const routes = listPaso0MandatoryRouteFamilies(enriched);
  const lines = [
    "**Checklist Paso 0 — generación obligatoria (no solo enforcement):**",
    "",
    `§3: CREATE TABLE para las ${entities.length} entidades canónicas: ${entities.slice(0, 40).join(", ")}${entities.length > 40 ? "…" : ""}`,
    "",
    "§4: familias de endpoints MVP:",
    ...routes.map(
      (f) =>
        `- **${f.label}** [${f.id}]: ${f.pathPatterns.join(", ")} (${f.methods?.join(", ") ?? "*"})`,
    ),
    "",
    catalogRequiresStackAsProposal(enriched)
      ? "§2/§7: stack e infraestructura como **PROPUESTA (D-162)** — no PostgreSQL/NestJS/React como requisito fijo."
      : "",
    "Prohibido inventar tablas tenants/channels/conversations/llm_configs como dominio.",
  ].filter(Boolean);
  const text = lines.join("\n");
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n…[checklist truncado]`;
}

export type Paso0AlignmentScore = {
  score: number;
  missingEntities: string[];
  missingCriticalRoutes: string[];
  entityCoverage: number;
  routeCoverage: number;
};

/** Puntuación 0–100 de alineación MDD vs catálogo/EXPECTED (logging / gate auxiliar). */
export function scorePaso0ExpectedAlignment(
  catalog: Paso0DecisionCatalog,
  mddMarkdown: string,
): Paso0AlignmentScore {
  const enriched = enrichPaso0DecisionCatalog(catalog);
  const section3 = (mddMarkdown ?? "").toLowerCase();
  const section4 = (mddMarkdown ?? "").toLowerCase();
  const mandatory = listPaso0MandatoryEntities(enriched);
  const missingEntities = mandatory.filter(
    (e) => !new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?["']?${e}["']?\\s*\\(`, "i").test(section3),
  );
  const criticalRoutes = listPaso0MandatoryRouteFamilies(enriched).filter((f) => f.critical);
  const missingCriticalRoutes = criticalRoutes.filter((f) =>
    f.pathPatterns.every((p) => !section4.includes(p.toLowerCase())),
  );
  const entityCoverage =
    mandatory.length === 0 ? 1 : (mandatory.length - missingEntities.length) / mandatory.length;
  const routeCoverage =
    criticalRoutes.length === 0
      ? 1
      : (criticalRoutes.length - missingCriticalRoutes.length) / criticalRoutes.length;
  const score = Math.round(entityCoverage * 55 + routeCoverage * 45);
  return {
    score: Math.max(0, Math.min(100, score)),
    missingEntities,
    missingCriticalRoutes: missingCriticalRoutes.map((f) => f.id),
    entityCoverage,
    routeCoverage,
  };
}

/**
 * Al persistir Deep Research u otro markdown en phase0SummaryContent,
 * conserva el sidecar paso0_paste_sidecar (catálogo D-ID) si ya existía.
 */
export function mergePhase0SummaryPreservePaso0Sidecar(
  existing: string | null | undefined,
  incomingMarkdown: string,
): string {
  const incoming = incomingMarkdown.trim();
  if (!incoming) return existing?.trim() ?? "";
  const prev = existing?.trim() ?? "";
  if (!isPaso0PasteSidecarJson(prev)) return incoming;

  try {
    const parsed = paso0PasteSidecarSchema.parse(JSON.parse(prev) as unknown);
    return serializePaso0PasteSidecar({
      ...parsed,
      deepResearchMarkdown: incoming,
    });
  } catch {
    return incoming;
  }
}
