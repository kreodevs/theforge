# Data model draft — §3

## 3. Modelo de Datos

**Invariantes del esquema**, exigibles a cualquier motor (D-093, D-162):

1. **Toda tabla de dominio lleva `application_id` obligatorio.** No existe `tenant_id`
   (D-095). El `application_id` autorizado proviene del token o la sesión, **nunca** de un
   valor libre del cliente.
2. **Segunda barrera a nivel de datos** independiente de la autorización de aplicación.
3. **No existe borrado físico de contenido ni de contextos.** Sólo `deleted_at`,
   `archived_at` y tombstones (D-023, D-136). Las claves foráneas usan `RESTRICT`, nunca
   `CASCADE`, sobre entidades con historial.
4. Fechas en `TIMESTAMPTZ`; identificadores UUID.
5. Todo cambio relevante genera entrada en `audit_entries` (D-098).

### 3.1 Aplicaciones consumidoras

```sql
-- D-133, D-134: alta por administrador global con cuatro elementos obligatorios
CREATE TABLE applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  VARCHAR(100) NOT NULL UNIQUE,
  display_name          VARCHAR(255) NOT NULL,
  -- (a) responsable funcional designado en el alta — D-134a, D-085
  functional_owner_id   UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  -- (b) política de administradores predeterminados — D-134b
  default_admin_policy  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- (c) políticas fijadas en el alta, antes de que exista contenido — D-134c
  retention_policy_id   UUID NOT NULL REFERENCES retention_policies(id) ON DELETE RESTRICT,
  default_encryption    VARCHAR(20) NOT NULL DEFAULT 'none',
  status                VARCHAR(20) NOT NULL DEFAULT 'active',
  registered_by         UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  registered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_at          TIMESTAMPTZ,
  CONSTRAINT chk_app_encryption CHECK (default_encryption IN ('none','e2ee')),
  CONSTRAINT chk_app_status     CHECK (status IN ('active','suspended'))
);

-- D-134d, D-135: credenciales propias de aplicación, distintas de la identidad de personas
CREATE TABLE application_credentials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  client_id         VARCHAR(100) NOT NULL UNIQUE,
  secret_hash       VARCHAR(255) NOT NULL,
  allowed_origins   TEXT[] NOT NULL DEFAULT '{}',
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at        TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  CONSTRAINT chk_appcred_rotation CHECK (revoked_at IS NULL OR revoked_at >= issued_at)
);

-- D-145: activación modular de capacidades por aplicación
CREATE TABLE application_capabilities (
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  capability_key  VARCHAR(80) NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  updated_by      UUID REFERENCES identities(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, capability_key)
);
```

### 3.2 Identidad y scopes

```sql
-- D-003: la identidad de personas proviene de SSO Integral. Sin contraseñas ni MFA propios.
CREATE TABLE identities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sso_subject      VARCHAR(255) NOT NULL UNIQUE,
  display_name     VARCHAR(255) NOT NULL,
  email            VARCHAR(255),
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  -- D-120: atribución histórica no resoluble; conserva autoría sin sesión ni permisos
  is_historical    BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at   TIMESTAMPTZ,
  CONSTRAINT chk_identity_status CHECK (status IN ('active','deactivated')),
  CONSTRAINT chk_identity_historical CHECK (NOT (is_historical AND status = 'active'))
);

-- D-082, D-151: scopes de plataforma separados, ejercidos por niveles del equipo
CREATE TABLE platform_scopes (
  identity_id    UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  scope          VARCHAR(40) NOT NULL,
  application_id UUID REFERENCES applications(id) ON DELETE RESTRICT,
  granted_by     UUID NOT NULL REFERENCES identities(id),
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at     TIMESTAMPTZ,
  PRIMARY KEY (identity_id, scope, COALESCE(application_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  CONSTRAINT chk_scope CHECK (scope IN ('global_admin','security_compliance','application_admin','support')),
  -- application_admin y support se acotan a una aplicación; los demás son globales
  CONSTRAINT chk_scope_app CHECK (
    (scope IN ('application_admin','support') AND application_id IS NOT NULL) OR
    (scope IN ('global_admin','security_compliance') AND application_id IS NULL)
  )
);
```

### 3.3 Contextos y temas

