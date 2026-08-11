# API contracts draft — §4

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
