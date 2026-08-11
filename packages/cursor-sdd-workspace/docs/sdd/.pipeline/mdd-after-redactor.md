# Master Design Document — Workspace Chat

**Versión:** 2.0-local  
**Fecha:** 11 de agosto de 2026  
**Fuente normativa:** `paso0/domain-benchmark.md` + `paso0/decisions.catalog.json`  
**Pipeline:** high_split (Forge local, sin API)

> Toda regla, tabla, campo y endpoint cita D-ID. Sin identificador = propuesta, no requisito.

---

## 1. Contexto y alcance

### 1.1 Propósito del sistema

Workspace Chat es una **plataforma corporativa de comunicación contextual multiaplicación**
(D-002). Su núcleo relaciona una aplicación consumidora con un contexto de negocio y sus
temas mediante `application + contextType + contextId` (D-002, D-004).

Personas, aplicaciones, sistemas, integraciones, bots y agentes producen actividad atribuida
dentro de **una misma cronología** (D-006), mientras el sistema productor conserva el estado
oficial del objeto de negocio (D-128).

**El diferenciador no es la mensajería.** Es que la actividad automática del sistema y la
conversación humana comparten una sola línea de tiempo adherida al objeto de negocio, y que
esa línea de tiempo es verdadera: ningún productor emite antes de persistir (D-141).

### 1.2 Problema que resuelve

| # | Problema | Naturaleza |
|:--:|---|---|
| 1 | La conversación de campaña vive separada del objeto de negocio en OBP | Coste cognitivo y operativo |
| 2 | Avisos que nacen en el navegador o antes de confirmar persistencia; reglas repartidas entre frontend, Make, Tasks y código legado | **Integridad** — se comunican estados que no ocurrieron |
| 3 | El giro corporativo hacia Google obligaría a rehacer integraciones | Coste de cambio |

El problema 2 es la justificación técnica principal y **orienta el diseño**: la
confiabilidad de eventos prevalece sobre la portabilidad.

### 1.3 Capacidades en alcance del MVP

| Capacidad | D-ID |
|---|---|
| Núcleo contextual multiaplicación | D-002, D-004 |
| Alta y gobierno de aplicaciones consumidoras | D-133, D-134, D-135 |
| Activación modular de capacidades por aplicación | D-145 |
| Contextos, temas `General`, temas de aplicación y temas manuales | D-011, D-014, D-080 |
| Privacidad de tema público/privado, fija tras el primer mensaje | D-045, D-081 |
| Ciclo de vida del contexto: archivado, nunca borrado | D-136, D-137, D-138 |
| Identidad SSO, membresía histórica, roles y scopes separados | D-003, D-016, D-082, D-084, D-155 |
| `break-glass` con separación jerárquica | D-083, D-150, D-151 |
| Mensajería base, subconversaciones, programados, fijados, menciones y etiquetas | D-124, D-047, D-053, D-054, D-055, D-158 |
| Adjuntos con cuarentena y antimalware obligatorios | D-125, D-086 |
| Contrato genérico de eventos e invariante de confiabilidad | D-080, D-115, D-141, D-142 |
| Rich cards y acciones | D-057 |
| Realtime, contadores y notificaciones | D-126, D-030, D-061 |
| Búsqueda por aplicación y por aplicación seleccionada en el cliente central | D-031, D-157 |
| E2EE configurable con recuperación corporativa | D-089–D-092, D-131, D-132 |
| Retención por cinco capas, legal hold y exportación | D-098, D-099, D-153 |
| Agente externo mediante MCP con doble autorización | D-103, D-104, D-106 |
| Panel de administración y analítica general agregada | D-058, D-161, D-109 |
| Migración de campañas OBP desde Teams | D-119, D-120, D-121, D-154 |

### 1.4 Fuera de alcance explícito

Estas exclusiones son **vinculantes**. Ningún artefacto posterior puede introducirlas.

| Excluido | D-ID |
|---|---|
| Multi-tenancy como eje de aislamiento | D-095 |
| Chat corporativo general, DMs, grupos y canales corporativos | D-073 |
| Llamadas, videollamadas, pantalla, grabación y transcripción | D-074 |
| Federación entre organizaciones o servidores | D-122 |
| **Descubrimiento abierto de conversaciones y solicitud de acceso** | D-160 |
| **Fusión y división de contextos** | D-138 |
| **Excepciones de retención por contexto** | D-152 |
| **Derechos del titular de datos personales como capacidad del producto** | D-140 |
| **Acción automática ante incumplimiento del invariante de confiabilidad** | D-143 |
| Tickets, tareas, responsables, SLA, resolución y conclusiones formales | D-015, D-097 |
| Silenciar tema o contexto | D-056 |
| Mensajes efímeros, calendarios, moderación avanzada | D-066, D-067, D-068 |
| Historial y acciones móviles offline | D-088 |
| Portal Legal, eDiscovery autoservicio y exportaciones masivas ordinarias | D-100 |
| Embeddings propios; entrenar u hospedar un modelo general | D-104 |
| Agente durante `break-glass` | D-108 |
| Autenticación propia: registro, contraseña, MFA, recuperación | D-003 |
| Integraciones adicionales no identificadas (incluye cualquier canal de mensajería externo) | D-069 |
| Bitrix y su flujo legado | D-118, D-163 |
| Teams o Slack como canal permanente o puente | D-070, D-121 |
| Presencia, indicador de escritura y confirmaciones de lectura | D-159 (Posterior al MVP) |

### 1.5 Vocabulario cerrado

**Términos del dominio.** Ningún artefacto puede renombrarlos ni introducir sinónimos:

`Aplicación`, `Contexto`, `Membresía contextual`, `Tema`, `General`, `Tema administrado por
aplicación`, `Tema manual`, `Tema público`, `Tema privado`, `Membresía de tema`,
`Subconversación`, `Actor`, `Autor`, `Miembro`, `Miembro solo lectura`, `Administrador
contextual`, `Administrador de aplicación`, `Administrador global`, `Mensaje`, `Evento de
negocio`, `Adjunto`, `Mención`, `Etiqueta de mención`, `Reacción`, `Archivado`, `Eliminación
lógica`, `Política de retención`, `Contexto de cifrado`, `Dispositivo registrado`,
`Procesador confiable`, `Entrada de auditoría`, `Agente externo`, `Membresía técnica de
agente`, `Invocación MCP`, `Acceso break-glass`, `Invitado`.

**Términos prohibidos** (D-005, `04` §Términos que deben evitarse):

| Prohibido | Motivo |
|---|---|
| `canal`, `channel`, `publicación` | Semántica de Teams; describe el estado actual, no el dominio |
| `ticket`, `incidencia`, `resolución`, `responsable`, `SLA` | Workspace Chat no tiene workflow |
| `conversación` como entidad intermedia | La jerarquía es Aplicación → Contexto → Tema |
| `tenant` como eje de aislamiento | Frontera futura, distinta de aplicación (D-095) |
| `grupo de trabajo` | Se confunde con los equipos que Tasks resuelve en OBP |
| `subchat` | El término es `subconversación` |
| `campaña`, `medio`, `Sitios`, `Camiones`, `Vallas`, `Indoors` | Pertenecen al adaptador de OBP, nunca al núcleo |

### 1.6 Actores y estructura organizacional real

**D-148 registra que no existen áreas separadas de Legal/Compliance, Seguridad de la
información ni TI corporativo.** Todos los scopes se ejercen desde el equipo de producto y
desarrollo. Los scopes son **del sistema**, no de la organización (D-149).