```sql
-- D-002, D-004, D-136, D-137
CREATE TABLE contexts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_type          VARCHAR(100) NOT NULL,
  external_id           VARCHAR(255) NOT NULL,   -- D-137: INMUTABLE
  display_name          VARCHAR(255) NOT NULL,   -- D-137: actualizable por el productor
  -- D-089: política de cifrado fijada antes del contenido; inmutable después
  encryption_policy     VARCHAR(20) NOT NULL DEFAULT 'none',
  encryption_locked_at  TIMESTAMPTZ,
  -- D-136: nunca se elimina; sólo se archiva
  lifecycle_status      VARCHAR(20) NOT NULL DEFAULT 'active',
  archived_at           TIMESTAMPTZ,
  archive_reason        VARCHAR(40),
  -- D-120: reloj de retención OBP; arranca al dejar de estar activo
  retention_clock_start TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_context_identity UNIQUE (application_id, context_type, external_id),
  CONSTRAINT chk_ctx_encryption CHECK (encryption_policy IN ('none','e2ee')),
  CONSTRAINT chk_ctx_lifecycle  CHECK (lifecycle_status IN ('active','archived')),
  CONSTRAINT chk_ctx_archive    CHECK (archive_reason IS NULL OR archive_reason IN
    ('manual','source_object_deleted','superseded')),
  CONSTRAINT chk_ctx_archived   CHECK (
    (lifecycle_status = 'archived' AND archived_at IS NOT NULL) OR
    (lifecycle_status = 'active'   AND archived_at IS NULL))
);
-- Regla aplicativa D-137: UPDATE sobre external_id, application_id o context_type se rechaza.
-- Regla aplicativa D-089: UPDATE sobre encryption_policy se rechaza si encryption_locked_at IS NOT NULL.
-- Regla aplicativa D-138: no existe operación de fusión ni división de contextos.

-- D-016, D-017: fotografía histórica de membresía
CREATE TABLE context_memberships (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id     UUID NOT NULL REFERENCES contexts(id) ON DELETE RESTRICT,
  identity_id    UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  role           VARCHAR(20) NOT NULL DEFAULT 'member',
  membership_origin VARCHAR(30) NOT NULL DEFAULT 'application',
  added_by       UUID REFERENCES identities(id),
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at     TIMESTAMPTZ,
  CONSTRAINT uq_ctx_member UNIQUE (context_id, identity_id),
  CONSTRAINT chk_ctx_role   CHECK (role IN ('context_admin','member','read_only')),
  CONSTRAINT chk_ctx_origin CHECK (membership_origin IN
    ('application','manual','default_policy','migration'))
);

-- D-011, D-014, D-045, D-081, D-012, D-013
CREATE TABLE topics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id        UUID NOT NULL REFERENCES contexts(id) ON DELETE RESTRICT,
  topic_key         VARCHAR(120),            -- estable dentro del contexto; sólo origin='application'
  display_name      VARCHAR(255) NOT NULL,
  origin            VARCHAR(20) NOT NULL,    -- D-011/D-014: default | application | manual
  visibility        VARCHAR(20) NOT NULL DEFAULT 'public',
  -- D-081: el primer mensaje fija la privacidad
  privacy_locked_at TIMESTAMPTZ,
  -- D-012: los temas administrados por aplicación no se renombran ni eliminan
  is_renamable      BOOLEAN NOT NULL DEFAULT true,
  is_archivable     BOOLEAN NOT NULL DEFAULT true,
  -- D-047: subconversaciones configurables por aplicación/contexto
  subconversations_enabled BOOLEAN NOT NULL DEFAULT true,
  status            VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by        UUID REFERENCES identities(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at       TIMESTAMPTZ,
  CONSTRAINT uq_topic_key   UNIQUE (context_id, topic_key),
  CONSTRAINT chk_topic_origin CHECK (origin IN ('default','application','manual')),
  CONSTRAINT chk_topic_vis    CHECK (visibility IN ('public','private')),
  CONSTRAINT chk_topic_status CHECK (status IN ('active','archived')),
  -- D-011: General siempre público. D-079: los de aplicación también
  CONSTRAINT chk_topic_public CHECK (
    (origin IN ('default','application') AND visibility = 'public') OR origin = 'manual'),
  -- D-014: sólo los manuales tienen creador humano
  CONSTRAINT chk_topic_creator CHECK (
    (origin = 'manual' AND created_by IS NOT NULL) OR origin <> 'manual'),
  CONSTRAINT chk_topic_key_origin CHECK (
    (origin = 'application' AND topic_key IS NOT NULL) OR origin <> 'application')
);
-- Regla aplicativa D-011: crear un contexto crea su tema General (origin='default').
-- Regla aplicativa D-081: UPDATE sobre visibility se rechaza si privacy_locked_at IS NOT NULL.
-- Regla aplicativa D-012: UPDATE de display_name se rechaza si is_renamable = false.

-- D-045: membresía explícita, sólo para temas privados
CREATE TABLE topic_memberships (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  topic_id       UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  identity_id    UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  added_by       UUID NOT NULL REFERENCES identities(id),
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at     TIMESTAMPTZ,
  CONSTRAINT uq_topic_member UNIQUE (topic_id, identity_id)
);

-- D-158: etiquetas de mención definidas DENTRO de Workspace Chat, sin catálogo externo
CREATE TABLE mention_labels (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id     UUID NOT NULL REFERENCES contexts(id) ON DELETE RESTRICT,
  label          VARCHAR(80) NOT NULL,
  created_by     UUID NOT NULL REFERENCES identities(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_mention_label UNIQUE (context_id, label)
);

CREATE TABLE mention_label_members (
  label_id    UUID NOT NULL REFERENCES mention_labels(id) ON DELETE RESTRICT,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  PRIMARY KEY (label_id, identity_id)
);
```

