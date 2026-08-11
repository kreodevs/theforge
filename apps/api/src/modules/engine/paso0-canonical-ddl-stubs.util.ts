/**
 * DDL mínimo canónico para entidades Paso 0 ausentes en §3 (Workspace Chat / EXPECTED-MDD).
 * Solo se inyecta post-arquitecto para tablas obligatorias — no stubs vacíos tipo channels.
 */

import {
  listPaso0MandatoryEntities,
  PASO0_INVENTED_PLATFORM_TABLES,
  WORKSPACE_CHAT_CANONICAL_ENTITIES,
  isWorkspaceChatPaso0Catalog,
  type Paso0DecisionCatalog,
} from "@theforge/shared-types";

/** Stubs con columnas de dominio mínimas (no id/created_at solos). */
const WORKSPACE_CHAT_DDL_STUBS: Readonly<Record<string, string>> = {
  applications: `-- D-133, D-134: aplicación consumidora (stub canónico Paso 0)
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  functional_owner_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  default_admin_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_policy_id UUID NOT NULL REFERENCES retention_policies(id) ON DELETE RESTRICT,
  default_encryption VARCHAR(20) NOT NULL DEFAULT 'none',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  registered_by UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_at TIMESTAMPTZ,
  CONSTRAINT chk_app_encryption CHECK (default_encryption IN ('none','e2ee')),
  CONSTRAINT chk_app_status CHECK (status IN ('active','suspended'))
);`,
  identities: `-- D-003: identidad SSO (stub canónico Paso 0)
CREATE TABLE identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sso_subject VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  is_historical BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  CONSTRAINT chk_identity_status CHECK (status IN ('active','deactivated')),
  CONSTRAINT chk_identity_historical CHECK (NOT (is_historical AND status = 'active'))
);`,
  platform_scopes: `-- D-082, D-151: scopes plataforma (stub canónico Paso 0)
CREATE TABLE platform_scopes (
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  scope VARCHAR(40) NOT NULL,
  application_id UUID REFERENCES applications(id) ON DELETE RESTRICT,
  granted_by UUID NOT NULL REFERENCES identities(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (identity_id, scope, COALESCE(application_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  CONSTRAINT chk_scope CHECK (scope IN ('global_admin','security_compliance','application_admin','support')),
  CONSTRAINT chk_scope_app CHECK (
    (scope IN ('application_admin','support') AND application_id IS NOT NULL) OR
    (scope IN ('global_admin','security_compliance') AND application_id IS NULL)
  )
);`,
  contexts: `-- D-002, D-004, D-136: contexto colaboración (stub canónico Paso 0)
CREATE TABLE contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_type VARCHAR(100) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  encryption_policy VARCHAR(20) NOT NULL DEFAULT 'none',
  encryption_locked_at TIMESTAMPTZ,
  lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'active',
  archived_at TIMESTAMPTZ,
  archive_reason VARCHAR(40),
  retention_clock_start TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_context_identity UNIQUE (application_id, context_type, external_id),
  CONSTRAINT chk_ctx_encryption CHECK (encryption_policy IN ('none','e2ee')),
  CONSTRAINT chk_ctx_lifecycle CHECK (lifecycle_status IN ('active','archived'))
);`,
  topics: `-- D-011, D-014, D-045: temas (stub canónico Paso 0)
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id UUID NOT NULL REFERENCES contexts(id) ON DELETE RESTRICT,
  topic_key VARCHAR(120),
  display_name VARCHAR(255) NOT NULL,
  origin VARCHAR(20) NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  privacy_locked_at TIMESTAMPTZ,
  is_renamable BOOLEAN NOT NULL DEFAULT true,
  is_archivable BOOLEAN NOT NULL DEFAULT true,
  subconversations_enabled BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES identities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT uq_topic_key UNIQUE (context_id, topic_key),
  CONSTRAINT chk_topic_origin CHECK (origin IN ('default','application','manual')),
  CONSTRAINT chk_topic_vis CHECK (visibility IN ('public','private')),
  CONSTRAINT chk_topic_status CHECK (status IN ('active','archived'))
);`,
  attachments: `-- D-125, D-086: cuarentena obligatoria (stub canónico Paso 0)
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  message_id UUID REFERENCES messages(id) ON DELETE RESTRICT,
  uploaded_by UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  media_ref VARCHAR(500) NOT NULL,
  declared_mime VARCHAR(160) NOT NULL,
  file_extension VARCHAR(20) NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL,
  scan_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  purge_after TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_att_scan CHECK (scan_status IN ('pending','clean','blocked','unscannable'))
);`,
  business_events: `-- D-080, D-141: ingesta idempotente (stub canónico Paso 0)
CREATE TABLE business_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  source_application VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(160) NOT NULL,
  schema_version INTEGER NOT NULL,
  intent VARCHAR(40) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL,
  reception_result VARCHAR(20) NOT NULL DEFAULT 'accepted',
  CONSTRAINT uq_event_dedup UNIQUE (source_application, event_id)
);`,
  outbox: `-- D-010: outbox transaccional (stub canónico Paso 0)
CREATE TABLE outbox (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  aggregate_type VARCHAR(60) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL,
  partition_key VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0
);`,
  messages: `-- D-124: mensajes / subconversaciones (stub canónico Paso 0)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  author_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
  break_glass_requests: `-- D-083, D-150: acceso break-glass (stub canónico Paso 0)
CREATE TABLE break_glass_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id UUID REFERENCES contexts(id) ON DELETE RESTRICT,
  requested_by UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES identities(id),
  reason TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_bg_status CHECK (status IN ('pending','approved','rejected','expired','completed'))
);`,
  export_requests: `-- D-150: exportación gobernada (stub canónico Paso 0)