| Scope del sistema | Nivel que lo ejerce | Facultades | D-ID |
|---|---|---|---|
| Administrador global | **Gerencia** | Gobierno de plataforma, alta de aplicaciones, **aprobación de `break-glass`**, exclusiones de migración | D-082, D-133, D-150, D-151, D-154 |
| Seguridad/Compliance | **Gerencia** | Legal holds, exportaciones puntuales, auditoría | D-082, D-153 |
| Administrador de aplicación | Coordinación y desarrollo | Configuración, operación y recuperación de contextos huérfanos | D-082, D-085 |
| Soporte/TI | Coordinación y desarrollo | Diagnóstico técnico, sesiones, entregas, metadata operativa | D-082 |
| Administrador contextual | Designado por la aplicación | Participantes, roles, etiquetas, configuración y archivado de su contexto | D-018, D-158 |
| Miembro | Usuario final | Publica, responde, reacciona, adjunta, menciona, programa, fija, crea subconversaciones, busca, edita y elimina **lo propio** | D-155 |
| Miembro solo lectura | Usuario final | Consulta contenido autorizado sin publicar ni modificar | D-084 |

**Ningún scope concede lectura automática de contenido** (D-082).

---


## 2. Arquitectura y Stack

### 2.1 Visión general

> **Advertencia de lectura (D-162).** Las tecnologías concretas de esta sección son
> **propuestas**, no decisiones de dominio. Lo vinculante son los invariantes:
> aislamiento por aplicación con defensa en profundidad, y clientes que comparten dominio,
> contratos, autenticación, realtime, validaciones y tokens de diseño. Cambiar una
> tecnología **no** reabre el alcance.

Monolito modular con arquitectura hexagonal, tres BFF por superficie y un núcleo de dominio
único. El aislamiento es **por aplicación consumidora** (D-093), aplicado en tres capas:
autorización server-side, barrera a nivel de datos, y controles equivalentes en archivos,
caché, búsqueda, colas y realtime.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                   API Gateway (authn, rate limit)                     │
└──────┬────────────────────┬────────────────────┬─────────────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│ BFF Embebido │   │  BFF Central Web │   │  BFF Móvil   │
│ 1 aplicación │   │ N aplicaciones   │   │ solo en línea│
│   (D-028)    │   │ autorizadas D-044│   │   (D-087)    │
└──────┬───────┘   └────────┬─────────┘   └──────┬───────┘
       └────────────────────┼────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  NÚCLEO DE DOMINIO (hexagonal)                        │
│                                                                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐            │
│  │ Contexto  │ │ Mensajería│ │  Acceso   │ │ Ingesta   │            │
│  │  y temas  │ │ y media   │ │ y gobierno│ │de eventos │            │
│  │ D-011/136 │ │ D-124/086 │ │ D-082/150 │ │ D-080/141 │            │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘            │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐            │
│  │ Retención │ │  Cifrado  │ │  Agente   │ │ Migración │            │
│  │ y evidencia│ │  E2EE     │ │   MCP     │ │    OBP    │            │
│  │ D-098/153 │ │ D-089/092 │ │ D-103/106 │ │ D-119/121 │            │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘            │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────────┐
│Persistencia│ │   Caché    │ │   Cola     │ │  Almacén de objetos  │
│  + barrera │ │ + pub/sub  │ │ + DLQ      │ │  + URLs firmadas     │
│  de datos  │ │            │ │            │ │                      │
└────────────┘ └────────────┘ └────────────┘ └──────────────────────┘
       │                                              │
       ▼                                              ▼
┌────────────────────┐                    ┌──────────────────────────┐
│ Servicio de llaves │  ⚠ NO EXISTE       │  Analizador antimalware  │
│   KMS/HSM (D-147)  │  DEP-010 · R-021   │  procesador confiable    │
└────────────────────┘                    │        (D-092)           │
                                          └──────────────────────────┘