### 3.4 Mensajería y contenido

```sql
-- D-124, D-006, D-047, D-053
CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id        UUID NOT NULL REFERENCES contexts(id) ON DELETE RESTRICT,
  topic_id          UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  -- D-047: subconversación = mensaje raíz dentro del MISMO tema
  root_message_id   UUID REFERENCES messages(id) ON DELETE RESTRICT,
  quoted_message_id UUID REFERENCES messages(id) ON DELETE RESTRICT,
  -- D-006: actores humanos, de aplicación, de sistema y de agente comparten cronología
  actor_type        VARCHAR(20) NOT NULL,
  author_id         UUID REFERENCES identities(id) ON DELETE RESTRICT,
  agent_id          UUID REFERENCES agents(id) ON DELETE RESTRICT,
  message_kind      VARCHAR(20) NOT NULL DEFAULT 'text',
  -- Contenido: texto plano o ciphertext, nunca ambos (D-092)
  body              TEXT,
  ciphertext        BYTEA,
  crypto_envelope   JSONB,
  is_e2ee           BOOLEAN NOT NULL DEFAULT false,
  -- D-057: rich card renderizada por tipo y versión
  card_type         VARCHAR(80),
  card_version      INTEGER,
  card_payload      JSONB,
  -- D-053: estado de entrega, no tipo de contenido
  scheduled_for     TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  delivery_status   VARCHAR(20) NOT NULL DEFAULT 'published',
  -- D-023: edición y eliminación lógicas y auditadas
  edited_at         TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES identities(id),
  -- D-025: los eventos de negocio son inmutables desde Chat
  business_event_id UUID REFERENCES business_events(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_msg_actor CHECK (actor_type IN ('user','application','system','agent')),
  CONSTRAINT chk_msg_kind  CHECK (message_kind IN ('text','business_event','rich_card','agent_question','agent_answer')),
  CONSTRAINT chk_msg_delivery CHECK (delivery_status IN ('scheduled','published','cancelled','blocked')),
  CONSTRAINT chk_msg_content CHECK (
    (is_e2ee AND ciphertext IS NOT NULL AND body IS NULL) OR
    (NOT is_e2ee AND (body IS NOT NULL OR card_payload IS NOT NULL))),
  CONSTRAINT chk_msg_author CHECK (
    (actor_type = 'user'  AND author_id IS NOT NULL) OR
    (actor_type = 'agent' AND agent_id  IS NOT NULL) OR
    (actor_type IN ('application','system'))),
  CONSTRAINT chk_msg_scheduled CHECK (
    (delivery_status = 'scheduled' AND scheduled_for IS NOT NULL) OR delivery_status <> 'scheduled')
);
-- Regla aplicativa D-047: root_message_id debe pertenecer al mismo topic_id.
-- Regla aplicativa D-025: UPDATE/DELETE se rechaza si business_event_id IS NOT NULL.
-- Regla aplicativa D-081: el primer INSERT en un tema fija topics.privacy_locked_at.

-- D-023: historial de ediciones, conservado durante su plazo (D-098)
CREATE TABLE message_revisions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  message_id     UUID NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
  previous_body  TEXT,
  previous_ciphertext BYTEA,
  edited_by      UUID NOT NULL REFERENCES identities(id),
  edited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  purge_after    TIMESTAMPTZ NOT NULL
);

-- D-124
CREATE TABLE reactions (
  message_id     UUID NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
  identity_id    UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  emoji          VARCHAR(40) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, identity_id, emoji)
);

-- D-055, D-158
CREATE TABLE mentions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  message_id     UUID NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
  mention_type   VARCHAR(20) NOT NULL,
  identity_id    UUID REFERENCES identities(id) ON DELETE RESTRICT,
  label_id       UUID REFERENCES mention_labels(id) ON DELETE RESTRICT,
  CONSTRAINT chk_mention_type CHECK (mention_type IN ('identity','label','everyone')),
  CONSTRAINT chk_mention_target CHECK (
    (mention_type = 'identity' AND identity_id IS NOT NULL) OR
    (mention_type = 'label'    AND label_id    IS NOT NULL) OR
    (mention_type = 'everyone'))
);

-- D-054: fijados; la semántica visual y los límites de cola se difieren al diseño (DF-002)
CREATE TABLE pinned_messages (
  topic_id       UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  message_id     UUID NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  pinned_by      UUID NOT NULL REFERENCES identities(id),
  pinned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, message_id)
);

-- D-125, D-086: cuarentena obligatoria. El binario vive en el almacén de objetos.
CREATE TABLE attachments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  message_id        UUID REFERENCES messages(id) ON DELETE RESTRICT,
  uploaded_by       UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  media_ref         VARCHAR(500) NOT NULL,
  declared_mime     VARCHAR(160) NOT NULL,
  detected_mime     VARCHAR(160),
  file_extension    VARCHAR(20) NOT NULL,
  size_bytes        BIGINT NOT NULL,
  checksum_sha256   VARCHAR(64) NOT NULL,
  -- D-086: máquina de estados de cuarentena
  scan_status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  scan_result       JSONB,
  scanned_at        TIMESTAMPTZ,
  is_e2ee           BOOLEAN NOT NULL DEFAULT false,
  purge_after       TIMESTAMPTZ NOT NULL,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_att_scan CHECK (scan_status IN ('pending','clean','blocked','unscannable'))
);
-- Regla aplicativa D-086: mientras scan_status <> 'clean' el adjunto NO se visualiza ni descarga.
-- Regla aplicativa D-086: 'blocked' y 'unscannable' son terminales; nunca se liberan.
-- Regla aplicativa D-092: en contextos E2EE, si el analizador no está disponible como
--   procesador confiable, el contexto NO admite adjuntos.
```