CREATE TABLE export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id UUID REFERENCES contexts(id),
  topic_id UUID REFERENCES topics(id),
  requested_by UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES identities(id),
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  manifest_path VARCHAR(500),
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_export_status CHECK (status IN ('pending','approved','rejected','completed'))
);`,
  migration_jobs: `-- D-119, D-121: migración OBP (stub canónico Paso 0)
CREATE TABLE migration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  external_campaign_id VARCHAR(255) NOT NULL,
  phase VARCHAR(40) NOT NULL DEFAULT 'planned',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_mig_phase CHECK (phase IN ('planned','freeze','delta','readonly','completed'))
);`,
  migration_items: `-- D-119: ítems de migración (stub canónico Paso 0)
CREATE TABLE migration_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES migration_jobs(id) ON DELETE RESTRICT,
  source_ref VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
  read_states: `-- D-030: contadores no leídos (stub canónico Paso 0)
CREATE TABLE read_states (
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  last_read_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (identity_id, topic_id)
);`,
  notification_intents: `-- D-061: notificaciones (stub canónico Paso 0)
CREATE TABLE notification_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id UUID NOT NULL REFERENCES contexts(id) ON DELETE RESTRICT,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  recipient_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  reason VARCHAR(40) NOT NULL,
  deep_link VARCHAR(1000) NOT NULL,
  includes_body BOOLEAN NOT NULL DEFAULT false,
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_notif_reason CHECK (reason IN ('mention','activity','business_event','agent_answer'))
);`,
  pinned_messages: `-- D-054: mensajes fijados (stub canónico Paso 0)
CREATE TABLE pinned_messages (
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  pinned_by UUID NOT NULL REFERENCES identities(id),
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, message_id)
);`,
  purge_tombstones: `-- D-098: tombstone post-purga (stub canónico Paso 0)
CREATE TABLE purge_tombstones (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  resource_type VARCHAR(60) NOT NULL,
  resource_id UUID NOT NULL,
  purged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_version INTEGER NOT NULL
);`,
  agents: `-- D-103: agente externo MCP (stub canónico Paso 0)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  display_name VARCHAR(255) NOT NULL,
  mcp_server_ref VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
  agent_invocations: `-- D-103, D-106: invocación agente (stub canónico Paso 0)
CREATE TABLE agent_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  invoked_by UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
  retention_policies: `-- D-098: política retención (stub canónico Paso 0)
CREATE TABLE retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  visible_days INTEGER NOT NULL DEFAULT 90,
  operational_days INTEGER NOT NULL DEFAULT 180,
  audit_days INTEGER NOT NULL DEFAULT 730,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
  audit_entries: `-- D-098: auditoría (stub canónico Paso 0)
CREATE TABLE audit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE RESTRICT,
  actor_id UUID REFERENCES identities(id),
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(60) NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
};

/** Entidades cuyo DDL debe preceder a dependientes (FK) en stubs concatenados. */
const PASO0_DDL_EARLY_ENTITIES = ["retention_policies", "identities"] as const;

function reorderPaso0StubEntitiesForFk(entities: readonly string[]): string[] {
  const earlySet = new Set<string>(PASO0_DDL_EARLY_ENTITIES);
  const early = PASO0_DDL_EARLY_ENTITIES.filter((e) => entities.includes(e));
  const rest = entities.filter((e) => !earlySet.has(e));
  return [...early, ...rest];
}

function paso0GenericMinimalStub(entity: string): string {
  if (entity === "applications") {
    return WORKSPACE_CHAT_DDL_STUBS.applications!;
  }
  if (entity.endsWith("_memberships") || entity.endsWith("_members")) {
    return `CREATE TABLE ${entity} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
  }
  if (entity.startsWith("application_")) {
    return `CREATE TABLE ${entity} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
  }
  return `CREATE TABLE ${entity} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
}

/** DDL canónico para entidad obligatoria ausente (undefined si debe omitirse). */
export function paso0CanonicalCreateTableStub(
  entity: string,
  paso0Catalog?: Paso0DecisionCatalog | null,
): string | undefined {
  const e = entity.toLowerCase();
  if (PASO0_INVENTED_PLATFORM_TABLES.has(e)) return undefined;
  if (WORKSPACE_CHAT_DDL_STUBS[e]) return WORKSPACE_CHAT_DDL_STUBS[e];
  if (paso0Catalog && listPaso0MandatoryEntities(paso0Catalog).includes(e)) {
    return paso0GenericMinimalStub(e);
  }
  return undefined;
}

/** SQL concatenado para entidades obligatorias faltantes. */
export function composePaso0CanonicalStubsSql(
  missingEntities: string[],
  paso0Catalog: Paso0DecisionCatalog,
): string {
  const parts: string[] = [];
  for (const entity of reorderPaso0StubEntitiesForFk(missingEntities)) {
    const stub = paso0CanonicalCreateTableStub(entity, paso0Catalog);
    if (stub) parts.push(stub);
  }
  return parts.join("\n\n");
}

/**
 * DDL canónico completo §3 (orden FK Workspace Chat) — reemplazo determinista cuando el LLM corrompe SQL.
 */
export function composeFullPaso0Section3CanonicalSql(catalog: Paso0DecisionCatalog): string {
  const mandatory = new Set(listPaso0MandatoryEntities(catalog));
  const ordered = isWorkspaceChatPaso0Catalog(catalog)
    ? WORKSPACE_CHAT_CANONICAL_ENTITIES.filter((e) => mandatory.has(e))
    : listPaso0MandatoryEntities(catalog);
  return composePaso0CanonicalStubsSql(reorderPaso0StubEntitiesForFk([...ordered]), catalog);
}