```

**Adaptadores de entrada por aplicación productora.** Cada aplicación tiene su propio
adaptador que traduce su semántica al contrato canónico. `campaña`, `medio` y los nombres
de tipos de medio viven **exclusivamente** en el adaptador de OBP y nunca alcanzan el núcleo
(D-005, D-115).

### 2.2 Módulos del núcleo

| Módulo | Responsabilidad | D-ID principales |
|---|---|---|
| `applications` | Alta, credenciales, políticas por defecto, flags de capacidad | D-133, D-134, D-135, D-145 |
| `contexts` | Contextos, temas, membresías, privacidad, archivado, ciclo de vida | D-011, D-045, D-081, D-136, D-137 |
| `messaging` | Mensajes, subconversaciones, reacciones, menciones, fijados, programados | D-124, D-047, D-053, D-054, D-055 |
| `media` | Adjuntos, cuarentena, antimalware, entrega firmada | D-086, D-125 |
| `ingestion` | Recepción de eventos, idempotencia, intents, adaptadores | D-080, D-115, D-141 |
| `realtime` | Distribución, reconexión, resincronización, contadores | D-126, D-030 |
| `notifications` | Intención de notificación y frontera con el Hub corporativo | D-030, D-061 |
| `search` | Índice por aplicación; delegación al cliente en E2EE | D-031, D-157, D-092 |
| `access` | Identidad, membresías, roles, scopes, `break-glass` | D-003, D-082, D-150 |
| `crypto` | Política E2EE, dispositivos, procesadores confiables, custodia de llaves | D-089, D-091, D-092, D-147 |
| `retention` | Cinco capas, purga, tombstones, legal hold, exportación | D-098, D-153 |
| `agent` | Registro, habilitación, membresía técnica e invocación MCP | D-103, D-106, D-127 |
| `audit` | Entrada de auditoría inmutable | D-098, D-099 |
| `analytics` | Métricas agregadas sin contenido | D-109, D-161 |
| `migration` | Trabajos e ítems de migración OBP | D-119, D-120, D-121 |

### 2.3 Stack propuesto — no es decisión de dominio

| Capa | Propuesta | Invariante vinculante |
|---|---|---|
| Runtime | Node.js 20 LTS + TypeScript estricto | — |
| Framework backend | NestJS 10 | Modularidad y puertos/adaptadores |
| Persistencia | PostgreSQL 16 | **Aislamiento por aplicación con segunda barrera a nivel de datos** (D-093, D-162) |
| Segunda barrera | RLS de PostgreSQL | Barrera independiente de la autorización de aplicación |
| Caché y pub/sub | Redis 7 | — |
| Cola y reintentos | RabbitMQ o BullMQ | Entrega durable, reintentos, DLQ, idempotencia (D-010) |
| Objetos | S3-compatible (MinIO) | Binarios fuera de la base; URLs firmadas y temporales (D-086) |
| Realtime | Socket.IO | Persistir antes de emitir; reconexión y resincronización (D-126) |
| Cliente web | React / Next.js | Dominio, contratos, auth, realtime, validaciones y tokens compartidos (D-078) |
| Cliente móvil | React Native + Expo | Ídem, **solo en línea** (D-087) |
| Cliente embebido | Paquete React + SDK agnóstico | Aislamiento a una aplicación (D-028) |
| Validación | Zod | Contratos versionados |
| Observabilidad | OpenTelemetry | Salud, logs, métricas, correlación, alertas (D-111) |
| **Servicio de llaves** | **Por construir o contratar** | **No existe (D-147, DEP-010, R-021)** |
| Antimalware | Motor tras la capacidad de medios | Análisis obligatorio; sin él no hay adjuntos (D-086, D-092) |

### 2.4 Mensajería asíncrona

| Cola / exchange | Productor | Consumidor | Propósito | D-ID |
|---|---|---|---|---|
| `inbound.business-events` | Adaptadores de aplicación | `ingestion` | Eventos post-persistencia, idempotentes | D-080, D-141 |
| `outbox.dispatch` | Núcleo | `realtime`, `notifications` | Publicación confiable tras commit local | D-010 |
| `media.scan` | `media` | Analizador antimalware | Cuarentena obligatoria | D-086 |
| `agent.invocations` | `messaging` | `agent` | Invocación MCP explícita de solo lectura | D-103 |
| `retention.jobs` | Planificador | `retention` | Purga verificable y reaplicación de tombstones | D-098 |
| `migration.items` | `migration` | `migration` | Ítems de migración con reintento idempotente | D-119–D-121 |
| `audit.stream` | Todos | `audit` | Entradas inmutables | D-098 |

**Garantías:** confirmación de publicación, `manual ack`, DLQ con inspección manual, backoff
exponencial. El orden se exige **sólo dentro de la partición que lo necesita** (`03`
§Reglas e invariantes), nunca globalmente.

### 2.5 Frontera con sistemas externos

| Dependencia | Naturaleza | Estado | D-ID |
|---|---|---|---|
| SSO Integral | Identidad de personas | Decisión confirmada | D-003, DEP-001 |
| Aplicaciones productoras | Emiten actividad post-persistencia | Decisión confirmada | D-141, DEP-002 |
| Backend OBP | Primer productor; informa actividad de campaña | Decisión confirmada | DEP-003 |
| Tasks | **Sólo** membresía inicial de campaña. **Ya no resuelve menciones** | Decisión confirmada | D-032, D-158, DEP-004 |
| Hub de Notificaciones | Entrega avisos; Chat conserva no leídos | Decisión confirmada | D-030, DEP-005 |
| Capacidad de medios y antimalware | Almacena y analiza binarios | Decisión confirmada | D-086, DEP-006 |
| **Servicio de llaves KMS/HSM** | **No existe. Debe construirse o contratarse** | **DEP-010, R-021** | D-147 |
| Agente de campañas (MCP) | Solo lectura, identidad y scopes propios | Decisión confirmada | D-103, DEP-011 |
| Teams / Graph | **Temporal**, sólo migración | Supuesto | DEP-012, A-011 |

---


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


## 4. Contratos de API

### 4.1 Convenciones

- Prefijo `/api/v1`. Autenticación **exclusivamente** por token del SSO corporativo o por
  credencial de aplicación (D-003, D-135). **No existen endpoints de login, registro,
  recuperación de contraseña ni MFA.**
- El `application_id` **nunca** viaja como parámetro libre: se deriva del token (D-093).
- Toda mutación acepta `Idempotency-Key`.
- Toda respuesta de error usa `{ code, message, correlationId }`.
- Los endpoints marcados 🔒 exigen scope de plataforma; los marcados ⚠ generan entrada de
  auditoría obligatoria.

### 4.2 Resumen de endpoints

| Método | Ruta | Propósito | Autorización | D-ID |
|---|---|---|---|---|
| GET | `/health` | Salud del servicio | pública | D-111 |
| **Aplicaciones** ||||
| POST | `/applications` 🔒⚠ | Alta con los 4 elementos obligatorios | global_admin | D-133, D-134 |
| GET | `/applications` 🔒 | Lista de aplicaciones registradas | global_admin | D-133 |
| GET | `/applications/{id}` 🔒 | Detalle y políticas efectivas | global_admin, application_admin | D-134 |
| POST | `/applications/{id}/credentials` 🔒⚠ | Emitir o rotar credencial | global_admin | D-134, D-135 |
| DELETE | `/applications/{id}/credentials/{cid}` 🔒⚠ | Revocar credencial | global_admin | D-135 |
| PATCH | `/applications/{id}/capabilities` 🔒⚠ | Activar o desactivar capacidad | global_admin | D-145 |
| **Ingesta de eventos** ||||
| POST | `/ingest/events` | Recepción idempotente de eventos de negocio | credencial de aplicación | D-080, D-141 |
| GET | `/ingest/events/{eventId}` 🔒 | Estado de recepción y resultado | support | D-080 |
| **Contextos** ||||
| GET | `/contexts` | Contextos donde el usuario tiene membresía | membresía | D-160 |
| GET | `/contexts/{id}` | Detalle del contexto autorizado | membresía contextual | D-016 |
| PATCH | `/contexts/{id}` ⚠ | Actualizar `displayName`. `externalId` inmutable | credencial de aplicación | D-137 |
| POST | `/contexts/{id}/archive` ⚠ | Archivar. **No existe DELETE** | credencial de aplicación, context_admin | D-136 |
| GET | `/contexts/{id}/members` | Membresía del contexto | membresía contextual | D-016 |
| POST | `/contexts/{id}/members` ⚠ | Añadir participante | context_admin | D-018, D-156 |
| DELETE | `/contexts/{id}/members/{identityId}` ⚠ | Retirar participante, conservando autoría | context_admin | D-018, D-022 |
| PATCH | `/contexts/{id}/members/{identityId}` ⚠ | Cambiar rol | context_admin | D-018 |
| **Temas** ||||
| GET | `/contexts/{id}/topics` | Temas visibles según membresía | membresía contextual | D-045 |
| POST | `/contexts/{id}/topics` ⚠ | Crear tema manual y fijar su privacidad | context_admin | D-014, D-045 |
| GET | `/topics/{id}` | Detalle del tema autorizado | membresía de tema si privado | D-045 |
| PATCH | `/topics/{id}` ⚠ | Renombrar; rechazado si `is_renamable=false` | context_admin | D-012 |
| PATCH | `/topics/{id}/visibility` ⚠ | Cambiar privacidad **sólo si está vacío** | context_admin | D-081 |
| POST | `/topics/{id}/archive` ⚠ | Archivar tema | context_admin | D-027, D-060 |
| GET | `/topics/{id}/members` | Membresía del tema privado | membresía de tema | D-045 |
| POST | `/topics/{id}/members` ⚠ | Añadir miembro a tema privado | context_admin | D-045, D-156 |
| DELETE | `/topics/{id}/members/{identityId}` ⚠ | Retirar miembro | context_admin | D-045 |
| **Etiquetas de mención** ||||
| GET | `/contexts/{id}/mention-labels` | Etiquetas del contexto | membresía contextual | D-158 |
| POST | `/contexts/{id}/mention-labels` ⚠ | Crear etiqueta sobre la membresía | context_admin | D-158 |
| PUT | `/mention-labels/{id}/members` ⚠ | Definir integrantes de la etiqueta | context_admin | D-158 |
| DELETE | `/mention-labels/{id}` ⚠ | Eliminar etiqueta | context_admin | D-158 |
| **Mensajería** ||||
| GET | `/topics/{id}/messages` | Cronología paginada | membresía | D-006 |
| POST | `/topics/{id}/messages` | Publicar mensaje o programarlo | miembro | D-124, D-053 |
| GET | `/messages/{id}` | Detalle | membresía | D-124 |
| PATCH | `/messages/{id}` ⚠ | Editar **propio**; rechazado en eventos de negocio | autor | D-023, D-025 |
| DELETE | `/messages/{id}` ⚠ | Eliminación **lógica** propia o administrativa | autor o context_admin | D-023, D-024 |
| GET | `/messages/{id}/subconversation` | Mensajes derivados del raíz | membresía | D-047 |
| PUT | `/messages/{id}/reactions` | Añadir o quitar reacción | miembro | D-124 |
| POST | `/topics/{id}/pins` ⚠ | Fijar mensaje | miembro | D-054, D-155 |
| DELETE | `/topics/{id}/pins/{messageId}` ⚠ | Desfijar | miembro | D-054 |
| PATCH | `/messages/{id}/schedule` | Reprogramar o cancelar antes de publicar | autor | D-053 |
| **Adjuntos** ||||
| POST | `/attachments` | Registrar adjunto y obtener URL de carga | miembro | D-125 |
| GET | `/attachments/{id}` | Metadata y estado de cuarentena | membresía | D-086 |
| GET | `/attachments/{id}/download` | URL firmada temporal. **403 si `scan_status<>'clean'`** | membresía | D-086 |
| **Realtime y no leídos** ||||
| GET | `/ws` | Conexión realtime autorizada por aplicación y membresía | membresía | D-126 |
| GET | `/unread` | Contadores global, por contexto y por tema | membresía | D-030 |
| POST | `/topics/{id}/read` | Marcar leído hasta un mensaje | miembro | D-030 |
| **Búsqueda** ||||
| GET | `/search` | Búsqueda dentro de **una** aplicación seleccionada | membresía | D-031, D-157 |
| **Agente MCP** ||||
| GET | `/agents` 🔒 | Agentes registrados | global_admin | D-103 |
| POST | `/agents/{id}/enablements` 🔒⚠ | Habilitar por aplicación o contexto | global_admin | D-106 |
| DELETE | `/agents/{id}/enablements/{eid}` 🔒⚠ | Revocar habilitación | global_admin | D-106 |
| POST | `/topics/{id}/agent-membership` ⚠ | Añadir membresía técnica en tema privado no E2EE | context_admin | D-106 |
| DELETE | `/topics/{id}/agent-membership` ⚠ | Retirar membresía técnica | context_admin | D-106 |
| POST | `/topics/{id}/agent-invocations` ⚠ | Invocación explícita de solo lectura | miembro | D-103 |
| GET | `/agent-invocations/{id}` | Estado y resultado | invocador | D-104 |
| **Cifrado** ||||
| POST | `/devices` ⚠ | Registrar dispositivo con reautenticación reforzada | identidad | D-091 |
| GET | `/devices` | Dispositivos propios | identidad | D-091 |
| DELETE | `/devices/{id}` ⚠ | Revocar: corta sesiones y rota llaves futuras | identidad o global_admin | D-091 |
| GET | `/topics/{id}/key-epochs` | Épocas de llave del tema autorizado | membresía de tema | D-089 |
| GET | `/trusted-processors` 🔒 | Procesadores registrados | global_admin | D-092 |
| POST | `/trusted-processors` 🔒⚠ | Alta con alcance mínimo | global_admin | D-092 |
| DELETE | `/trusted-processors/{id}` 🔒⚠ | Revocar; fuerza rotación | global_admin | D-092 |
| **Gobierno** ||||
| POST | `/break-glass-requests` ⚠ | Solicitar acceso excepcional | support, application_admin | D-083, D-150 |
| POST | `/break-glass-requests/{id}/approve` ⚠ | **Aprobar — sólo gerencia**, distinta del solicitante | global_admin | D-150 |
| POST | `/break-glass-requests/{id}/revoke` ⚠ | Revocar antes de expirar | global_admin | D-083 |
| GET | `/break-glass-requests` 🔒 | Historial completo | global_admin, security_compliance | D-083 |
| POST | `/legal-holds` ⚠ | Colocar hold; prevalece sobre la purga | security_compliance | D-153 |
| POST | `/legal-holds/{id}/release` ⚠ | Liberar; conserva 30 días adicionales | security_compliance | D-098, D-153 |
| POST | `/export-requests` ⚠ | Solicitar exportación puntual | security_compliance | D-153 |
| POST | `/export-requests/{id}/approve` ⚠ | **Una** aprobación de persona distinta | security_compliance, global_admin | D-153 |
| GET | `/export-requests/{id}` 🔒 | Estado, manifiesto y checksums | solicitante, aprobador | D-153 |
| GET | `/audit-entries` 🔒 | Consulta de evidencia; la consulta se audita | security_compliance | D-098 |
| GET | `/retention-policies` 🔒 | Política vigente y su versión efectiva | global_admin | D-098 |
| **Migración OBP** ||||
| POST | `/migration-jobs` 🔒⚠ | Crear trabajo por campaña | global_admin | D-119 |
| POST | `/migration-jobs/{id}/exclude` 🔒⚠ | Exclusión expresa — **gerencia** | global_admin | D-154 |
| POST | `/migration-jobs/{id}/advance` 🔒⚠ | Avanzar fase del corte | global_admin | D-121 |
| GET | `/migration-jobs/{id}` 🔒 | Estado y reconciliación | global_admin | D-121 |
| GET | `/migration-jobs/{id}/items` 🔒 | Ítems y reporte de excepciones | global_admin | D-121 |
| **Analítica** ||||
| GET | `/analytics/rollups` 🔒 | Métricas **agregadas** sin contenido | global_admin | D-109, D-161 |

**Total: 62 endpoints.**

### 4.3 Contrato de ingesta — `POST /ingest/events`

Autenticación por credencial de aplicación (D-135). Único punto de entrada de actividad
automática (D-080).

```jsonc
{
  "eventId": "uuid",                   // D-080: dedup con sourceApplication
  "sourceApplication": "obp",
  "eventType": "application.entity.changed",
  "schemaVersion": 1,
  "occurredAt": "2026-08-04T18:00:00Z", // D-141: posterior al commit del productor
  "correlationId": "uuid",
  "intent": "ensure_context",           // ensure_context | ensure_topic | publish_activity
                                        // | archive_context | update_context_name
  "actor": { "type": "user|application|system|bot|ai-agent", "id": "..." },
  "context": {
    "type": "campaign",                 // pertenece al adaptador de OBP, no al núcleo
    "externalId": "...",                // D-137: INMUTABLE
    "displayName": "..."                // D-137: actualizable
  },
  "topic": {
    "key": "sites",                     // estable dentro del contexto
    "displayName": "Sitios",
    "origin": "application",
    "visibility": "public",             // D-079: los de aplicación son públicos
    "ensureExists": true
  },
  "activity": {
    "kind": "business-event|rich-card",
    "title": "...", "body": "...",
    "entity": { "type": "media", "id": "..." },
    "payload": {}
  },
  "initialMembership": {                 // D-134, `06`: fotografía inicial
    "members": [{ "identityRef": "...", "role": "member" }],
    "admins": [{ "identityRef": "..." }]
  }
}
```

**Respuestas conceptuales:** `accepted`, `duplicate`, `rejected`, `retryable`.

**Invariantes de recepción:**

| Invariante | D-ID |
|---|---|
| `sourceApplication + eventId` es la clave de deduplicación; los reintentos conservan `eventId` | D-080 |
| `ensure` es **no destructivo**: no cambia privacidad, origen, reglas ni ciclo de vida | D-080 |
| Crear un contexto asegura también su tema `General` | D-011 |
| El productor debe tener credencial vigente para la aplicación | D-134, D-135 |
| Si el contexto destino es E2EE, el productor debe estar registrado como procesador confiable y cifrar el payload | D-092 |
| El orden se exige sólo dentro de la partición que lo necesita | `03` |
| Una caída de Workspace Chat **no** revierte ni bloquea al productor | D-141 |

---


## 5. Lógica y Edge Cases

### 5.1 Reglas de negocio

Formato Dado / Cuando / Entonces. Cada regla es verificable y trazable.

**RN-01 — Alta de aplicación consumidora** (D-133, D-134, D-135)
Dado un usuario con scope `global_admin`, cuando registra una aplicación aportando
responsable funcional, política de administradores predeterminados, política de retención,
política E2EE por defecto y orígenes autorizados, entonces el sistema crea la aplicación,
emite una credencial rotable, registra entrada de auditoría y deja la política E2EE
disponible para fijarse en cada contexto **antes** de que exista contenido.

**RN-02 — Creación de contexto y tema `General`** (D-011, D-080, D-136)
Dado un evento con `intent=ensure_context` y credencial de aplicación vigente, cuando el
contexto no existe para `sourceApplication + contextType + externalId`, entonces se crea el
contexto, se crea su tema `General` con `origin='default'` y `visibility='public'`, se
aplica la fotografía inicial de membresía y se fija `encryption_policy` heredada de la
aplicación. Si ya existe, la operación es **idempotente** y no modifica nada.

**RN-03 — Privacidad de tema manual** (D-081)
Dado un tema manual sin mensajes, cuando un administrador contextual cambia su visibilidad,
entonces el cambio se aplica y se audita. Cuando se publica el **primer** mensaje, el
sistema fija `privacy_locked_at`; cualquier cambio posterior se rechaza con `409` y la
respuesta ofrece crear un **tema sucesor** sin copiar historial ni miembros.

**RN-04 — Publicación de mensaje** (D-124, D-155, D-045)
Dado un usuario con rol `member` en el contexto —y con membresía explícita si el tema es
privado—, cuando publica un mensaje, entonces se persiste, se escribe una fila en `outbox`
en el **mismo commit**, se actualizan los contadores de no leídos de los demás miembros y se
emite por realtime. Un `read_only` recibe `403`.

**RN-05 — Un miembro nunca añade participantes** (D-156, D-018)
Dado un usuario con rol `member` o `read_only`, cuando intenta añadir a alguien a un
contexto o a un tema, entonces se rechaza con `403`. No existe flujo de solicitud de
incorporación.

**RN-06 — Adjunto en cuarentena** (D-086)
Dado un miembro que sube un archivo, cuando se registra el adjunto, entonces se valida MIME
real contra el declarado, extensión y tamaño; se encola el análisis antimalware y el estado
queda `pending`. Mientras el estado no sea `clean`, cualquier intento de visualización o
descarga devuelve `403`. Si el resultado es `blocked` o `unscannable`, el estado es
**terminal** y el archivo nunca se libera.

**RN-07 — Adjunto en contexto E2EE sin analizador** (D-092, D-086)
Dado un contexto con `encryption_policy='e2ee'`, cuando no existe un `trusted_processor` de
tipo `antimalware` activo para ese contexto, entonces el sistema **rechaza la carga de
adjuntos** con `409`. El análisis antimalware no se omite en ningún caso.

**RN-08 — Emisión de evento de negocio** (D-141, D-080, D-025)
Dado un productor con credencial vigente, cuando entrega un evento cuyo `occurredAt` es
posterior al commit de su cambio de negocio, entonces Workspace Chat lo acepta, lo
deduplica por `sourceApplication + eventId` y publica la actividad como mensaje inmutable
en el tema indicado. Un intento de editar o eliminar ese mensaje desde Chat devuelve `409`.

**RN-09 — Indisponibilidad de Workspace Chat** (D-141, D-009)
Dado que Workspace Chat está caído, cuando el productor intenta entregar un evento,
entonces la entrega falla **sin** afectar la operación de negocio del productor, que
reintenta desde su propio outbox. Workspace Chat no ofrece ningún mecanismo que bloquee o
revierta al productor.

**RN-10 — Archivado por eliminación en origen** (D-136)
Dado un evento con `intent=archive_context` y motivo `source_object_deleted`, cuando el
objeto de negocio se elimina en la aplicación productora, entonces el contexto pasa a
`archived` en solo lectura conservando historial, autoría, auditoría y retención. **No se
elimina ninguna fila.** Si la aplicación es OBP, se fija `retention_clock_start` y arrancan
los relojes de 3 y 6 meses sobre todo el historial (D-120).

**RN-11 — Invocación del agente en tema privado** (D-106, D-107)
Dado un miembro de un tema manual privado **no** E2EE, cuando invoca al agente, entonces el
sistema valida de forma **independiente** que (a) el usuario tenga autorización vigente
sobre el tema y (b) el agente esté habilitado para la aplicación o contexto **y** tenga
membresía técnica explícita en el tema. Si falta cualquiera de las dos, devuelve `403`.
Ninguna autorización amplía la otra. Si el tema pertenece a un contexto E2EE, se rechaza
con `409`: la participación del agente en E2EE es posterior al MVP.

**RN-12 — Agente durante `break-glass`** (D-108)
Dado una sesión `break-glass` activa, cuando cualquier actor intenta invocar, habilitar o
delegar acceso al agente, entonces se rechaza con `403` y se registra el intento como
evidencia de seguridad. Aplica incluso bajo supervisión.

**RN-13 — Solicitud y aprobación de `break-glass`** (D-083, D-150, D-151)
Dado un usuario con scope `support` o `application_admin`, cuando solicita acceso
excepcional indicando motivo y alcance limitado, entonces se crea una solicitud `pending`.
Sólo un usuario con scope `global_admin` —nivel gerencia— y **distinto del solicitante**
puede aprobarla. La aprobación abre una ventana temporal con expiración; toda la actividad
se audita y el acceso se revoca automáticamente al expirar.

**RN-14 — `break-glass` sobre contenido E2EE** (D-083, D-091, D-147)
Dado una solicitud `break-glass` aprobada cuyo alcance incluye un contexto E2EE, cuando se
ejerce el acceso, entonces el sistema **no descifra por sí mismo**: solicita al servicio
corporativo de recuperación la liberación de las llaves del alcance aprobado, registra qué
referencias se liberaron y las deja auditadas. ⚠ **Este flujo depende de DEP-010, que no
existe todavía (D-147).**

**RN-15 — Purga por retención** (D-098, D-152, D-153)
Dado el planificador de retención, cuando el contenido alcanza el plazo visible deja de
mostrarse; al alcanzar el plazo operativo se purgan mensajes, revisiones y archivos y se
escribe un `purge_tombstone`. **Un legal hold vigente suspende la purga** en su alcance. No
existen excepciones por contexto: toda aplicación aplica la política corporativa dentro de
sus límites.

**RN-16 — Restauración desde backup** (D-098)
Dado una restauración de respaldo, cuando el sistema vuelve a servir información, entonces
reaplica **primero** tombstones, expiraciones y holds. Un backup **no puede resucitar**
contenido vencido.

**RN-17 — Rotación de llaves y mensajes programados** (D-092, D-053)
Dado un mensaje programado en un contexto E2EE, cuando se produce una rotación de época de
llave antes de su publicación, entonces el mensaje se **cancela o exige reprogramación**;
nunca se publica cifrado con una época inválida. Al publicarse, el sistema **revalida** que
el autor conserve autorización; si la perdió, no se publica.

**RN-18 — Revocación de dispositivo** (D-091)
Dado un dispositivo registrado, cuando se revoca, entonces se cortan sus sesiones, se
impide entregarle llaves nuevas y se rota la época de llave de los temas cifrados a los que
tenía acceso. El contenido ya descifrado o exportado desde ese extremo **no** puede
retirarse.

**RN-19 — Notificación en contexto E2EE** (D-092, D-061)
Dado un mensaje en un contexto E2EE, cuando se genera la intención de notificación,
entonces incluye aplicación, contexto, tema y autor, y `includes_body` es **obligatoriamente
false**. El Hub entrega el aviso; Workspace Chat conserva el estado de no leídos.

**RN-20 — Búsqueda** (D-031, D-157, D-092)
Dado un usuario en el cliente central, cuando busca, entonces debe haber seleccionado **una**
aplicación y los resultados se limitan a ella y a su audiencia autorizada. **Nunca** se
agregan resultados de varias aplicaciones. En contextos E2EE la búsqueda se ejecuta en el
cliente sobre contenido ya cargado y descifrado, sin índice central de texto plano.

**RN-21 — Ausencia de descubrimiento** (D-160)
Dado un usuario autenticado, cuando consulta contextos, temas o resultados de búsqueda,
entonces sólo percibe aquello donde tiene membresía. Ninguna respuesta, contador o mensaje
de error revela la existencia de contextos o temas a los que no pertenece: un recurso no
autorizado devuelve `404`, **no** `403`.

**RN-22 — Exclusión de campaña en migración** (D-119, D-154)
Dado un trabajo de migración, cuando la **gerencia** marca una campaña como excluida
expresamente, entonces queda fuera del alcance y se registra motivo y responsable. Sin
exclusión expresa, toda campaña que al corte no esté cerrada ni cancelada y todavía requiera
colaboración operativa **se migra**.

**RN-23 — Corte de campaña** (D-121)
Dado un trabajo en fase `validation`, cuando la validación no satisface los criterios,
entonces **no** se abre Workspace Chat y **no** se habilitan dos superficies de escritura:
el trabajo vuelve a un punto de control. Superada la validación, se abre Workspace Chat
como única superficie y Teams queda temporalmente en solo lectura antes de archivarse.

**RN-24 — Identidad histórica no resoluble** (D-120)
Dado contenido migrado cuya autoría no puede resolverse contra SSO, cuando se importa,
entonces se conserva nombre, fecha y origen como **atribución histórica**
(`is_historical=true`), sin crear sesión, membresía ni permisos. Una atribución histórica
nunca activa una cuenta.

**RN-25 — Analítica sobre temas privados o E2EE** (D-109, D-161)
Dado el motor de analítica, cuando agrega métricas de temas privados o cifrados, entonces
sólo produce agregados y metadata operativa. Está prohibido almacenar nombres de tema,
integrantes, cuerpos, archivos, búsquedas, prompts o respuestas. **No existe excepción para
OBP.**

### 5.2 Edge cases

| # | Caso | Tratamiento | D-ID |
|:--:|---|---|---|
| EC-01 | Doble envío del mismo mensaje | `Idempotency-Key` devuelve el mensaje ya creado, sin duplicar | `03` |
| EC-02 | Usuario retirado con WebSocket abierto | Se revalida membresía antes de cada entrega; se cierra la conexión y se emite error de autorización | D-018 |
| EC-03 | Evento duplicado por reintento del productor | `sourceApplication + eventId` devuelve `duplicate` sin repetir efectos | D-080 |
| EC-04 | Evento con `externalId` distinto para el mismo objeto | Se crea un **contexto nuevo**; no se migra ni fusiona el anterior | D-137, D-138 |
| EC-05 | `ensure_topic` sobre un tema archivado | `ensure` es no destructivo: no reactiva, no cambia reglas; devuelve `accepted` sin efecto | D-080 |
| EC-06 | Renombrar un tema automático de OBP | `409`: `is_renamable=false` | D-012 |
| EC-07 | Cambiar `encryption_policy` con contenido existente | `409`: la política se fija antes del primer contenido y es inmutable | D-089 |
| EC-08 | Analizador antimalware caído en contexto no E2EE | Los adjuntos permanecen `pending` y no se sirven; se alerta por acumulación en cuarentena | D-086, D-111 |
| EC-09 | Analizador caído en contexto E2EE | El contexto **rechaza** nuevas cargas de adjunto | D-092 |
| EC-10 | Purga con legal hold parcialmente solapado | El hold prevalece sobre su alcance exacto; el resto se purga normalmente | D-098 |
| EC-11 | Último administrador contextual se desactiva en SSO | El contexto se marca **huérfano**; un `application_admin` lo reasigna **sin leer mensajes** | D-085 |
| EC-12 | Solicitante intenta aprobar su propio `break-glass` | `409`: `approved_by <> requested_by` y exige nivel gerencia | D-150 |
| EC-13 | Aprobador de `break-glass` sin scope `global_admin` | `403`: sólo gerencia aprueba | D-150, D-151 |
| EC-14 | Invocación de agente en tema privado sin membresía técnica | `403`, aunque el usuario sí esté autorizado | D-106 |
| EC-15 | Invocación de agente en contexto E2EE | `409`: posterior al MVP | D-107 |
| EC-16 | Búsqueda sin aplicación seleccionada en el cliente central | `400`: la selección de aplicación es obligatoria | D-157 |
| EC-17 | Consulta de un contexto sin membresía | `404`, nunca `403`, para no revelar existencia | D-160 |
| EC-18 | Mensaje programado cuyo autor pierde acceso antes de publicar | No se publica; queda `cancelled` con motivo auditado | D-053 |
| EC-19 | Restauración de backup que contiene contenido purgado | Se reaplican tombstones antes de servir | D-098 |
| EC-20 | Campaña OBP que nunca pasa a inactiva | El reloj de retención no arranca; se emite señal de anomalía (M-027, R-020) | D-120 |
| EC-21 | Productor emite antes de persistir | **No es detectable en recepción.** Se detecta a posteriori por discrepancia en M-008 y **no** dispara acción automática | D-142, D-143 |
| EC-22 | Servicio de llaves no disponible al ejercer `break-glass` E2EE | La solicitud queda aprobada pero **no ejecutable**; se registra la indisponibilidad | D-147, R-021 |

### 5.3 Notas operativas

- Toda regla RN-xx debe tener test de integración con caso positivo y **caso negativo**.
- Los rechazos por autorización se emiten como `404` cuando revelar la existencia del
  recurso violaría D-160, y como `403` en el resto.
- Los logs **nunca** incluyen cuerpo de mensaje, ni en claro ni cifrado. Sólo
  identificadores y `correlationId` (D-109).
- El planificador de retención es idempotente y reejecutable: una purga parcial se retoma
  sin duplicar tombstones.

---


## 6. Seguridad

### 6.1 Autenticación

| Regla | D-ID |
|---|---|
| La identidad de **personas** proviene exclusivamente de SSO Integral mediante OIDC. Se valida el token con JWKS del proveedor | D-003 |
| **No existen** endpoints de login, registro, contraseña, recuperación ni MFA propios. No se almacenan hashes de credenciales de usuario | D-003 |
| El bootstrap del primer administrador global se realiza vinculando un `sso_subject` conocido; **sin** credenciales estáticas | D-003 |
| Las **aplicaciones consumidoras** usan credencial propia emitida en su alta, con secreto rotable y orígenes autorizados. Es un plano distinto de la identidad de personas | D-134, D-135 |
| El registro de un **dispositivo** para E2EE exige reautenticación reforzada contra el SSO; Workspace Chat no implementa el segundo factor | D-091 |

### 6.2 Autorización

Evaluación en cadena, **todas** las condiciones deben cumplirse:

```text
1. application_id del token  ──►  ¿coincide con el del recurso?        (D-093)
2. membresía contextual      ──►  ¿existe y no está removida?          (D-016)
3. visibilidad del tema      ──►  público: basta 1+2                   (D-045)
                                  privado: exige membresía de tema