### 3.5 Eventos de negocio y entrega durable

```sql
-- D-080, D-141: recepción idempotente, autorizada y trazable
CREATE TABLE business_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  source_application VARCHAR(100) NOT NULL,
  event_id           VARCHAR(255) NOT NULL,
  event_type         VARCHAR(160) NOT NULL,
  schema_version     INTEGER NOT NULL,
  correlation_id     VARCHAR(255),
  -- Intenciones del contrato: D-080 (ensure/publish) + D-136/D-137 (archive/rename)
  intent             VARCHAR(40) NOT NULL,
  occurred_at        TIMESTAMPTZ NOT NULL,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload            JSONB NOT NULL,
  reception_result   VARCHAR(20) NOT NULL DEFAULT 'accepted',
  error_detail       TEXT,
  -- D-092: si el contexto destino es E2EE el productor cifra y participa criptográficamente
  is_e2ee            BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uq_event_dedup UNIQUE (source_application, event_id),
  CONSTRAINT chk_event_intent CHECK (intent IN
    ('ensure_context','ensure_topic','publish_activity','archive_context','update_context_name')),
  CONSTRAINT chk_event_result CHECK (reception_result IN
    ('accepted','duplicate','rejected','retryable'))
);

-- D-010: outbox transaccional. Se escribe en el mismo commit que el cambio de dominio.
CREATE TABLE outbox (
  id             BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  aggregate_type VARCHAR(60) NOT NULL,
  aggregate_id   UUID NOT NULL,
  event_type     VARCHAR(120) NOT NULL,
  payload        JSONB NOT NULL,
  partition_key  VARCHAR(160) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at  TIMESTAMPTZ,
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT
);
```

