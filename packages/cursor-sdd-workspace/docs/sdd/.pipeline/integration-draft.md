# Integration draft — §7

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