4. rol                       ──►  context_admin | member | read_only   (D-084, D-155)
5. scope de plataforma       ──►  sólo para operaciones administrativas (D-082)
6. segunda barrera de datos  ──►  filtro independiente por aplicación   (D-093, D-162)
```

| Regla | D-ID |
|---|---|
| **Ningún scope administrativo concede lectura automática de mensajes** ni membresía implícita en temas privados | D-082 |
| La separación de scopes es **del sistema**, no de la organización: se mantiene aunque una persona ejerza varios | D-149 |
| El `application_id` autorizado proviene del token o la sesión, **nunca** de un valor libre del cliente | D-093 |
| La aplicación central y la consola **no disponen de bypass** de aislamiento | D-044, D-058 |
| Un miembro **nunca** añade participantes; no existe solicitud de acceso | D-156, D-160 |
| Un recurso no autorizado devuelve `404` cuando `403` revelaría su existencia | D-160 |

### 6.3 Acceso excepcional — `break-glass`

| Elemento | Regla | D-ID |
|---|---|---|
| Quién solicita | Scope `support` o `application_admin` — coordinación y desarrollo | D-150 |
| Quién aprueba | Scope `global_admin` — **nivel gerencia**, distinto del solicitante | D-150, D-151 |
| Qué exige | Motivo, alcance limitado, ventana temporal y expiración | D-083 |
| Qué **no** hace | **No descifra E2EE por sí mismo.** Autoriza al servicio corporativo a liberar sólo las llaves del alcance aprobado | D-083, D-091 |
| Prohibición absoluta | El agente MCP **no** puede invocarse, habilitarse ni recibir acceso delegado durante la sesión, incluso supervisada | D-108 |
| Evidencia | Toda la actividad se audita, incluidas las referencias de llave liberadas | D-098 |

### 6.4 Cifrado de extremo a extremo

| Regla | D-ID |
|---|---|
| **Fundamento:** proteger información comercial sensible frente a accesos internos indebidos. **No hay obligación regulatoria ni contractual externa** | D-131 |
| Configurable por aplicación y contexto; se fija **antes** de publicar contenido y **no cambia después** | D-089 |
| Cada tema cifrado mantiene una **frontera criptográfica independiente**, con su propia época de llave | D-089 |
| El backend ordinario permanece **ciego**: sólo persiste `ciphertext` y sobre criptográfico | D-092 |
| Las llaves se respaldan cifradas mediante servicio corporativo protegido por KMS/HSM. **⚠ Ese servicio NO EXISTE (D-147, DEP-010, R-021)** | D-091, D-147 |
| La recuperación exige servicio de llaves **más** `break-glass` aprobado, con evidencia auditable | D-091 |
| Sólo productores y procesadores imprescindibles participan criptográficamente, con identidad propia, alcance mínimo, credenciales rotables, auditoría y revocación | D-092 |
| Las llaves de recuperación **nunca** sirven al procesamiento ordinario | D-092 |
| El antimalware es obligatorio también en E2EE; sin analizador disponible el contexto **no admite adjuntos** | D-092, D-086 |
| Notificaciones sin cuerpo; programados cifrados con cancelación ante rotación | D-092 |
| Búsqueda limitada al cliente sobre contenido ya cargado y descifrado, **sin índice central de texto plano** | D-092 |
| Participación del agente MCP como procesador criptográfico | D-107 — **Posterior al MVP** |

> **El modelo criptográfico es de recuperación corporativa administrada, no de clave
> precompartida fuera de banda.** Un esquema sin custodia haría imposibles la recuperación,
> el legal hold sobre E2EE y el alta de nuevos dispositivos.

### 6.5 Seguridad de contenido

| Regla | D-ID |
|---|---|
| Todo adjunto valida MIME **real** contra el declarado, extensión y tamaño | D-086 |
| Cuarentena obligatoria: mientras no supere el análisis **no se visualiza ni descarga** | D-086 |
| `blocked` y `unscannable` son estados **terminales**; el archivo nunca se libera | D-086 |
| La política corporativa de formatos fija el mínimo; una aplicación puede **restringirla, nunca debilitarla** | D-086 |
| Entrega mediante URLs firmadas y temporales | D-086 |
| Se auditan carga, resultado del análisis, descarga, bloqueo y eliminación | D-086 |
| La misma política aplica al contenido **migrado** antes de ponerlo a disposición | D-120, D-086 |

### 6.6 Auditoría y evidencia

| Regla | D-ID |
|---|---|
| `audit_entries` es **append-only**: sin UPDATE ni DELETE a nivel de aplicación | D-098 |
| Se auditan actor, instante, motivo cuando corresponde, participantes, roles, archivado, privacidad, ediciones, eliminaciones, adjuntos, exportaciones, recuperaciones y acciones de agentes | D-098, D-099 |
| La evidencia de auditoría se conserva **2 años** desde el evento | D-098 |
| La **consulta** de auditoría se audita a su vez | D-099 |
| Observabilidad y auditoría son **vías separadas**: la observabilidad usa identificadores internos y no concede lectura de contenido | D-109 |

### 6.7 Protección de datos personales

| Regla | D-ID |
|---|---|
| Workspace Chat **hereda el marco corporativo vigente** y no define un marco propio | D-139 |
| Los **derechos del titular** (acceso, rectificación, supresión) quedan **fuera del alcance del producto**; se atienden por el canal corporativo y Chat aporta información mediante la exportación gobernada | D-140 |

**Dos particularidades registradas que deben comunicarse al responsable del marco
corporativo:**

1. En contextos E2EE, Workspace Chat **no puede localizar ni suprimir** contenido de una
   persona sin recuperación corporativa y `break-glass` aprobado. Una solicitud de supresión
   **no es ejecutable por la vía ordinaria**.
2. La migración conserva **atribuciones históricas con nombre y fecha** de identidades no
   resolubles, que pueden corresponder a personas ya desvinculadas (D-120).

### 6.8 Transporte y red

- TLS 1.3 obligatorio en todo el tráfico externo.
- Rate limiting en el gateway por identidad y por credencial de aplicación.
- CORS restringido a los `allowed_origins` registrados en el alta de cada aplicación
  (D-134): el BFF embebido acepta **sólo** el origen de la aplicación consumidora.
- El handshake de realtime valida token, `application_id` y membresía **antes** de aceptar
  la conexión, y la revalida ante cada entrega (EC-02).
- Secretos gestionados fuera del código y del repositorio.

---


## 7. Infraestructura

> Todo el contenido de esta sección es **propuesta de implementación** (D-162). Lo
> vinculante son los invariantes de las secciones 3 y 6.

### 7.1 Flujo de autenticación

1. El cliente inicia OAuth 2.0 + PKCE contra el proveedor de identidad corporativo.
2. El proveedor autentica —incluida cualquier política de segundo factor **propia del
   proveedor**— y devuelve el código de autorización.
3. El cliente lo intercambia por tokens.
4. El gateway valida firma y expiración contra JWKS y extrae `sub`.
5. El núcleo resuelve la identidad y el conjunto de aplicaciones autorizadas; el
   `application_id` efectivo se deriva del contexto de la petición, **nunca** del cliente.

### 7.2 Resiliencia

- Probes de liveness y readiness en todos los servicios.
- Circuit breaker frente a SSO, capacidad de medios, antimalware, Hub, servicio de llaves y
  agente MCP (DEP-001 a DEP-011).
- Reintentos con backoff exponencial y DLQ con inspección manual.
- **Degradación explícita y comunicada** (D-092, R-008): sin analizador no hay adjuntos; sin
  servicio de llaves no hay recuperación E2EE; sin Hub, Chat conserva no leídos y los avisos
  se acumulan.
- El cliente móvil muestra **estado desconectado** y al reconectar obtiene del servidor el
  estado autorizado vigente; **jamás** publica acciones creadas sin conexión (D-087, D-088).

### 7.3 Observabilidad

| Elemento | Contenido | D-ID |
|---|---|---|
| Logs centralizados | Identificadores y `correlationId`. **Nunca** cuerpo de mensaje | D-111, D-109 |
| Métricas básicas | Salud, latencia, entrega, errores | D-111 |
| Alertas | Indisponibilidad, eventos fallidos, respaldos, antimalware y **acumulación en cuarentena** | D-111 |
| Correlación end-to-end | Desde el productor hasta Chat, Hub y cliente | D-111 |
| Atención | Equipo responsable **dentro de su operación normal**. Sin guardia 24/7 | D-111, D-113 |
| Instrumentación diferida | Uso, capacidad y recuperación para fijar después SLO, RPO/RTO y umbrales | D-112 |

**No se fijan valores numéricos de SLO, capacidad, RPO/RTO ni presupuesto** (DF-011).

### 7.4 Despliegue

- Contenedores con imagen base mínima y usuario no root.
- Entorno local reproducible con la persistencia, caché, cola y almacén de objetos.
- Despliegue con actualización progresiva y drenado de conexiones realtime.
- Respaldos con **rotación de 35 días**; una restauración **reaplica tombstones,
  expiraciones y holds antes de servir** (D-098).
- Evidencia de auditoría en almacenamiento inmutable, con retención de 2 años (D-098).
- Residencia en la región aprobada por la infraestructura disponible, **sin selección por
  aplicación** (D-099).

### 7.5 Variables de entorno

```text
SSO_ISSUER, SSO_JWKS_URL, SSO_AUDIENCE
DB_URL
CACHE_URL
QUEUE_URL
OBJECT_STORE_ENDPOINT, OBJECT_STORE_BUCKET, OBJECT_STORE_KEY, OBJECT_STORE_SECRET
ANTIMALWARE_ENDPOINT                 # sin él, los adjuntos no se liberan (D-086)
KEY_SERVICE_ENDPOINT                 # ⚠ DEP-010: aún no existe (D-147)
MCP_GATEWAY_ENDPOINT                 # D-127
NOTIFICATION_HUB_ENDPOINT            # D-030
CORS_ALLOWED_ORIGINS                 # se deriva del alta de cada aplicación (D-134)
LOG_LEVEL, OTEL_EXPORTER_ENDPOINT
```

### 7.6 CI/CD

- Lint, formato y tipado estricto en pre-commit y en pipeline.
- Tests con **cobertura obligatoria de los casos negativos** de las reglas RN-xx.
- **Pruebas de aislamiento automáticas** que verifiquen que ninguna consulta cruza
  fronteras de aplicación, contexto o tema privado (D-093, R-002, M-018).
- Despliegue a preproducción y promoción tras validación.
- Verificación post-despliegue de salud y endpoints críticos.

### 7.7 Manifest de infraestructura

```json
{
  "project_id": "workspace-chat",
  "traceability": {
    "source_of_truth": "100-workspace-chat-domain-benchmark-gap-analysis.md",
    "decision_log": ["20-decision-log.md", "20.1-decision-log-cierre.md"]
  },
  "stack_status": "PROPUESTA — no es decisión de dominio (D-162)",
  "stack": {
    "backend": { "framework": "NestJS", "language": "TypeScript" },
    "database": { "engine": "PostgreSQL", "second_barrier": "RLS" },
    "queue": { "engine": "RabbitMQ o BullMQ" },
    "object_store": { "engine": "S3-compatible" },
    "realtime": { "engine": "Socket.IO" }
  },
  "security": {
    "authentication": "SSO corporativo OIDC — sin credenciales de usuario propias (D-003)",
    "application_credentials": "cliente/secreto rotable por aplicación (D-135)",
    "isolation_axis": "application_id (D-093)",
    "multi_tenant_support": false,
    "e2ee": "recuperación corporativa administrada (D-091)",
    "key_service_available": false
  },
  "explicitly_excluded": [
    "multi-tenancy", "channels", "conversations", "canal de mensajería externo",
    "login propio", "MFA propio", "orquestación de LLM", "Strangler Fig",
    "convivencia con Teams", "borrado físico en cascada", "presencia",
    "confirmaciones de lectura", "descubrimiento abierto", "solicitud de acceso"
  ]
}
```

---


## 8. UI/UX Design Intent

### 8.1 Superficies

| Superficie | Alcance | Regla vinculante | D-ID |
|---|---|---|---|
| Componente embebido | Una sola aplicación consumidora | Muestra **exclusivamente** conversaciones de esa aplicación. Contextual y no invasivo | D-123, D-028 |
| Aplicación central web | N aplicaciones autorizadas | Agrega conversaciones contextuales autorizadas **sin bypass**. Sin DMs, grupos ni canales generales | D-044, D-073 |
| Cliente móvil | Ídem central | **Solo en línea.** Estado desconectado explícito; sin historial local ni cola de acciones | D-087, D-088 |
| Consola de administración | Plataforma | Experiencia separada de la aplicación central de usuario | D-058 |

### 8.2 Reglas de composición vinculantes

| Regla | D-ID |
|---|---|
| La navegación **nunca** ofrece contextos o temas sin membresía. No hay directorio ni "solicitar acceso" | D-160 |
| En el cliente central, la búsqueda exige **seleccionar una aplicación** antes de ejecutarse | D-157 |
| La separación visual entre aplicaciones es estricta: ninguna vista mezcla contextos de distintas aplicaciones en una misma lista de resultados | D-044, D-093 |
| El cambio de privacidad de un tema sólo se ofrece mientras esté vacío; después, la UI ofrece **crear tema sucesor** | D-081 |
| Los temas administrados por aplicación se muestran **sin** acciones de renombrar ni eliminar | D-012 |
| Un adjunto en cuarentena se muestra con estado explícito y **sin** acción de descarga | D-086 |
| En contextos E2EE la UI comunica las degradaciones: búsqueda limitada, avisos sin cuerpo, agente no disponible | D-092, R-008, M-022 |
| La invocación del agente es **explícita**: publicar la pregunta es la confirmación. No hay respuesta privada previa | D-103 |
| **No** se muestran presencia, indicador de escritura ni confirmaciones de lectura | D-159 |
| Estados `loading`, `empty` y `error` obligatorios en toda vista con datos remotos | — |
| Accesibilidad WCAG AA; objetivo táctil ≥ 44×44 px | — |

### 8.3 Fuera de alcance de la UI

CRUD administrativo por entidad sin endpoint en §4; pantallas para entidades técnicas
(`outbox`, `audit_entries`, `business_events`, `analytics_rollups`); cualquier vista que
liste contextos ajenos a la membresía del usuario (D-160); indicadores de presencia (D-159).

---