### 3.6 Cifrado E2EE

```sql
-- D-091: dispositivo registrado, revocable, sin acceso a llaves futuras
CREATE TABLE devices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id        UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  device_label       VARCHAR(160) NOT NULL,
  public_key         BYTEA NOT NULL,
  registered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  step_up_verified_at TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  revoked_by         UUID REFERENCES identities(id)
);

-- D-089: frontera criptográfica INDEPENDIENTE por tema
CREATE TABLE topic_key_epochs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  topic_id       UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  epoch          INTEGER NOT NULL,
  rotated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotation_cause VARCHAR(40) NOT NULL,
  CONSTRAINT uq_topic_epoch UNIQUE (topic_id, epoch),
  CONSTRAINT chk_rot_cause CHECK (rotation_cause IN
    ('initial','device_revoked','membership_changed','scheduled','processor_revoked'))
);

-- D-091: respaldo cifrado en custodia corporativa. ⚠ DEP-010: el servicio NO EXISTE (D-147)
CREATE TABLE key_escrow_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id          UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  epoch             INTEGER NOT NULL,
  wrapped_key_ref   VARCHAR(500) NOT NULL,   -- referencia opaca al servicio de llaves
  kms_key_id        VARCHAR(255) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Regla aplicativa D-091: el backend ordinario NO puede resolver wrapped_key_ref.
-- Regla aplicativa D-091: la liberación exige break-glass aprobado y queda auditada.

-- D-092: procesadores imprescindibles con identidad propia y alcance mínimo
CREATE TABLE trusted_processors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id     UUID REFERENCES contexts(id) ON DELETE RESTRICT,
  processor_kind VARCHAR(40) NOT NULL,
  identity_ref   VARCHAR(255) NOT NULL,
  scope          JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at     TIMESTAMPTZ,
  CONSTRAINT chk_processor_kind CHECK (processor_kind IN
    ('antimalware','producer','migration'))
);
-- D-107: el agente MCP NO puede registrarse como procesador criptográfico en el MVP.
```

### 3.7 Retención, evidencia y gobierno

```sql
-- D-098: cinco capas. D-152: SIN excepciones por contexto.
CREATE TABLE retention_policies (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   VARCHAR(120) NOT NULL UNIQUE,
  visible_days           INTEGER NOT NULL DEFAULT 90,
  operational_days       INTEGER NOT NULL DEFAULT 180,
  audit_days             INTEGER NOT NULL DEFAULT 730,
  revision_and_file_days INTEGER NOT NULL DEFAULT 180,
  backup_rotation_days   INTEGER NOT NULL DEFAULT 35,
  hold_grace_days        INTEGER NOT NULL DEFAULT 30,
  effective_from         TIMESTAMPTZ NOT NULL DEFAULT now(),
  version                INTEGER NOT NULL DEFAULT 1
);

-- D-153: legal hold; prevalece sobre cualquier purga
CREATE TABLE legal_holds (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  scope_type     VARCHAR(20) NOT NULL,
  scope_id       UUID,
  range_from     TIMESTAMPTZ,
  range_to       TIMESTAMPTZ,
  requested_by   UUID NOT NULL REFERENCES identities(id),
  approved_by    UUID NOT NULL REFERENCES identities(id),
  reason         TEXT NOT NULL,
  placed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at    TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  CONSTRAINT chk_hold_scope CHECK (scope_type IN ('application','context','topic')),
  CONSTRAINT chk_hold_approver CHECK (approved_by <> requested_by)
);

-- D-153: exportación puntual gobernada, con manifiesto y checksums
CREATE TABLE export_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  scope_type     VARCHAR(20) NOT NULL,
  scope_id       UUID,
  range_from     TIMESTAMPTZ,
  range_to       TIMESTAMPTZ,
  requested_by   UUID NOT NULL REFERENCES identities(id),
  approved_by    UUID REFERENCES identities(id),
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  manifest_ref   VARCHAR(500),
  checksum_sha256 VARCHAR(64),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  CONSTRAINT chk_export_status CHECK (status IN
    ('pending','approved','rejected','running','completed','failed')),
  -- D-153: UNA aprobación de persona distinta. No hay doble aprobación.
  CONSTRAINT chk_export_approver CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

-- D-083, D-150: solicitud desde coordinación/desarrollo, aprobación desde gerencia
CREATE TABLE break_glass_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  scope_type     VARCHAR(20) NOT NULL,
  scope_id       UUID NOT NULL,
  requested_by   UUID NOT NULL REFERENCES identities(id),
  reason         TEXT NOT NULL,
  approved_by    UUID REFERENCES identities(id),
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  window_start   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  -- D-091: si el alcance es E2EE, registra qué llaves se liberaron
  released_key_refs JSONB,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_bg_status   CHECK (status IN ('pending','approved','denied','expired','revoked')),
  CONSTRAINT chk_bg_approver CHECK (approved_by IS NULL OR approved_by <> requested_by),
  CONSTRAINT chk_bg_scope    CHECK (scope_type IN ('context','topic'))
);
-- Regla aplicativa D-150: approved_by debe tener scope 'global_admin' (nivel gerencia).
-- Regla aplicativa D-108: durante una sesión break-glass el agente MCP queda BLOQUEADO.

-- D-098, D-099: evidencia inmutable, append-only
CREATE TABLE audit_entries (
  id             BIGSERIAL PRIMARY KEY,
  application_id UUID REFERENCES applications(id) ON DELETE RESTRICT,
  actor_id       UUID REFERENCES identities(id),
  actor_kind     VARCHAR(20) NOT NULL,
  action         VARCHAR(120) NOT NULL,
  resource_type  VARCHAR(60) NOT NULL,
  resource_id    UUID,
  reason         TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  purge_after    TIMESTAMPTZ NOT NULL,
  CONSTRAINT chk_audit_actor CHECK (actor_kind IN ('user','application','system','agent'))
);
-- Regla aplicativa: sin UPDATE ni DELETE a nivel de aplicación.

-- D-098: tombstone; una restauración de backup lo reaplica antes de servir información
CREATE TABLE purge_tombstones (
  id             BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  resource_type  VARCHAR(60) NOT NULL,
  resource_id    UUID NOT NULL,
  purged_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_version INTEGER NOT NULL
);
```

### 3.8 Agente externo y MCP

```sql
-- D-103, D-127: agente externo con identidad y scopes propios
CREATE TABLE agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           VARCHAR(100) NOT NULL UNIQUE,
  display_name   VARCHAR(255) NOT NULL,
  mcp_endpoint   VARCHAR(500) NOT NULL,
  scopes         JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_read_only   BOOLEAN NOT NULL DEFAULT true,
  kill_switch    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_agent_readonly CHECK (is_read_only = true)  -- D-105: escritura es Posterior al MVP
);

-- D-106: habilitación por aplicación/contexto
CREATE TABLE agent_enablements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id     UUID REFERENCES contexts(id) ON DELETE RESTRICT,
  enabled_by     UUID NOT NULL REFERENCES identities(id),
  enabled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at     TIMESTAMPTZ
);

-- D-106: membresía TÉCNICA explícita en temas manuales privados no E2EE
CREATE TABLE agent_topic_memberships (
  agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  topic_id       UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  added_by       UUID NOT NULL REFERENCES identities(id),
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at     TIMESTAMPTZ,
  PRIMARY KEY (agent_id, topic_id)
);
-- Regla aplicativa D-107: se rechaza si el contexto del tema tiene encryption_policy='e2ee'.

-- D-104: metadata 2 años, payload técnico 30 días, sin embeddings propios
CREATE TABLE agent_invocations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  agent_id          UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  context_id        UUID NOT NULL REFERENCES contexts(id) ON DELETE RESTRICT,
  topic_id          UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  invoked_by        UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  question_message_id UUID REFERENCES messages(id) ON DELETE RESTRICT,
  answer_message_id   UUID REFERENCES messages(id) ON DELETE RESTRICT,
  tool_name         VARCHAR(160) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'queued',
  error_detail      TEXT,
  correlation_id    VARCHAR(255),
  technical_payload JSONB,
  payload_purge_after TIMESTAMPTZ NOT NULL,   -- D-104: 30 días
  metadata_purge_after TIMESTAMPTZ NOT NULL,  -- D-104: 2 años
  invoked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  CONSTRAINT chk_agent_inv_status CHECK (status IN
    ('queued','running','completed','failed','blocked'))
);
```

### 3.9 Realtime, notificaciones y migración

```sql
-- D-030: Chat conserva los no leídos; el Hub entrega los avisos
CREATE TABLE read_states (
  application_id     UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  topic_id           UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  identity_id        UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  last_read_message_id UUID REFERENCES messages(id) ON DELETE RESTRICT,
  unread_count       INTEGER NOT NULL DEFAULT 0,
  has_unread_mention BOOLEAN NOT NULL DEFAULT false,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, identity_id)
);

-- D-030, D-061, D-092: intención de notificación. NUNCA transporta cuerpo en E2EE.
CREATE TABLE notification_intents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id     UUID NOT NULL REFERENCES contexts(id) ON DELETE RESTRICT,
  topic_id       UUID NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  recipient_id   UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  reason         VARCHAR(40) NOT NULL,
  deep_link      VARCHAR(1000) NOT NULL,
  includes_body  BOOLEAN NOT NULL DEFAULT false,
  dispatched_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_notif_reason CHECK (reason IN ('mention','activity','business_event','agent_answer'))
);
-- Regla aplicativa D-092: si el contexto es E2EE, includes_body DEBE ser false.

-- D-119, D-120, D-121, D-154
CREATE TABLE migration_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  context_id     UUID REFERENCES contexts(id) ON DELETE RESTRICT,
  source_ref     VARCHAR(500) NOT NULL,
  eligibility    VARCHAR(20) NOT NULL,
  excluded_by    UUID REFERENCES identities(id),   -- D-154: gerencia del equipo de producto
  exclusion_reason TEXT,
  phase          VARCHAR(30) NOT NULL DEFAULT 'inventory',
  started_at     TIMESTAMPTZ,
  cutover_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  CONSTRAINT chk_mig_eligibility CHECK (eligibility IN ('eligible','excluded','not_eligible')),
  CONSTRAINT chk_mig_phase CHECK (phase IN
    ('inventory','freeze','initial_load','delta','validation','opened','archived','failed'))
);

CREATE TABLE migration_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES migration_jobs(id) ON DELETE RESTRICT,
  source_id      VARCHAR(255) NOT NULL,
  item_type      VARCHAR(40) NOT NULL,
  target_id      UUID,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  exception_note TEXT,
  processed_at   TIMESTAMPTZ,
  CONSTRAINT uq_mig_item UNIQUE (job_id, source_id),
  CONSTRAINT chk_mig_item_status CHECK (status IN
    ('pending','migrated','skipped','exception','blocked'))
);

-- D-161, D-109: analítica AGREGADA. Sin contenido ni dimensiones identificables.
CREATE TABLE analytics_rollups (
  id             BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
  metric_key     VARCHAR(120) NOT NULL,
  bucket_start   TIMESTAMPTZ NOT NULL,
  bucket_size    VARCHAR(10) NOT NULL,
  value_numeric  NUMERIC NOT NULL,
  CONSTRAINT uq_rollup UNIQUE (application_id, metric_key, bucket_start, bucket_size)
);
-- Regla aplicativa D-109: prohibido almacenar nombres de tema, integrantes, cuerpos,
--   archivos, búsquedas, prompts o respuestas. Sin excepción para OBP.
```

### 3.10 Resumen de entidades

**38 tablas.** Ninguna entidad sin respaldo de decisión.

| Grupo | Tablas |
|---|---|
| Aplicaciones | `applications`, `application_credentials`, `application_capabilities` |
| Identidad | `identities`, `platform_scopes` |
| Contextos | `contexts`, `context_memberships`, `topics`, `topic_memberships`, `mention_labels`, `mention_label_members` |
| Mensajería | `messages`, `message_revisions`, `reactions`, `mentions`, `pinned_messages`, `attachments` |
| Eventos | `business_events`, `outbox` |
| Cifrado | `devices`, `topic_key_epochs`, `key_escrow_records`, `trusted_processors` |
| Gobierno | `retention_policies`, `legal_holds`, `export_requests`, `break_glass_requests`, `audit_entries`, `purge_tombstones` |
| Agente | `agents`, `agent_enablements`, `agent_topic_memberships`, `agent_invocations` |
| Operación | `read_states`, `notification_intents`, `migration_jobs`, `migration_items`, `analytics_rollups` |

---
